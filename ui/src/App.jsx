import { useState, useRef, useEffect } from 'react'
import './App.css'

// Floating animation keyframes
const floatKeyframes = `
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}
@keyframes shim {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`

// NAND Gate Component
function NANDGate({ x, y, id, onDrag, selected, onSelect }) {
  return (
    <div
      className={`absolute w-12 h-12 ${selected ? 'bg-cyan-400 scale-110' : 'bg-cyan-400/80'} rounded-lg cursor-grab active:cursor-grabbing flex items-center justify-center text-black font-bold text-[10px] shadow-[0_0_8px_rgba(34,211,238,0.8)] hover:brightness-110 transition`}
      style={{ left: x, top: y }}
      onClick={() => onSelect(id)}
      draggable
    >
      NAND
    </div>
  )
}

// Agent Node Component
function AgentNode({ x, y, id, entropy, trusted, active, onSelect, selected }) {
  const valid = entropy === 0 && active === trusted
  return (
    <div
      className={`absolute w-14 h-14 ${valid ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]' : 'bg-pink-200/70'} rounded-full cursor-grab active:cursor-grabbing flex flex-col items-center justify-center text-black text-[8px] font-bold hover:brightness-110 transition ${selected ? 'scale-110' : ''}`}
      style={{ left: x, top: y }}
      onClick={() => onSelect(id)}
      draggable
    >
      <div className="text-[14px]">⚙</div>
      <div>E={entropy.toFixed(1)}</div>
      <div className="text-[6px]">{active === trusted ? '✓' : '✗'}</div>
    </div>
  )
}

// Proof Badge Component
function ProofBadge({ x, y, id, verified, onSelect, selected }) {
  return (
    <div
      className={`absolute w-10 h-10 ${verified ? 'bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'} rounded-[6px] cursor-grab flex items-center justify-center text-[14px] hover:brightness-110 transition ${selected ? 'scale-110' : ''}`}
      style={{ left: x, top: y }}
      onClick={() => onSelect(id)}
      draggable
    >
      {verified ? '🔐' : '⚠'}
    </div>
  )
}

// Connection Line
function Connection({ from, to, type }) {
  const colors = {
    nand: 'rgba(34,211,238,0.4)',
    agent: 'rgba(52,211,153,0.4)',
    proof: 'rgba(139,92,246,0.4)',
  }
  return (
    <line
      x1={from.x + 24}
      y1={from.y + 24}
      x2={to.x + 24}
      y2={to.y + 24}
      stroke={colors[type] || colors.nand}
      strokeWidth="2"
      className="animate-pulse"
    />
  )
}

