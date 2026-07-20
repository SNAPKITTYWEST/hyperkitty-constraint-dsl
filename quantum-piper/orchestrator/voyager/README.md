# BOB VOYAGER — Forth ISS Orbital Oracle
**Version:** v2.0.0


**Live ISS telemetry · Forth stack machine · WORM-sealed audit chain · Apache 2.0**

> "No syntax. Just a stack. NASA runs Forth. So does BOB."

NORAD 25544 · ISS ZARYA · SnapKitty Collective · 2026

---

## What it is
**Version:** v2.0.0


A real-time aerospace telemetry system tracking the International Space Station via a Forth stack machine. Every orbital calculation — vis-viva velocity, delta-v, orbital period, ground footprint — runs as a Forth word on a live stack. All telemetry is WORM-sealed with SHA-256 chained hashes.

## Architecture
**Version:** v2.0.0


```
wheretheiss.at API
       ↓ (every 4.5s)
  src/server.mjs          ← Node.js backend (zero dependencies)
       ├── /api/telemetry  ← ISS position + full Keplerian elements + 6 ground stations
       ├── /api/worm       ← WORM chain audit log (last 50 seals)
       ├── /api/track      ← Historical positions (last 200 points)
       ├── /api/orbital    ← Pure orbital mechanics endpoint
       ├── /api/groundstations  ← Contact angles + distances to SF/JSC/TsUP/JAXA/ESA/Baikonur
       └── /api/health     ← Service status + WORM head
       ↓
  public/index.html        ← Forth interpreter + Canvas globe
  data/worm_chain.jsonl    ← Cryptographic audit log (append-only)
  data/telemetry.jsonl     ← Full telemetry history (append-only)
```

## API Endpoints
**Version:** v2.0.0


| Endpoint | Description |
|----------|-------------|
| `GET /api/telemetry` | Live ISS position + orbital elements + ground station distances |
| `GET /api/worm` | Last 50 WORM chain entries (SHA-256 chained) |
| `GET /api/track` | Last 200 telemetry positions for orbit trail |
| `GET /api/groundstations` | SF · JSC · TsUP · JAXA · ESA · Baikonur contact status |
| `GET /api/orbital` | Keplerian elements (no external call) |
| `GET /api/health` | Service health + WORM count + uptime |

## Orbital Mechanics
**Version:** v2.0.0


All physics uses standard aerospace constants:

- **μ** = 398,600.4418 km³/s² (Earth gravitational parameter)
- **Vis-Viva**: v² = μ(2/r − 1/a)
- **Period**: T = 2π√(a³/μ)
- **Inclination**: 51.6° (ISS orbital plane)
- **Eccentricity**: 0.0001698 (near-circular)
- **NORAD ID**: 25544 (ISS ZARYA, launched 1998-11-20)

## Forth Words (client)
**Version:** v2.0.0


| Word | Description |
|------|-------------|
| `ISS.LAT / LON / ALT / VEL` | Push live ISS telemetry onto stack |
| `ORBITAL.PERIOD` | T = 2π√(r³/μ) in minutes |
| `VIS.VIVA` | Instantaneous orbital velocity (km/s) |
| `SEMI.MAJOR` | Semi-major axis (km) |
| `MEAN.MOTION` | Revolutions per day |
| `APOGEE / PERIGEE` | Orbit extremes (km) |
| `FOOTPRINT` | Ground visibility radius (km) |
| `ECLIPSE` | ISS in Earth shadow? (1/0) |
| `DELTA.V` | Delta-v to reboost to 420km nominal |
| `DIST.SF / JSC / TSUP / JAXA` | Distance to ground stations |
| `ELEV.SF` | Elevation angle from San Francisco |
| `WORM.SEAL` | Cryptographically seal top-of-stack |

## WORM Chain
**Version:** v2.0.0


Every telemetry update is cryptographically chained:

```
hash_n = SHA-256( hash_{n-1} | event | timestamp )
```

Written to `data/worm_chain.jsonl`. Append-only. Tamper-evident. Same principle as blockchain finality — applied to mission data.

## Running
**Version:** v2.0.0


```bash
node src/server.mjs
# → http://localhost:4299
**Version:** v2.0.0

```

No npm install needed. Zero dependencies. Node 18+ only.

## SEIT Educational Layer
**Version:** v2.0.0


BOB VOYAGER is deployed by **Saint Errant Digital Institute (SEIT)** as live aerospace curriculum.

A student types `VIS.VIVA .` → gets the actual orbital velocity of the ISS.
They type `DELTA.V .` → see the fuel cost to raise the orbit.
They type `FOOTPRINT .` → understand why ISS sees 2,800 km in every direction.

No textbook. No simulation. Real NORAD telemetry. Real physics. Real audit trail.

---

**Apache License 2.0** — SnapKitty Collective · Bel Esprit D'Accord Trust · 2026
`snapkittywest.github.io` · Evidence or Silence
