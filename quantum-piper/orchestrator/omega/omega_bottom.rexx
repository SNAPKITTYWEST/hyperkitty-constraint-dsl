/* REXX ---------------------------------------------------------------
   OMEGA BOTTOM SHELL
   Generates an IDE-ready bottom terminal panel and optionally executes
   guarded local commands through ADDRESS SYSTEM.
--------------------------------------------------------------------- */

parse arg action rest
if action = '' then action = 'build'

outDir = value('OMEGA_OUT_DIR',, 'ENVIRONMENT')
if outDir = '' then outDir = '.'

select
  when translate(action) = 'BUILD' then call BuildAssets outDir
  when translate(action) = 'RUN' then call RunGuarded rest
  when translate(action) = 'HELP' then call Usage
  otherwise do
    say '[OMEGA] unknown action:' action
    call Usage
    exit 2
  end
end
exit 0

BuildAssets: procedure
  parse arg dir
  cssFile = dir || '/omega-shell.css'
  htmlFile = dir || '/omega-shell.html'

  call stream cssFile, 'c', 'open write replace'
  call lineout cssFile, CssText()
  call stream cssFile, 'c', 'close'

  call stream htmlFile, 'c', 'open write replace'
  call lineout htmlFile, HtmlText()
  call stream htmlFile, 'c', 'close'

  say '[OMEGA] generated:' cssFile
  say '[OMEGA] generated:' htmlFile
return

RunGuarded: procedure
  parse arg raw
  raw = strip(raw)
  if raw = '' then do
    say '[OMEGA] no command supplied'
    exit 2
  end

  /* Keep this allowlist narrow. Expand only through reviewed policy. */
  first = translate(word(raw, 1))
  allowed = 'PWD LS DIR GIT CARGO LAKE DUNE DOTNET NIM JQ MAKE CMAKE CLANG LLVM-OBJDUMP LLVM-READOBJ QEMU-SYSTEM-X86_64'

  if wordpos(first, allowed) = 0 then do
    say '[OMEGA:SILENCE] command rejected by allowlist:' first
    exit 77
  end

  if pos('&&', raw) > 0 | pos('||', raw) > 0 | pos(';', raw) > 0 | pos('>', raw) > 0 | pos('<', raw) > 0 then do
    say '[OMEGA:SILENCE] shell metacharacters rejected'
    exit 77
  end

  say '[OMEGA:EXEC]' raw
  address system raw
  rcx = rc
  say '[OMEGA:RC]' rcx
  exit rcx
return

Usage:
  say 'OMEGA BOTTOM SHELL'
  say '  rexx omega_bottom.rexx build'
  say '  rexx omega_bottom.rexx run "git status"'
  say '  OMEGA_OUT_DIR=./ui rexx omega_bottom.rexx build'
return

CssText: procedure
return '.omega-shell {' || '0a'x ||,
'  --omega-bg: #020706;' || '0a'x ||,
'  --omega-panel: rgba(4, 18, 17, .96);' || '0a'x ||,
'  --omega-line: rgba(70, 255, 214, .22);' || '0a'x ||,
'  --omega-cyan: #64ffe3;' || '0a'x ||,
'  --omega-green: #58ff92;' || '0a'x ||,
'  --omega-blue: #4cb8ff;' || '0a'x ||,
'  --omega-muted: #71958f;' || '0a'x ||,
'  --omega-danger: #ff5470;' || '0a'x ||,
'  position: fixed;' || '0a'x ||,
'  inset: auto 0 0 0;' || '0a'x ||,
'  height: min(38vh, 430px);' || '0a'x ||,
'  min-height: 190px;' || '0a'x ||,
'  display: grid;' || '0a'x ||,
'  grid-template-rows: 34px 1fr 42px;' || '0a'x ||,
'  color: #d9fff8;' || '0a'x ||,
'  background:' || '0a'x ||,
'    radial-gradient(circle at 72% 0%, rgba(28, 114, 109, .19), transparent 36%),' || '0a'x ||,
'    linear-gradient(180deg, rgba(2, 9, 9, .88), var(--omega-panel));' || '0a'x ||,
'  border-top: 1px solid var(--omega-line);' || '0a'x ||,
'  box-shadow: 0 -18px 60px rgba(0,0,0,.58), inset 0 1px rgba(255,255,255,.025);' || '0a'x ||,
'  backdrop-filter: blur(18px) saturate(125%);' || '0a'x ||,
'  font: 500 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;' || '0a'x ||,
'  z-index: 2147483000;' || '0a'x ||,
'}' || '0a'x ||,
'.omega-shell::before {' || '0a'x ||,
'  content: ""; position:absolute; inset:0; pointer-events:none; opacity:.17;' || '0a'x ||,
'  background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(100,255,227,.08) 4px);' || '0a'x ||,
'}' || '0a'x ||,
'.omega-bar { display:flex; align-items:center; gap:10px; padding:0 12px; border-bottom:1px solid var(--omega-line); }' || '0a'x ||,
'.omega-mark { color:var(--omega-cyan); font-weight:900; letter-spacing:.08em; text-shadow:0 0 16px rgba(100,255,227,.65); }' || '0a'x ||,
'.omega-state { color:var(--omega-green); font-size:11px; letter-spacing:.12em; }' || '0a'x ||,
'.omega-spacer { flex:1; }' || '0a'x ||,
'.omega-chip { border:1px solid var(--omega-line); border-radius:999px; padding:2px 8px; color:var(--omega-muted); font-size:10px; }' || '0a'x ||,
'.omega-output { overflow:auto; padding:12px 14px 20px; scrollbar-color:#266b61 transparent; }' || '0a'x ||,
'.omega-line { white-space:pre-wrap; overflow-wrap:anywhere; }' || '0a'x ||,
'.omega-line[data-kind="system"] { color:var(--omega-cyan); }' || '0a'x ||,
'.omega-line[data-kind="ok"] { color:var(--omega-green); }' || '0a'x ||,
'.omega-line[data-kind="error"] { color:var(--omega-danger); }' || '0a'x ||,
'.omega-input-row { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:9px; padding:7px 12px; border-top:1px solid var(--omega-line); background:rgba(0,0,0,.2); }' || '0a'x ||,
'.omega-prompt { color:var(--omega-green); font-weight:800; }' || '0a'x ||,
'.omega-input { width:100%; border:0; outline:0; color:#effffb; background:transparent; font:inherit; caret-color:var(--omega-cyan); }' || '0a'x ||,
'.omega-run { border:1px solid rgba(100,255,227,.3); border-radius:7px; padding:5px 11px; color:var(--omega-cyan); background:rgba(27,104,94,.14); cursor:pointer; }' || '0a'x ||,
'.omega-run:hover { background:rgba(27,104,94,.3); box-shadow:0 0 20px rgba(100,255,227,.12); }' || '0a'x ||,
'@media (max-width: 720px) { .omega-shell { height:44vh; } .omega-chip:nth-of-type(2) { display:none; } }'

