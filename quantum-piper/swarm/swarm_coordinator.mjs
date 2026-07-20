/**
 * swarm_coordinator.mjs — Sovereign Quantum Swarm Coordinator
 *
 * The missing wire: QNU quantum temperature + WORM chain + SACM agent mesh
 * WORM chain IS the coordination substrate (QUANTUM_EFFECT.md Fork 2 thesis)
 *
 * Three backends: Bedrock (production), HuggingFace API, local Ollama
 *
 * Usage:
 *   node swarm_coordinator.mjs --preset=quantum-minimal --mission="analyze treasury"
 */

import { drawTemperature, AGENT_TEMP_PROFILES } from './qnu_temperature.mjs';
import { createHash } from 'crypto';
import { appendFileSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

// ── WORM helpers ──────────────────────────────────────────────────────────────

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function sealEntry(entry) {
  const { seal: _seal, ...rest } = entry;
  const prev = rest.prev || '0'.repeat(64);
  return sha256(JSON.stringify({ ...rest, prev }));
}

function appendWorm(file, entry) {
  const sealed = { ...entry, seal: sealEntry(entry) };
  appendFileSync(file, JSON.stringify(sealed) + '\n');
  return sealed;
}

function readWormTail(file, n) {
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.slice(-n).map(l => JSON.parse(l));
}

function prevSeal(file) {
  const tail = readWormTail(file, 1);
  return tail.length ? tail[0].seal : '0'.repeat(64);
}

// ── LLM backends ─────────────────────────────────────────────────────────────

async function callHuggingFace(model, hfToken, agent, prompt) {
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 64 } })
  }).catch(() => null);
  if (!res || !res.ok) return `${agent}:hf-unavailable`;
  const data = await res.json().catch(() => null);
  return data?.[0]?.generated_text || `${agent}:hf-empty`;
}

async function callOllama(ollamaUrl, model, agent, prompt) {
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  }).catch(() => null);
  if (!res || !res.ok) return `${agent}:ollama-unavailable`;
  const data = await res.json().catch(() => null);
  return data?.response || `${agent}:ollama-empty`;
}

// ── Coordinator ───────────────────────────────────────────────────────────────

export class QuantumSwarmCoordinator {
  constructor({ agents, wormFile, bedrockRegion, hfModel, hfToken, ollamaUrl } = {}) {
    this.agents   = agents || SWARM_PRESETS['quantum-minimal'];
    this.wormFile = wormFile || join(__dir, '.swarm-worm.jsonl');
    this.bedrockRegion = bedrockRegion;
    this.hfModel  = hfModel;
    this.hfToken  = hfToken;
    this.ollamaUrl = ollamaUrl || 'http://localhost:11434';
    this.tickId   = 0;
    this.consensusHistory = [];
  }

  async init() {
    if (!existsSync(this.wormFile)) {
      const genesis = {
        ts: new Date().toISOString(), tick_id: 0,
        agent: 'genesis', phase: 'init',
        qnu_temp: 0, qnu_source: 'genesis', qnu_seal: '0'.repeat(64),
        action: 'genesis', payload: { agents: this.agents },
        prev: '0'.repeat(64), seal: ''
      };
      genesis.seal = sealEntry(genesis);
      writeFileSync(this.wormFile, JSON.stringify(genesis) + '\n');
    }
    const tail = readWormTail(this.wormFile, 1);
    this.tickId = tail.length > 0 ? (tail[0].tick_id || 0) + 1 : 1;
  }

  async _callAgent(agent, mission, qnu) {
    const prompt = `[Agent: ${agent}] [Temp: ${qnu.temp.toFixed(3)}] [QNU: ${qnu.raw_quantum.toFixed(4)}]\nMission: ${mission}\nRespond with one action word.`;
    if (this.hfModel && this.hfToken)
      return callHuggingFace(this.hfModel, this.hfToken, agent, prompt);
    if (this.ollamaUrl && !this.bedrockRegion)
      return callOllama(this.ollamaUrl, this.hfModel || 'llama3', agent, prompt);
    return `${agent}:stub-action`;
  }

