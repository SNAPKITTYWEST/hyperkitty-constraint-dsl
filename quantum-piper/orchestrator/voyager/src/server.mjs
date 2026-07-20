// BOB VOYAGER — Aerospace Backend
// Apache License 2.0 — SnapKitty Collective 2026
// NORAD 25544 · ISS ZARYA · Live Telemetry Proxy + WORM Engine

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');
const DATA_DIR  = path.join(ROOT, 'data');
const WORM_LOG  = path.join(DATA_DIR, 'worm_chain.jsonl');
const TELEM_LOG = path.join(DATA_DIR, 'telemetry.jsonl');

const PORT = process.env.PORT || 4299;

// ── WORM Chain ────────────────────────────────────────────────
let wormPrev  = 'GENESIS_BOB_VOYAGER_SERVER';
let wormCount = 0;

function wormSeal(event, payload = {}) {
  const msg  = `${wormPrev}|${event}|${Date.now()}`;
  const hash = crypto.createHash('sha256').update(msg).digest('hex');
  const entry = {
    seq:       wormCount++,
    hash,
    prev:      wormPrev,
    event,
    payload,
    timestamp: new Date().toISOString(),
  };
  wormPrev = hash;
  fs.appendFileSync(WORM_LOG, JSON.stringify(entry) + '\n');
  return entry;
}

// ── ISS telemetry cache ───────────────────────────────────────
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 4500; // ms — refresh slightly faster than 5s client poll