HtmlText: procedure
return '<section class="omega-shell" id="omega-shell" aria-label="Omega command shell">' || '0a'x ||,
'  <header class="omega-bar">' || '0a'x ||,
'    <strong class="omega-mark">Ω OMEGA SHELL</strong>' || '0a'x ||,
'    <span class="omega-state">EVIDENCE OR SILENCE</span>' || '0a'x ||,
'    <span class="omega-spacer"></span>' || '0a'x ||,
'    <span class="omega-chip">REXX BRIDGE</span>' || '0a'x ||,
'    <span class="omega-chip" id="omega-mode">LOCAL · GUARDED</span>' || '0a'x ||,
'  </header>' || '0a'x ||,
'  <main class="omega-output" id="omega-output" role="log" aria-live="polite">' || '0a'x ||,
'    <div class="omega-line" data-kind="system">[Ω] Kitty-Metal command surface mounted.</div>' || '0a'x ||,
'    <div class="omega-line">[policy] commands require the REXX allowlist.</div>' || '0a'x ||,
'  </main>' || '0a'x ||,
'  <form class="omega-input-row" id="omega-form">' || '0a'x ||,
'    <label class="omega-prompt" for="omega-input">Ω›</label>' || '0a'x ||,
'    <input class="omega-input" id="omega-input" autocomplete="off" spellcheck="false" placeholder="git status" />' || '0a'x ||,
'    <button class="omega-run" type="submit">EXECUTE</button>' || '0a'x ||,
'  </form>' || '0a'x ||,
'</section>' || '0a'x ||,
'<script>' || '0a'x ||,
'(() => {' || '0a'x ||,
'  const form = document.querySelector("#omega-form");' || '0a'x ||,
'  const input = document.querySelector("#omega-input");' || '0a'x ||,
'  const output = document.querySelector("#omega-output");' || '0a'x ||,
'  const append = (text, kind="") => {' || '0a'x ||,
'    const line = document.createElement("div");' || '0a'x ||,
'    line.className = "omega-line";' || '0a'x ||,
'    if (kind) line.dataset.kind = kind;' || '0a'x ||,
'    line.textContent = text;' || '0a'x ||,
'    output.append(line); output.scrollTop = output.scrollHeight;' || '0a'x ||,
'  };' || '0a'x ||,
'  form.addEventListener("submit", async event => {' || '0a'x ||,
'    event.preventDefault();' || '0a'x ||,
'    const command = input.value.trim(); if (!command) return;' || '0a'x ||,
'    append(`Ω› ${command}`, "system"); input.value = "";' || '0a'x ||,
'    try {' || '0a'x ||,
'      if (!window.omegaIDE?.execute) throw new Error("IDE bridge window.omegaIDE.execute is not connected");' || '0a'x ||,
'      const result = await window.omegaIDE.execute(command);' || '0a'x ||,
'      append(result.stdout || "[no output]", result.code === 0 ? "ok" : "error");' || '0a'x ||,
'    } catch (error) { append(`[SILENCE] ${error.message}`, "error"); }' || '0a'x ||,
'  });' || '0a'x ||,
'})();' || '0a'x ||,
'</script>'
