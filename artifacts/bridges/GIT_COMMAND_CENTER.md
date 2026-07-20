# GIT COMMAND CENTER — Sovereign Repository Control

**Bridged into bob-ide artifact monorepo**

Cherry-picked from: https://github.com/SNAPKITTYWEST/git-command-center

---

## What It Is

Git Command Center is a centralized git operations hub for the SnapKitty sovereign stack:

- **WORM-sealed commit hooks** — every commit hashed + signed
- **Merkle-anchored branch history** — immutable history verification
- **Sovereign repository control** — git ops with governance
- **Evidence chain** — "Evidence or Silence" model for all commits

```
   ╔══════════════════════════════════════╗
   ║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║   GIT COMMAND CENTER
   ║  ░  $ git log --sovereign --worm   ░  ║   ──────────────────────────
   ║  ░                                 ░  ║   TYPE    Repository Control
   ║  ░  ├─ [WORM·SEALED] 7f3a1b9c     ░  ║           Sovereign Git Ops
   ║  ░  ├─ [WORM·SEALED] 2b9cf11e     ░  ║   HOOKS   Pre-commit WORM
   ║  ░  ├─ [WORM·SEALED] f11e4a2d     ░  ║   BRANCH  main · sealed
   ║  ░  ├─ [WORM·SEALED] 9c3b77fa     ░  ║   VERIFY  Merkle root check
   ║  ░  └─ [GENESIS]     2026-04-01   ░  ║
   ║  ░                                 ░  ║   "Every commit is
   ║  ░  HEAD  → sovereign/main         ░  ║    a sealed testimony.
   ║  ░  CHAIN → MERKLE: 0x4a9f7c3b…   ░  ║    Nothing forgotten."
   ║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║
   ╚══════════════════════════════════════╝
```

---

## Components

### 1. gitdos.js (JavaScript Engine)
Core git command parsing and execution:
- Command parsing (git status, git log, git push, etc.)
- WORM seal generation (Blake3 + Ed25519)
- Merkle tree computation
- Pre-commit hook integration
- Branch governance

### 2. gitdos.css (Styling)
DOS-inspired retro terminal:
- IBM PC color scheme (cyan, green, black)
- Scanline effect
- Text-shadow glow
- Fixed-width monospace font
- Responsive grid layout

### 3. git-command-center.html (UI)
Terminal emulator interface:
- Command input ($ prompt)
- Output display with scrollback
- Status bar (branch, HEAD, Merkle root)
- Real-time git operations
- WORM chain visualization

---

## Integration into bob-ide

### Files Copied
```
bob-ide/artifacts/bridges/
├── gitdos.js              ← Core engine
├── gitdos.css             ← Styling
└── git-command-center.html ← UI
```

### New React Component
```typescript
// src/components/git/GitCommandCenter.tsx
export function GitCommandCenter() {
  return (
    <div className="git-command-center">
      {/* Embed git-command-center.html */}
      {/* Connect to Omega shell /api/omega/run */}
      {/* Wire WORM attestation */}
    </div>
  );
}
```

### Backend Bridge
```typescript
// /api/git/command
POST /api/git/command {
  command: "git status"
}
→ Routed to Omega allowlist (git is allowed)
→ WORM seal on response
→ Return { stdout, stderr, code }
```

---

## Features

### WORM Sealing
Every git operation is sealed to WORM chain:
```javascript
const seal = blake3(commit_hash + timestamp);
const signature = ed25519_sign(seal);
```

### Merkle Root Verification
```javascript
const merkle_root = merkle_tree(all_commits);
verify(merkle_root, historical_root);
```

### Evidence-or-Silence Model
- **Evidence:** Operation succeeded, WORM-sealed
- **Silence:** Operation rejected, evidence chain broken

---

## Usage

### Command Syntax
```
$ git status
$ git log --sovereign --worm
$ git push origin main
$ git merge feature-branch
$ git commit -m "message"
```

### In bob-ide
```typescript
import { GitCommandCenter } from './components/git/GitCommandCenter';

export function App() {
  return (
    <div>
      <SovereignIDE />
      <GitCommandCenter />  {/* New: git control panel */}
      <OmegaShell />
    </div>
  );
}
```

### Programmatic API
```typescript
const result = await window.omegaIDE.execute('git status');
// Routes through Omega allowlist
// Git is in allowlist → allowed
// WORM-sealed response
```

---

## Security Model

### Pre-commit Hook
Every commit triggers WORM seal:
```javascript
// .git/hooks/pre-commit
const commit_hash = exec('git rev-parse --short HEAD');
const seal = blake3(commit_hash);
const sig = ed25519_sign(seal);
// Append to WORM chain
```

### Merkle Tree Verification
Before push:
```javascript
const current_root = compute_merkle_tree(commits);
const expected_root = fetch_historical_root();
if (current_root !== expected_root) {
  throw new Error('EVIDENCE CHAIN BROKEN');
}
```

### Branch Governance
Each branch has:
- **Owner:** who can merge
- **Approval:** how many reviewers
- **WORM root:** immutable history anchor

---

## Architecture

```
bob-ide/
├── artifacts/bridges/
│   ├── gitdos.js
│   ├── gitdos.css
│   ├── git-command-center.html
│   └── GIT_COMMAND_CENTER.md ← This file
│
├── src/components/git/
│   └── GitCommandCenter.tsx (NEW — wraps HTML)
│
└── backend/server.ts
    └── /api/git/command (routes to /api/omega/run)
```

---

## Next: Integration Steps

### Phase 1: Embed UI
```typescript
// src/components/git/GitCommandCenter.tsx
const response = await fetch('artifacts/bridges/git-command-center.html');
const html = await response.text();
return <div dangerouslySetInnerHTML={{ __html: html }} />;
```

### Phase 2: Wire Commands
```typescript
// In GitCommandCenter.tsx
window.omegaIDE.execute = async (cmd) => {
  if (cmd.startsWith('git ')) {
    // Route to /api/omega/run
    return fetch('/api/omega/run', { method: 'POST', body: JSON.stringify({ command: cmd }) });
  }
};
```

### Phase 3: WORM Integration
```typescript
// After each git command
const result = await window.omegaIDE.execute(cmd);
const seal = blake3(result.stdout);
await attestToWORM({ command: cmd, output: seal });
```

### Phase 4: sov-kernel-monster Bridge
```haskell
-- In QuantumPiper orchestration
verifyGitChain :: GitState -> Proof
verifyGitChain state = 
  merkleVerify (gitMerkleRoot state) ∧
  wormChainValid state ∧
  allCommitsSealed state
```

---

## Status

✅ **FILES CHERRY-PICKED**
- gitdos.js (core engine)
- gitdos.css (styling)
- git-command-center.html (UI)

🔄 **PENDING INTEGRATION**
- React wrapper component
- Omega shell routing
- WORM attestation
- sov-kernel-monster bridge

---

## References

- **Repository:** https://github.com/SNAPKITTYWEST/git-command-center
- **License:** Sovereign Source License v1.0
- **Author:** Ahmad Ali Parr
- **Seal:** Ω↺Ψ↺Δ↺Λ↺Σ↺Φ↺α

---

**Integration Date:** 2026-07-20  
**Status:** CHERRY-PICKED INTO MONOREPO  
**Owner:** SNAPKITTYWEST (Jessica)
