/**
 * OMEGA BOTTOM SHELL INTEGRATION
 * Connects REXX-based Omega shell to bob-ide backend
 *
 * Bridge contract:
 * window.omegaIDE.execute(command) => Promise<{ stdout, stderr, code }>
 */

import React, { useEffect, useRef } from 'react';

interface OmegaResult {
  stdout: string;
  stderr: string;
  code: number;
}

export function OmegaShell() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inject Omega shell HTML + CSS + init script
    injectOmegaShell();

    // Bind IDE execution bridge
    if (typeof window !== 'undefined') {
      (window as any).omegaIDE = {
        execute: executeCommand,
      };
    }

    return () => {
      // Cleanup
      if (typeof window !== 'undefined') {
        delete (window as any).omegaIDE;
      }
    };
  }, []);

  async function executeCommand(cmd: string): Promise<OmegaResult> {
    try {
      // Route to backend REXX executor
      const response = await fetch('/api/omega/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });

      if (!response.ok) {
        return {
          stdout: '',
          stderr: `HTTP ${response.status}`,
          code: response.status,
        };
      }

      const result = await response.json();
      return {
        stdout: result.output || '',
        stderr: result.error || '',
        code: result.exitCode || 0,
      };
    } catch (e: any) {
      return {
        stdout: '',
        stderr: `Bridge error: ${e.message}`,
        code: 1,
      };
    }
  }

  function injectOmegaShell() {
    // CSS
    const css = `
.omega-shell {
  --omega-bg: #020706;
  --omega-panel: rgba(4, 18, 17, .96);
  --omega-line: rgba(70, 255, 214, .22);
  --omega-cyan: #64ffe3;
  --omega-green: #58ff92;
  --omega-blue: #4cb8ff;
  --omega-muted: #71958f;
  --omega-danger: #ff5470;
  position: fixed;
  inset: auto 0 0 0;
  height: min(38vh, 430px);
  min-height: 190px;
  display: grid;
  grid-template-rows: 34px 1fr 42px;
  color: #d9fff8;
  background:
    radial-gradient(circle at 72% 0%, rgba(28, 114, 109, .19), transparent 36%),
    linear-gradient(180deg, rgba(2, 9, 9, .88), var(--omega-panel));
  border-top: 1px solid var(--omega-line);
  box-shadow: 0 -18px 60px rgba(0,0,0,.58), inset 0 1px rgba(255,255,255,.025);
  backdrop-filter: blur(18px) saturate(125%);
  font: 500 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  z-index: 2147483000;
}
.omega-shell::before {
  content: ""; position:absolute; inset:0; pointer-events:none; opacity:.17;
  background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(100,255,227,.08) 4px);
}
.omega-bar {
  display:flex; align-items:center; gap:10px; padding:0 12px;
  border-bottom:1px solid var(--omega-line);
}
.omega-mark {
  color:var(--omega-cyan); font-weight:900;
  letter-spacing:.08em; text-shadow:0 0 16px rgba(100,255,227,.65);
}
.omega-state {
  color:var(--omega-green); font-size:11px;
  letter-spacing:.12em;
}
.omega-spacer { flex:1; }
.omega-chip {
  border:1px solid var(--omega-line); border-radius:999px;
  padding:2px 8px; color:var(--omega-muted); font-size:10px;
}
.omega-output {
  overflow:auto; padding:12px 14px 20px;
  scrollbar-color:#266b61 transparent;
}
.omega-line {
  white-space:pre-wrap; overflow-wrap:anywhere;
  margin-bottom: 4px;
}
.omega-line[data-kind="system"] { color:var(--omega-cyan); }
.omega-line[data-kind="ok"] { color:var(--omega-green); }
.omega-line[data-kind="error"] { color:var(--omega-danger); }
.omega-input-row {
  display:grid; grid-template-columns:auto 1fr auto;
  align-items:center; gap:9px; padding:7px 12px;
  border-top:1px solid var(--omega-line);
  background:rgba(0,0,0,.2);
}
.omega-prompt {
  color:var(--omega-green); font-weight:800;
}
.omega-input {
  width:100%; border:0; outline:0; color:#effffb;
  background:transparent; font:inherit; caret-color:var(--omega-cyan);
}
.omega-run {
  border:1px solid rgba(100,255,227,.3); border-radius:7px;
  padding:5px 11px; color:var(--omega-cyan);
  background:rgba(27,104,94,.14); cursor:pointer;
  font-weight: 600;
}
.omega-run:hover {
  background:rgba(27,104,94,.3);
  box-shadow:0 0 20px rgba(100,255,227,.12);
}
@media (max-width: 720px) {
  .omega-shell { height:44vh; }
  .omega-chip:nth-of-type(2) { display:none; }
}
    `;

    // HTML
    const html = `
<section class="omega-shell" id="omega-shell" aria-label="Omega command shell">
  <header class="omega-bar">
    <strong class="omega-mark">Ω OMEGA SHELL</strong>
    <span class="omega-state">EVIDENCE OR SILENCE</span>
    <span class="omega-spacer"></span>
    <span class="omega-chip">BOB-IDE</span>
    <span class="omega-chip" id="omega-mode">GUARDED · WORM</span>
  </header>
  <main class="omega-output" id="omega-output" role="log" aria-live="polite">
    <div class="omega-line" data-kind="system">[Ω] Omega bottom shell mounted on bob-ide.</div>
    <div class="omega-line">[policy] commands require the allowlist (git, grep, curl, bash, etc.)</div>
    <div class="omega-line">[worm] all executions sealed to immutable ledger.</div>
  </main>
  <form class="omega-input-row" id="omega-form">
    <label class="omega-prompt" for="omega-input">Ω›</label>
    <input class="omega-input" id="omega-input" autocomplete="off" spellcheck="false" placeholder="git status" />
    <button class="omega-run" type="submit">EXECUTE</button>
  </form>
</section>
    `;

    // Inject CSS
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // Inject HTML
    const shellEl = document.createElement('div');
    shellEl.innerHTML = html;
    document.body.appendChild(shellEl);

    // Bind handlers
    const form = document.querySelector('#omega-form') as HTMLFormElement;
    const input = document.querySelector('#omega-input') as HTMLInputElement;
    const output = document.querySelector('#omega-output') as HTMLElement;

    const append = (text: string, kind: string = '') => {
      const line = document.createElement('div');
      line.className = 'omega-line';
      if (kind) line.setAttribute('data-kind', kind);
      line.textContent = text;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const command = input.value.trim();
      if (!command) return;

      append(`Ω› ${command}`, 'system');
      input.value = '';

      try {
        if (!(window as any).omegaIDE?.execute) {
          throw new Error('IDE bridge not initialized');
        }

        const result = await (window as any).omegaIDE.execute(command);

        if (result.stdout) {
          append(result.stdout, result.code === 0 ? 'ok' : 'error');
        }
        if (result.stderr) {
          append(`[error] ${result.stderr}`, 'error');
        }
        if (result.code !== 0) {
          append(`[exit code: ${result.code}]`, 'error');
        }
      } catch (error: any) {
        append(`[SILENCE] ${error.message}`, 'error');
      }
    });
  }

  return (
    <div ref={containerRef}>
      {/* Omega shell is injected into document.body via useEffect */}
    </div>
  );
}

/**
 * USAGE IN APP:
 *
 * import { OmegaShell } from './components/terminal/OmegaShell';
 *
 * export function App() {
 *   return (
 *     <div>
 *       {/* Your main IDE content */}
 *       <SovereignIDE />
 *
 *       {/* Omega shell at bottom */}
 *       <OmegaShell />
 *     </div>
 *   );
 * }
 */
