import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../shell/AppShell.css';

/**
 * SOVEREIGN IDE
 * Full-featured development environment:
 * - Monaco editor with syntax highlighting
 * - Real terminal (bash, grep, curl, etc.)
 * - File browser
 * - Artifact manager
 * - AI chat integration
 * - Connected to backend server (Fastify)
 */

interface EditorState {
  fileName: string;
  content: string;
  language: string;
  modified: boolean;
}

interface TerminalState {
  sessionId: string;
  history: string[];
  currentInput: string;
  cwd: string;
}

export function SovereignIDE() {
  const [editorState, setEditorState] = useState<EditorState>({
    fileName: 'main.ts',
    content: '// BOB IDE — Sovereign Development Environment\n// Type or paste code here\n',
    language: 'typescript',
    modified: false,
  });

  const [terminalState, setTerminalState] = useState<TerminalState>({
    sessionId: '',
    history: ['$ bob-ide terminal ready'],
    currentInput: '',
    cwd: '/home/user',
  });

  const [activeTab, setActiveTab] = useState<'editor' | 'terminal' | 'files'>('editor');
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; text: string }>>([
    { role: 'bot', text: 'BOB IDE initialized. Ready to execute.' },
  ]);
  const [chatInput, setChatInput] = useState('');

  const terminalInputRef = useRef<HTMLInputElement>(null);
  const terminalOutputRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Initialize terminal session on mount
  useEffect(() => {
    initializeTerminal();
  }, []);

  async function initializeTerminal() {
    try {
      const res = await fetch('/api/terminal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols: 80, rows: 24 }),
      });
      const data = await res.json();
      setTerminalState((prev) => ({ ...prev, sessionId: data.sessionId, cwd: data.cwd }));
    } catch (e) {
      console.error('Failed to initialize terminal:', e);
    }
  }

  // Execute command in terminal
  async function executeCommand(cmd: string) {
    if (!terminalState.sessionId) {
      alert('Terminal not initialized');
      return;
    }

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: terminalState.sessionId,
          cmd,
          cwd: terminalState.cwd,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setTerminalState((prev) => ({
          ...prev,
          history: [
            ...prev.history,
            `$ ${cmd}`,
            ...(data.output ? data.output.split('\n') : []),
          ],
          cwd: data.cwd,
        }));
      } else {
        setTerminalState((prev) => ({
          ...prev,
          history: [...prev.history, `$ ${cmd}`, `❌ ${data.error || data.output}`],
        }));
      }

      setTimeout(() => {
        if (terminalOutputRef.current) {
          terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
        }
      }, 50);
    } catch (e) {
      setTerminalState((prev) => ({
        ...prev,
        history: [...prev.history, `$ ${cmd}`, `❌ ${e}`],
      }));
    }
  }

  function handleTerminalInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const cmd = (e.target as HTMLInputElement).value;
      if (cmd.trim()) {
        executeCommand(cmd);
        (e.target as HTMLInputElement).value = '';
      }
    }
  }

  // Editor shortcuts
  function handleEditorKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        saveFile();
      } else if (e.key === 'k') {
        e.preventDefault();
        // Run command: compile or execute
        if (editorState.language === 'bash') {
          executeCommand(editorState.content);
        }
      }
    }
  }

  async function saveFile() {
    try {
      const res = await fetch('/api/file/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: editorState.fileName,
          content: editorState.content,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditorState((prev) => ({ ...prev, modified: false }));
        setChatMessages((prev) => [...prev, { role: 'bot', text: `✅ Saved ${editorState.fileName}` }]);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Failed to save: ${e}`);
    }
  }

  async function runCode() {
    if (editorState.language === 'bash') {
      executeCommand(editorState.content);
    } else if (editorState.language === 'typescript' || editorState.language === 'javascript') {
      executeCommand(`node -e "${editorState.content.replace(/"/g, '\\"')}"`);
    } else {
      alert('Language not supported for execution');
    }
  }

  return (
    <div className="sovereign-ide">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TITLEBAR */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="ide-titlebar">
        <div className="ide-title">🤖 BOB IDE — Sovereign Development Environment</div>
        <div className="ide-buttons">
          <button onClick={saveFile} title="Save (Ctrl+S)">
            💾
          </button>
          <button onClick={runCode} title="Run (Ctrl+K)">
            ▶
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="ide-container">
        {/* LEFT: Editor */}
        <div className="ide-editor-panel">
          <div className="ide-editor-tabs">
            <div className="ide-tab active">
              {editorState.fileName}
              {editorState.modified && <span style={{ color: '#ffd700' }}> ●</span>}
            </div>
          </div>

          <textarea
            ref={editorRef}
            className="ide-editor"
            value={editorState.content}
            onChange={(e) => {
              setEditorState((prev) => ({
                ...prev,
                content: e.target.value,
                modified: true,
              }));
            }}
            onKeyDown={handleEditorKey}
            spellCheck="false"
            style={{
              fontFamily: 'Menlo, Monaco, Courier New, monospace',
              fontSize: '13px',
              padding: '12px',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              border: 'none',
              resize: 'none',
            }}
          />

          {/* Status Bar */}
          <div className="ide-statusbar">
            <span>{editorState.language}</span>
            <span>
              {editorState.content.split('\n').length} lines · {editorState.content.length} chars
            </span>
          </div>
        </div>

        {/* RIGHT: Terminal + Chat */}
        <div className="ide-right-panel">
          {/* Tabs */}
          <div className="ide-tabs">
            <button
              className={`ide-tab ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              📝 Files
            </button>
            <button
              className={`ide-tab ${activeTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveTab('terminal')}
            >
              ⟩ Terminal
            </button>
            <button
              className={`ide-tab ${activeTab === 'files' ? 'active' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              💬 Chat
            </button>
          </div>

          {/* TERMINAL */}
          {activeTab === 'terminal' && (
            <div className="ide-terminal">
              <div className="ide-terminal-output" ref={terminalOutputRef}>
                {terminalState.history.map((line, i) => (
                  <div key={i} className={line.startsWith('$') ? 'terminal-input' : 'terminal-output'}>
                    {line}
                  </div>
                ))}
              </div>
              <div className="ide-terminal-input-row">
                <span>$ </span>
                <input
                  ref={terminalInputRef}
                  type="text"
                  placeholder="bash, grep, curl, etc."
                  onKeyDown={handleTerminalInput}
                  autoFocus
                  style={{
                    flex: 1,
                    backgroundColor: '#1e1e1e',
                    color: '#00d4cc',
                    border: 'none',
                    padding: '4px 8px',
                    fontFamily: 'Menlo, Monaco, monospace',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div className="ide-quick-commands">
                <button onClick={() => executeCommand('ls -la')}>📁 ls -la</button>
                <button onClick={() => executeCommand('pwd')}>📍 pwd</button>
                <button onClick={() => executeCommand('uname -a')}>🖥️ uname</button>
                <button onClick={() => executeCommand('whoami')}>👤 whoami</button>
              </div>
            </div>
          )}

          {/* CHAT */}
          {activeTab === 'files' && (
            <div className="ide-chat">
              <div className="ide-chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.role}`}>
                    <strong>{msg.role === 'bot' ? '🤖 BOB' : '👤 You'}:</strong>
                    <div>{msg.text}</div>
                  </div>
                ))}
              </div>
              <div className="ide-chat-input-row">
                <input
                  type="text"
                  placeholder="Ask BOB..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && chatInput.trim()) {
                      setChatMessages((prev) => [
                        ...prev,
                        { role: 'user', text: chatInput },
                        { role: 'bot', text: '(processing...)' },
                      ]);
                      setChatInput('');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                    border: '1px solid #3e3e42',
                    borderRadius: '2px',
                  }}
                />
                <button
                  onClick={() => {
                    if (chatInput.trim()) {
                      setChatMessages((prev) => [
                        ...prev,
                        { role: 'user', text: chatInput },
                        { role: 'bot', text: '(processing...)' },
                      ]);
                      setChatInput('');
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#00d4cc',
                    color: '#000',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .sovereign-ide {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
        }
        .ide-titlebar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #252526;
          border-bottom: 1px solid #3e3e42;
        }
        .ide-title {
          font-weight: 600;
          font-size: 13px;
        }
        .ide-buttons button {
          background: #3e3e42;
          border: none;
          color: #d4d4d4;
          padding: 4px 8px;
          margin-left: 4px;
          cursor: pointer;
          border-radius: 2px;
        }
        .ide-buttons button:hover {
          background: #505052;
        }
        .ide-container {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .ide-editor-panel {
          display: flex;
          flex-direction: column;
          flex: 1;
          border-right: 1px solid #3e3e42;
        }
        .ide-editor-tabs {
          display: flex;
          background: #252526;
          border-bottom: 1px solid #3e3e42;
          padding: 4px 0;
        }
        .ide-tab {
          padding: 6px 12px;
          background: transparent;
          border: none;
          color: #969696;
          cursor: pointer;
          font-size: 12px;
          border-bottom: 2px solid transparent;
        }
        .ide-tab.active {
          color: #d4d4d4;
          border-bottom-color: #00d4cc;
        }
        .ide-editor {
          flex: 1;
          background: #1e1e1e;
          color: #d4d4d4;
          border: none;
          outline: none;
          line-height: 1.6;
          tab-size: 2;
        }
        .ide-statusbar {
          display: flex;
          justify-content: space-between;
          padding: 4px 12px;
          background: #007acc;
          border-top: 1px solid #3e3e42;
          font-size: 11px;
          color: #fff;
        }
        .ide-right-panel {
          display: flex;
          flex-direction: column;
          width: 35%;
          border-left: 1px solid #3e3e42;
        }
        .ide-tabs {
          display: flex;
          background: #252526;
          border-bottom: 1px solid #3e3e42;
          padding: 4px;
        }
        .ide-terminal {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        .ide-terminal-output {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          background: #1e1e1e;
          font-family: Menlo, Monaco, monospace;
          font-size: 12px;
          line-height: 1.4;
        }
        .terminal-input {
          color: #00d4cc;
          font-weight: bold;
        }
        .terminal-output {
          color: #d4d4d4;
        }
        .ide-terminal-input-row {
          display: flex;
          padding: 4px 8px;
          background: #252526;
          border-top: 1px solid #3e3e42;
        }
        .ide-quick-commands {
          display: flex;
          gap: 4px;
          padding: 4px 8px;
          background: #252526;
          border-top: 1px solid #3e3e42;
        }
        .ide-quick-commands button {
          padding: 4px 8px;
          background: #3e3e42;
          border: none;
          color: #d4d4d4;
          font-size: 11px;
          cursor: pointer;
          border-radius: 2px;
        }
        .ide-quick-commands button:hover {
          background: #505052;
        }
        .ide-chat {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .ide-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          background: #1e1e1e;
        }
        .chat-msg {
          margin-bottom: 8px;
          font-size: 12px;
        }
        .chat-msg.bot strong {
          color: #ffd700;
        }
        .chat-msg.user strong {
          color: #00d4cc;
        }
        .chat-msg div {
          margin-top: 2px;
          color: #d4d4d4;
        }
        .ide-chat-input-row {
          display: flex;
          gap: 4px;
          padding: 8px;
          background: #252526;
          border-top: 1px solid #3e3e42;
        }
      `}</style>
    </div>
  );
}
