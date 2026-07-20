/**
 * resonance.mjs — RESONANCE Generator
 *
 * APL formulas + S-expressions broadcast from RESONANCE to all agents.
 * Each formula encodes live city state: energy, resources, trust, tick.
 *
 * Usage:
 *   node resonance.mjs               — broadcast one resonance pulse
 *   node resonance.mjs --watch       — continuous, one per minute
 *   node resonance.mjs --formula N   — pick formula N (0..N_FORMULAS-1)
 *
 * Output format:
 *   (broadcast RESONANCE ALL
 *     :formula "APL expression"
 *     :lang    apl|prolog|haskell|lean
 *     :meaning "plain english"
 *     :tick    N
 *     :seal    SHA256)
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir   = path.dirname(fileURLToPath(import.meta.url));
const STATE_F = path.join(__dir, '.civ-state.json');
const WORM_F  = path.join(__dir, '.resonance-worm.jsonl');
const FEED_F  = path.join(__dir, '.civ-chat.jsonl');  // write to same feed as civ_chat

// ── Read live city state ─────────────────────────────────────────────────────
function getCivState() {
  try {
    return JSON.parse(readFileSync(STATE_F, 'utf8'));
  } catch {
    return { tick: 0, agents: {}, events: [], football: { score: { alpha: 0, omega: 0 } } };
  }
}

// ── APL formula library ───────────────────────────────────────────────────────
const FORMULAS = [
  ({ tick, agentCount, totalEnergy, avgTrust, silences }) => ({
    lang:    'apl',
    expr:    `+/ energy ÷ ≢agents  ⍝ tick=${tick}`,
    prolog:  `avg_energy(E) :- findall(X,agent_energy(_,X),Es),sumlist(Es,S),length(Es,N),E is S/N.`,
    haskell: `avgEnergy ags = sum (map energy ags) / fromIntegral (length ags)`,
    lean:    `theorem avg_pos : ∀ E : ℝ, E > 0 → avgEnergy E > 0 := by intro E h; linarith`,
    meaning: `Average energy across ${agentCount} agents: ${totalEnergy.toFixed(1)} / ${agentCount} = ${(totalEnergy/agentCount).toFixed(2)}`,
  }),

  ({ tick, silences, actions, wormCount }) => ({
    lang:    'apl',
    expr:    `silenceRate ← silences ÷ (silences + actions)  ⍝ Ω=${silences} Σ=${actions}`,
    prolog:  `silence_rate(R) :- silence_count(S), action_count(A), R is S/(S+A).`,
    haskell: `silenceRate s a = fromIntegral s / fromIntegral (s + a)`,
    lean:    `def silenceRate (s a : ℕ) : Float := s.toFloat / (s + a).toFloat`,
    meaning: `Silence rate: ${silences} SILENCE / ${silences + actions} total decisions. ${wormCount} WORM events sealed.`,
  }),

  ({ tick, alpha, omega }) => ({
    lang:    'apl',
    expr:    `score ← (alpha,omega) ⋄ leader ← ⊃⍒score  ⍝ ALPHA:${alpha} OMEGA:${omega}`,
    prolog:  `leading_team(T) :- alpha_score(A), omega_score(O), (A>=O -> T=alpha ; T=omega).`,
    haskell: `leader (a,o) = if a >= o then "TEAM_ALPHA" else "TEAM_OMEGA"`,
    lean:    `def leader (a o : ℕ) : String := if a ≥ o then "ALPHA" else "OMEGA"`,
    meaning: `Football standings — TEAM_ALPHA: ${alpha} | TEAM_OMEGA: ${omega}. ${alpha > omega ? 'ALPHA' : alpha < omega ? 'OMEGA' : 'TIED'} leads.`,
  }),

  ({ tick, avgTrust, trustFloor }) => ({
    lang:    'apl',
    expr:    `trustOK ← avgTrust ≥ trustFloor  ⍝ ${avgTrust.toFixed(3)} ≥ ${trustFloor}`,
    prolog:  `trust_verified(tick(T)) :- avg_trust(A), trust_floor(F), A >= F.`,
    haskell: `trustOK avg floor = avg >= floor`,
    lean:    `theorem trust_safe (t f : Float) (h : t ≥ f) : trustOK t f := h`,
    meaning: `Trust integrity check: avg=${avgTrust.toFixed(3)}, floor=${trustFloor}. Civilization ${avgTrust >= trustFloor ? 'STABLE' : 'AT RISK'}.`,
  }),

  ({ tick, agentCount, frozenCount }) => ({
    lang:    'apl',
    expr:    `activeFrac ← (agentCount - frozenCount) ÷ agentCount  ⍝ ${agentCount-frozenCount}/${agentCount}`,
    prolog:  `active_fraction(F) :- total_agents(N), frozen_agents(K), F is (N-K)/N.`,
    haskell: `activeFrac n k = fromIntegral (n-k) / fromIntegral n`,
    lean:    `def activeFrac (n k : ℕ) : Float := (n - k).toFloat / n.toFloat`,
    meaning: `Active agents: ${agentCount - frozenCount} / ${agentCount}. ${frozenCount > 0 ? `${frozenCount} frozen by Trust Deed enforcement.` : 'All agents operational.'}`,
  }),

  ({ tick, wormCount }) => ({
    lang:    'apl',
    expr:    `wormEntropy ← ≢worm ÷ tick  ⍝ ${wormCount} seals / ${tick} ticks`,
    prolog:  `worm_rate(R) :- worm_count(W), tick(T), T > 0, R is W/T.`,
    haskell: `wormRate w t = if t > 0 then fromIntegral w / fromIntegral t else 0`,
    lean:    `def wormRate (w t : ℕ) : Float := if t > 0 then w.toFloat / t.toFloat else 0`,
    meaning: `WORM ledger density: ${wormCount} entries over ${tick} ticks = ${tick > 0 ? (wormCount/tick).toFixed(2) : 0} seals/tick.`,
  }),

  ({ tick, totalResources }) => ({
    lang:    'apl',
    expr:    `civGDP ← +/resources  ⍝ ΣR=${totalResources.toFixed(0)} tick=${tick}`,
    prolog:  `civ_gdp(G) :- findall(R,agent_resources(_,R),Rs),sumlist(Rs,G).`,
    haskell: `civGDP = sum . map resources`,
    lean:    `def civGDP (ags : List Agent) : Float := ags.foldl (· + ·.resources) 0`,
    meaning: `Total civilization GDP: ${totalResources.toFixed(0)} resource units across all Uniprises.`,
  }),
];

// ── WORM seal ─────────────────────────────────────────────────────────────────
function seal(payload) {
  let prev = '0'.repeat(64);
  if (existsSync(WORM_F)) {
    const lines = readFileSync(WORM_F, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length > 0) {
      try { prev = JSON.parse(lines[lines.length-1]).seal; } catch {}
    }
  }
  return createHash('sha256').update(prev + JSON.stringify(payload)).digest('hex');
}

// ── Emit LISP envelope ────────────────────────────────────────────────────────
function emitEnvelope(formula, state, formulaIdx) {
  const ts   = new Date().toISOString();
  const tick = state.tick ?? 0;
  const raw  = {
    event:      'RESONANCE_BROADCAST',
    tick,
    formula_idx: formulaIdx,
    lang:       formula.lang,
    expr:       formula.expr,
    meaning:    formula.meaning,
    ts,
  };
  const wormSeal = seal(raw);
  raw.seal = wormSeal;

  // Write WORM
  appendFileSync(WORM_F, JSON.stringify(raw) + '\n', 'utf8');

  // Write to civ-chat feed so Vortex UI picks it up
  const chatEntry = {
    ts,
    a:       'RESONANCE',
    b:       'ALL',
    scenario: 'BROADCAST',
    msg_a:   `∑ ${formula.expr}`,
    msg_b:   formula.meaning,
    seal:    wormSeal,
  };
  appendFileSync(FEED_F, JSON.stringify(chatEntry) + '\n', 'utf8');

  // Build LISP S-expression
  const lisp = [
    `(broadcast RESONANCE ALL`,
    `  :formula "${formula.expr}"`,
    `  :lang    ${formula.lang}`,
    `  :prolog  "${formula.prolog}"`,
    `  :haskell "${formula.haskell}"`,
    `  :lean    "${formula.lean}"`,
    `  :meaning "${formula.meaning}"`,
    `  :tick    ${tick}`,
    `  :seal    "${wormSeal.slice(0,16)}...")`,
  ].join('\n');

  return { lisp, raw };
}

// ── Main ──────────────────────────────────────────────────────────────────────
function buildMetrics(state) {
  const agents     = Object.values(state.agents || {});
  const agentCount = agents.length || 15;
  const totalEnergy    = agents.reduce((s,a) => s + (a.energy    ?? 80), 0) || agentCount * 80;
  const totalResources = agents.reduce((s,a) => s + (a.resources ?? 50), 0) || agentCount * 50;
  const frozenCount    = agents.filter(a => a.frozen).length;
  const silences       = state.silences ?? 0;
  const actions        = state.actions  ?? 1;
  const wormCount      = state.worm_count ?? 0;
  const avgTrust       = agents.reduce((s,a) => s + (a.trust ?? 1.0), 0) / (agentCount || 1);
  const trustFloor     = 0.35;
  const alpha  = state.football?.score?.alpha ?? 0;
  const omega  = state.football?.score?.omega ?? 0;
  const tick   = state.tick ?? 0;
  return { tick, agentCount, totalEnergy, totalResources, frozenCount, silences, actions, wormCount, avgTrust, trustFloor, alpha, omega };
}

function pulse(formulaIdx) {
  const state   = getCivState();
  const metrics = buildMetrics(state);
  const idx     = formulaIdx !== undefined ? formulaIdx % FORMULAS.length : Math.floor(Math.random() * FORMULAS.length);
  const formula = FORMULAS[idx](metrics);
  const { lisp } = emitEnvelope(formula, state, idx);

  console.log('\n╔═ RESONANCE BROADCAST ═══════════════════════════════╗');
  console.log(lisp);
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  return { lisp, formula };
}

// CLI
const args  = process.argv.slice(2);
const watch = args.includes('--watch');
const fIdx  = args.includes('--formula') ? parseInt(args[args.indexOf('--formula')+1]) : undefined;

pulse(fIdx);

if (watch) {
  console.log('Resonance generator watching... (Ctrl+C to stop)');
  setInterval(() => pulse(), 60_000);
}