function fetchISS() {
  return new Promise((resolve, reject) => {
    https.get('https://api.wheretheiss.at/v1/satellites/25544', res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const d = JSON.parse(body);
          resolve(d);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function refreshTelemetry() {
  try {
    const d = await fetchISS();
    const orbital = computeOrbital(d.altitude);
    cache = { ...d, ...orbital, fetched_at: new Date().toISOString() };
    cacheTime = Date.now();

    // WORM seal every telemetry update
    const seal = wormSeal('TELEMETRY', {
      lat: d.latitude.toFixed(4),
      lon: d.longitude.toFixed(4),
      alt: d.altitude.toFixed(2),
      vel: d.velocity.toFixed(0),
    });

    // Append to telemetry log
    const logEntry = { ...cache, worm: seal.hash.slice(0, 16) };
    fs.appendFileSync(TELEM_LOG, JSON.stringify(logEntry) + '\n');

    console.log(`[TELEM] ${cache.fetched_at} | LAT ${d.latitude.toFixed(2)} LON ${d.longitude.toFixed(2)} ALT ${d.altitude.toFixed(1)} | WORM ${seal.hash.slice(0,10)}`);
  } catch (e) {
    console.error('[TELEM] fetch error:', e.message);
  }
}

// ── Orbital mechanics ─────────────────────────────────────────
const MU      = 398600.4418;
const R_EARTH = 6371;
const ISS_ECC = 0.0001698;

function computeOrbital(alt) {
  const r   = R_EARTH + alt;
  const T   = 2 * Math.PI * Math.sqrt(r ** 3 / MU);       // seconds
  const n   = 86400 / T;                                   // rev/day
  const vv  = Math.sqrt(MU / r);                           // km/s vis-viva
  const fp  = R_EARTH * Math.acos(R_EARTH / r);            // footprint km
  const apg = alt * (1 + ISS_ECC);
  const per = alt * (1 - ISS_ECC);
  return {
    orbital_period_min: parseFloat((T / 60).toFixed(4)),
    mean_motion_rev_day: parseFloat(n.toFixed(6)),
    vis_viva_kms: parseFloat(vv.toFixed(6)),
    semi_major_km: parseFloat(r.toFixed(2)),
    footprint_km: parseFloat(fp.toFixed(1)),
    apogee_km: parseFloat(apg.toFixed(2)),
    perigee_km: parseFloat(per.toFixed(2)),
    inclination_deg: 51.6,
    norad_id: 25544,
  };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GROUND_STATIONS = {
  SF:   { name: 'San Francisco',          lat: 37.7749,  lon: -122.4194 },
  JSC:  { name: 'Johnson Space Center',   lat: 29.5583,  lon:  -95.0894 },
  TSUP: { name: 'TsUP Moscow',            lat: 55.7558,  lon:   37.6173 },
  JAXA: { name: 'JAXA Tsukuba',           lat: 36.0466,  lon:  140.1229 },
  ESA:  { name: 'ESA ESOC Darmstadt',     lat: 49.8715,  lon:    8.6221 },
  BAKO: { name: 'Baikonur Cosmodrome',    lat: 45.9200,  lon:   63.3420 },
};

function enrichWithGroundStations(telemetry) {
  if (!telemetry) return null;
  const gs = {};
  for (const [code, station] of Object.entries(GROUND_STATIONS)) {
    const dist = haversine(telemetry.latitude, telemetry.longitude, station.lat, station.lon);
    const r    = R_EARTH + telemetry.altitude;
    const centralAngle = dist / R_EARTH;
    const elev = Math.atan(
      (Math.cos(centralAngle) - R_EARTH / r) / Math.sin(centralAngle)
    ) * 180 / Math.PI;
    gs[code] = {
      name:         station.name,
      dist_km:      parseFloat(dist.toFixed(1)),
      elevation_deg: parseFloat(elev.toFixed(2)),
      in_contact:   elev > 0,
    };
  }
  return gs;
}

// ── HTTP Router ───────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, data, status = 200) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function serveFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    cors(res);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // ── /api/telemetry — live ISS position + orbital elements ──
  if (url === '/api/telemetry') {
    if (!cache || Date.now() - cacheTime > CACHE_TTL) await refreshTelemetry();
    const gs = enrichWithGroundStations(cache);
    json(res, { ok: true, telemetry: cache, ground_stations: gs, worm_head: wormPrev.slice(0, 16) });
    return;
  }

  // ── /api/worm — last N WORM entries ─────────────────────────
  if (url === '/api/worm') {
    try {
      const lines = fs.readFileSync(WORM_LOG, 'utf8').trim().split('\n').slice(-50);
      const entries = lines.map(l => JSON.parse(l));
      json(res, { ok: true, count: wormCount, head: wormPrev, entries });
    } catch {
      json(res, { ok: true, count: wormCount, head: wormPrev, entries: [] });
    }
    return;
  }

  // ── /api/track — last N telemetry positions ─────────────────
  if (url === '/api/track') {
    try {
      const lines = fs.readFileSync(TELEM_LOG, 'utf8').trim().split('\n').slice(-200);
      const track = lines.map(l => {
        const d = JSON.parse(l);
        return { lat: d.latitude, lon: d.longitude, alt: d.altitude, ts: d.fetched_at };
      });
      json(res, { ok: true, count: track.length, track });
    } catch {
      json(res, { ok: true, count: 0, track: [] });
    }
    return;
  }

  // ── /api/groundstations ──────────────────────────────────────
  if (url === '/api/groundstations') {
    if (!cache || Date.now() - cacheTime > CACHE_TTL) await refreshTelemetry();
    json(res, { ok: true, stations: enrichWithGroundStations(cache) });
    return;
  }

  // ── /api/health ──────────────────────────────────────────────
  if (url === '/api/health') {
    json(res, {
      ok: true,
      service: 'bob-voyager',
      version: '2.0.0',
      norad: 25544,
      worm_count: wormCount,
      worm_head: wormPrev.slice(0, 16),
      cache_age_ms: Date.now() - cacheTime,
      uptime_s: process.uptime().toFixed(0),
      license: 'Apache-2.0',
    });
    return;
  }

  // ── /api/orbital ─ pure orbital mechanics (no API call) ─────
  if (url === '/api/orbital') {
    const alt = cache?.altitude ?? 408;
    json(res, { ok: true, altitude_km: alt, ...computeOrbital(alt) });
    return;
  }

  // ── Static: serve public/ ─────────────────────────────────────
  const staticBase = path.join(ROOT, 'public');
  let filePath = url === '/' ? path.join(staticBase, 'index.html') : path.join(staticBase, url);
  const ext = path.extname(filePath);
  const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
                  '.json':'application/json', '.ico':'image/x-icon' };
  if (fs.existsSync(filePath)) {
    serveFile(res, filePath, types[ext] || 'text/plain');
    return;
  }

  res.writeHead(404); res.end('Not found');
});

// ── Boot ──────────────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

wormSeal('SERVER_BOOT', { port: PORT, version: '2.0.0', norad: 25544 });

await refreshTelemetry();
setInterval(refreshTelemetry, CACHE_TTL);

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  BOB VOYAGER — Aerospace Backend v2.0      ║
║  NORAD 25544 · ISS ZARYA · WORM Sealed     ║
║  http://localhost:${PORT}                      ║
║  Apache 2.0 · SnapKitty Collective 2026    ║
╚════════════════════════════════════════════╝

  API endpoints:
    GET /api/telemetry      live ISS + orbital elements + ground stations
    GET /api/worm           last 50 WORM chain entries
    GET /api/track          last 200 telemetry positions
    GET /api/groundstations SF · JSC · TsUP · JAXA · ESA · Baikonur
    GET /api/orbital        Keplerian elements (no external call)
    GET /api/health         service status
  `);
});