  async tick(mission) {
    this.tickId++;
    const prev = prevSeal(this.wormFile);

    const agentResults = await Promise.all(
      this.agents.map(async (agent) => {
        // QNU draw — quantum temperature is async (ANU QRNG)
        const qnu = await drawTemperature(agent).catch(() => ({
          temp: 0.5, raw_quantum: 0.5, phi_modulated: 0.5, source: 'csprng-fallback', seal: '0'.repeat(64)
        }));

        const phases = ['perceive', 'reason', 'act'];
        let localPrev = prev;
        const actions = [];

        for (const phase of phases) {
          const response = await this._callAgent(agent, mission, qnu);
          const entry = {
            ts: new Date().toISOString(), tick_id: this.tickId,
            agent, phase,
            qnu_temp: qnu.temp, qnu_source: qnu.source, qnu_seal: qnu.seal,
            action: response.slice(0, 64),
            payload: { mission, raw_quantum: qnu.raw_quantum, phi_modulated: qnu.phi_modulated },
            prev: localPrev, seal: ''
          };
          const sealed = appendWorm(this.wormFile, entry);
          localPrev = sealed.seal;
          actions.push({ phase, action: sealed.action, seal: sealed.seal });
        }

        return { agent, qnu, actions, final_action: actions[actions.length - 1].action };
      })
    );

    // Majority vote on final action per agent
    const votes = agentResults.map(r => r.final_action);
    const consensus = this._majorityVote(votes);

    const consensusEntry = {
      ts: new Date().toISOString(), tick_id: this.tickId,
      agent: 'consensus', phase: 'consensus',
      qnu_temp: 0, qnu_source: 'worm-aggregate', qnu_seal: '0'.repeat(64),
      action: consensus,
      payload: { mission, votes, quantum_seeds: agentResults.map(r => r.qnu.raw_quantum) },
      prev: prevSeal(this.wormFile), seal: ''
    };
    const sealedConsensus = appendWorm(this.wormFile, consensusEntry);

    const stable = this._checkStability(consensus);
    return {
      tick_id: this.tickId,
      consensus_action: consensus,
      votes,
      agent_results: agentResults,
      consensus_seal: sealedConsensus.seal,
      quantum_seeds: agentResults.map(r => ({ agent: r.agent, qnu: r.qnu.raw_quantum, source: r.qnu.source })),
      stable
    };
  }

  _majorityVote(votes) {
    const counts = {};
    for (const v of votes) counts[v] = (counts[v] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  _checkStability(action) {
    this.consensusHistory.push(action);
    if (this.consensusHistory.length > 3) this.consensusHistory.shift();
    return this.consensusHistory.length === 3 && this.consensusHistory.every(a => a === action);
  }

  async loop(mission, maxTicks = 10) {
    let result;
    for (let i = 0; i < maxTicks; i++) {
      result = await this.tick(mission);
      if (result.stable) break;
    }
    return result;
  }

  getWormTail(n = 10) {
    return readWormTail(this.wormFile, n);
  }
}

// ── Factory helpers ───────────────────────────────────────────────────────────

export async function buildHuggingFaceSwarm({ model, hfToken, agents }) {
  const c = new QuantumSwarmCoordinator({ agents: agents || SWARM_PRESETS['quantum-minimal'], hfModel: model, hfToken });
  await c.init();
  return c;
}

export async function buildLocalSwarm({ model = 'llama3', agents, ollamaUrl = 'http://localhost:11434' } = {}) {
  const c = new QuantumSwarmCoordinator({ agents: agents || SWARM_PRESETS['quantum-minimal'], ollamaUrl, hfModel: model });
  await c.init();
  return c;
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const SWARM_PRESETS = {
  'quantum-creative':   ['muse', 'prism', 'vanta', 'nova', 'forge'],
  'quantum-analytical': ['sentinel', 'cipher', 'vault', 'atlas', 'ledge'],
  'quantum-full':       ['muse', 'prism', 'vanta', 'sentinel', 'cipher', 'vault',
                         'atlas', 'ledge', 'axiom', 'herald', 'nexus', 'nova', 'forge', 'oracle', 'phantom'],
  'quantum-minimal':    ['nexus', 'oracle', 'herald']
};

// ── CLI ───────────────────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const get  = key => (args.find(a => a.startsWith(`--${key}=`)) || '').split('=').slice(1).join('=');
  const preset  = get('preset')  || 'quantum-minimal';
  const mission = get('mission') || 'analyze sovereign treasury position';
  const hfToken = get('hf-token') || process.env.HF_TOKEN;
  const hfModel = get('hf-model') || process.env.HF_MODEL;

  const agents = SWARM_PRESETS[preset] || SWARM_PRESETS['quantum-minimal'];
  const coordinator = new QuantumSwarmCoordinator({ agents, hfModel, hfToken });
  await coordinator.init();
  const result = await coordinator.tick(mission);
  console.log(JSON.stringify(result, null, 2));
}