// Floating Background Orb
function BackgroundOrb({ x, y, color, size, delay }) {
  return (
    <div
      className={`absolute rounded-full blur opacity-20 pointer-events-none`}
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)`,
        animation: `float ${11 + delay}s ease-in-out infinite`,
      }}
    />
  )
}

// Main App
export default function App() {
  const [gates, setGates] = useState([
    { type: 'nand', x: 120, y: 180, id: 'g1' },
    { type: 'nand', x: 280, y: 220, id: 'g2' },
  ])

  const [agents, setAgents] = useState([
    { x: 420, y: 160, id: 'a1', entropy: 0, trusted: true, active: true },
    { x: 560, y: 200, id: 'a2', entropy: 0.3, trusted: true, active: false },
    { x: 700, y: 180, id: 'a3', entropy: 0, trusted: true, active: true },
  ])

  const [proofs, setProofs] = useState([
    { x: 840, y: 160, id: 'p1', verified: true },
    { x: 980, y: 200, id: 'p2', verified: false },
  ])

  const [connections] = useState([
    { from: { x: 120, y: 180 }, to: { x: 280, y: 220 }, type: 'nand' },
    { from: { x: 280, y: 220 }, to: { x: 420, y: 160 }, type: 'agent' },
    { from: { x: 560, y: 200 }, to: { x: 840, y: 160 }, type: 'proof' },
  ])

  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('canvas') // 'canvas' | 'console' | 'spec'
  const canvasRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - 24
    const y = e.clientY - rect.top - 24
    const gateType = e.dataTransfer.getData('gate')

    if (gateType === 'nand') {
      setGates([...gates, { type: 'nand', x, y, id: `g${Date.now()}` }])
    } else if (gateType === 'agent') {
      setAgents([...agents, { x, y, id: `a${Date.now()}`, entropy: 0, trusted: true, active: true }])
    } else if (gateType === 'proof') {
      setProofs([...proofs, { x, y, id: `p${Date.now()}`, verified: false }])
    }
  }

  const validAgents = agents.filter(a => a.entropy === 0 && a.active === a.trusted).length
  const verifiedProofs = proofs.filter(p => p.verified).length
  const entropyCheck = agents.every(a => a.entropy === 0)
  const trustCheck = agents.every(a => a.active === a.trusted)

  return (
    <div className="min-h-screen bg-[#05070A] text-white font-[Inter] overflow-hidden">
      <style>{floatKeyframes}</style>

      {/* Background Orbs */}
      <BackgroundOrb x="-120px" y="-200px" color="#7c3aed" size="400px" delay={0} />
      <BackgroundOrb x="right-[-80px]" y="top-[10%]" color="#22d3ee" size="350px" delay={1} />
      <BackgroundOrb x="left-[35%]" y="bottom-[-80px]" color="#06ffa5" size="380px" delay={2} />

      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-sm bg-[#05070A]/80 border-b border-white/5">
        <div className="max-w-[1920px] mx-auto px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Window Controls */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F57]"></div>
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
              <div className="w-3 h-3 rounded-full bg-[#28C840]"></div>
              <div className="ml-4 text-white/80 text-[11px] font-bold tracking-widest">
                HYPERKITTY CONSTRAINT DSL
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-cyan-500/20 border border-cyan-400/20 rounded-[8px] text-cyan-200 text-[10px] font-semibold">
                {gates.length} NAND Gates
              </div>
              <div className={`px-3 py-1 ${validAgents === agents.length ? 'bg-emerald-500/20 border-emerald-400/30' : 'bg-pink-500/20 border-pink-400/30'} border rounded-[8px] text-${validAgents === agents.length ? 'emerald' : 'pink'}-200 text-[10px] font-semibold`}>
                {validAgents}/{agents.length} Valid Agents
              </div>
              <div className="px-3 py-1 bg-violet-500/20 border border-violet-400/30 rounded-[8px] text-violet-200 text-[10px] font-semibold">
                {verifiedProofs}/{proofs.length} Proofs
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center gap-1 bg-white/5 rounded-[10px] p-1">
              {['canvas', 'console', 'spec'].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wide transition ${mode === m ? 'bg-violet-500/30 text-violet-100' : 'text-white/40 hover:text-white/70'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-4 lg:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_360px] gap-3">
          {/* Left Sidebar - Toolbox */}
          <div className="space-y-3">
            <div className="bg-white/[0.04] border border-white/5 rounded-[14px] p-3">
              <div className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">
                Components
              </div>
              <div className="space-y-2">
                <div
                  className="px-4 py-2 bg-cyan-400/15 border border-cyan-300/30 rounded-[12px] text-cyan-100 text-[11px] font-bold cursor-grab active:cursor-grabbing hover:bg-cyan-500/20 transition flex items-center gap-2"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('gate', 'nand')}
                >
                  <span>+</span> NAND Gate
                </div>
                <div
                  className="px-4 py-2 bg-emerald-500/10 border border-emerald-300/20 rounded-[12px] text-emerald-200 text-[11px] font-bold cursor-grab active:cursor-grabbing hover:bg-emerald-500/20 transition flex items-center gap-2"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('gate', 'agent')}
                >
                  <span>+</span> Agent Node
                </div>
                <div
                  className="px-4 py-2 bg-violet-500/15 border border-violet-400/20 rounded-[12px] text-violet-100 text-[11px] font-bold cursor-grab active:cursor-grabbing hover:bg-violet-500/20 transition flex items-center gap-2"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('gate', 'proof')}
                >
                  <span>+</span> Proof Badge
                </div>
              </div>
            </div>

            {/* Validation Panel */}
            <div className="bg-white/[0.04] border border-white/5 rounded-[14px] p-3">
              <div className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">
                Invariants
              </div>
              <div className="space-y-1.5">
                <div className={`flex items-center justify-between px-2 py-1.5 rounded-[6px] ${entropyCheck ? 'bg-emerald-500/10 text-emerald-300' : 'bg-pink-500/10 text-pink-300'} text-[10px]`}>
                  <span>Entropy = 0</span>
                  <span>{entropyCheck ? '✓' : '✗'}</span>
                </div>
                <div className={`flex items-center justify-between px-2 py-1.5 rounded-[6px] ${trustCheck ? 'bg-emerald-500/10 text-emerald-300' : 'bg-pink-500/10 text-pink-300'} text-[10px]`}>
                  <span>Active ⟺ Trusted</span>
                  <span>{trustCheck ? '✓' : '✗'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Canvas */}
          <div className="relative">
            {mode === 'canvas' && (
              <div
                ref={canvasRef}
                className="relative w-full h-[640px] bg-[#080A0F] rounded-[20px] border border-white/10 overflow-hidden"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {/* Grid Background */}
                <div className="absolute inset-0 opacity-10">
                  <div className="grid grid-cols-[repeat(40,minmax(0,1fr))] h-full">
                    {[...Array(1600)].map((_, i) => (
                      <div key={i} className="border-r border-b border-white/5"></div>
                    ))}
                  </div>
                </div>

                {/* SVG Connections */}
                <svg className="absolute inset-0 pointer-events-none">
                  {connections.map((conn, i) => (
                    <Connection key={i} {...conn} />
                  ))}
                </svg>

                {/* Render Elements */}
                {gates.map(gate => (
                  <NANDGate
                    key={gate.id}
                    {...gate}
                    selected={selected === gate.id}
                    onSelect={setSelected}
                  />
                ))}
                {agents.map(agent => (
                  <AgentNode
                    key={agent.id}
                    {...agent}
                    selected={selected === agent.id}
                    onSelect={setSelected}
                  />
                ))}
                {proofs.map(proof => (
                  <ProofBadge
                    key={proof.id}
                    {...proof}
                    selected={selected === proof.id}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            )}

            {mode === 'console' && (
              <div className="w-full h-[640px] bg-[#080A0F] rounded-[20px] border border-white/10 p-4 overflow-auto">
                <div className="font-mono text-[11px] text-emerald-300 space-y-1">
                  <div className="text-white/50">$ hyperkitty validate</div>
                  <div>→ Parsing constraint spec...</div>
                  <div>→ Building NAND kernel...</div>
                  <div>→ Validating {agents.length} agents...</div>
                  <div className={entropyCheck && trustCheck ? 'text-emerald-300' : 'text-pink-300'}>
                    {entropyCheck && trustCheck ? '✓ All invariants satisfied' : '✗ Constraint violations detected'}
                  </div>
                  <div className="text-white/50 mt-3">$ hyperkitty export --format ocaml</div>
                  <div>→ Generating HOL Light proofs...</div>
                  <div>→ Extracting verified OCaml...</div>
                  <div>→ Building static library...</div>
                  <div className="text-cyan-300">✓ libhyperkitty.cmxa</div>
                </div>
              </div>
            )}

            {mode === 'spec' && (
              <div className="w-full h-[640px] bg-[#080A0F] rounded-[20px] border border-white/10 p-4 overflow-auto">
                <pre className="font-mono text-[10px] text-white/70 whitespace-pre-wrap">
{`<?xml version="1.0"?>
<HyperKittyConstraintDSL version="1.0">
  <Meta>
    <System>HK-OS</System>
    <Mode>DETERMINISTIC-CONSTRAINT-BUILD</Mode>
  </Meta>

  <BooleanKernel>
    <Primitive name="NAND">NAND(a,b) = 1 - a*b</Primitive>
    <Derived name="NOT">NAND(x,x)</Derived>
    <Derived name="AND">NAND(NAND(a,b), NAND(a,b))</Derived>
  </BooleanKernel>

  <AgentModel>
    <Invariant>entropy(agent) = 0</Invariant>
    <Invariant>active(agent) ⟺ trusted(agent)</Invariant>
  </AgentModel>
</HyperKittyConstraintDSL>`}
                </pre>
              </div>
            )}
          </div>

          {/* Right Sidebar - Inspector */}
          <div className="space-y-3">
            <div className="bg-white/[0.04] border border-white/5 rounded-[14px] p-3">
              <div className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">
                Inspector
              </div>
              {selected ? (
                <div className="text-[10px] text-white/70 space-y-1">
                  <div>Selected: {selected}</div>
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <button className="w-full px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-[6px] text-[10px] font-bold transition">
                      Edit Properties
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-white/40">
                  Select an element to inspect
                </div>
              )}
            </div>

            {/* Export */}
            <div className="bg-white/[0.04] border border-white/5 rounded-[14px] p-3">
              <div className="text-[11px] font-bold text-white/50 uppercase tracking-widests mb-2">
                Export
              </div>
              <div className="space-y-2">
                <button className="w-full px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 rounded-[8px] text-violet-100 text-[10px] font-bold transition">
                  OCaml (.cmxa)
                </button>
                <button className="w-full px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/5 rounded-[8px] text-white/70 text-[10px] font-bold transition">
                  XML Spec
                </button>
                <button className="w-full px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/5 rounded-[8px] text-white/70 text-[10px] font-bold transition">
                  HOL Light
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
