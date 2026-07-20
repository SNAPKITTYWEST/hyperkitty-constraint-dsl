/**
 * XML COMPILER PANEL
 * Natural language → valid XML system prompts
 * Control mini models (Granite, Nemotron, etc.) via XML-derived prompts
 */

import React, { useState } from 'react';

interface CompilationResult {
  mode: string;
  xmlOutput: string;
  validationStatus: 'VALID' | 'INVALID' | 'PARTIAL';
  metadata: {
    timestamp: number;
    executionTimeMs: number;
  };
}

interface ModelResponse {
  model: string;
  response: string;
  promptUsed: string;
  executionTimeMs: number;
}

export function XMLCompilerPanel() {
  const [mode, setMode] = useState<'gbnf' | 'skeleton' | 'dual-pass'>('skeleton');
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [xmlResult, setXmlResult] = useState<CompilationResult | null>(null);
  const [modelSelection, setModelSelection] = useState('nemotron');
  const [userQuery, setUserQuery] = useState('');
  const [modelResponse, setModelResponse] = useState<ModelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compileToXML() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/xml/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          naturalLanguage,
          temperature: 0.3,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setXmlResult(data);
      } else {
        setError(data.error || 'Compilation failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function controlModel() {
    if (!xmlResult) {
      setError('Compile natural language to XML first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/xml/control-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xmlPrompt: xmlResult.xmlOutput,
          model: modelSelection,
          userQuery,
          temperature: 0.7,
          maxTokens: 512,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setModelResponse(data);
      } else {
        setError(data.error || 'Model control failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px', padding: '12px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#00d4cc' }}>🔮 XML Compiler</div>

      {/* ===== STEP 1: COMPILE ===== */}
      <div style={{ border: '1px solid #3e3e42', padding: '12px', borderRadius: '4px' }}>
        <div style={{ fontSize: '12px', color: '#00d4cc', marginBottom: '8px' }}>Step 1: Natural Language → XML</div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#a0a0a0' }}>Mode:</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            style={{
              width: '100%',
              padding: '4px 6px',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              border: '1px solid #3e3e42',
              marginTop: '4px',
              fontSize: '11px',
            }}
          >
            <option value="gbnf">GBNF (Grammar-constrained, 100% valid)</option>
            <option value="skeleton">Skeleton (Fill {{PLACEHOLDERS}})</option>
            <option value="dual-pass">Dual-pass (CoT + XML)</option>
          </select>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#a0a0a0' }}>Natural Language:</label>
          <textarea
            value={naturalLanguage}
            onChange={(e) => setNaturalLanguage(e.target.value)}
            placeholder="You are a zero-sorry Lean 4 verifier..."
            style={{
              width: '100%',
              height: '80px',
              padding: '6px',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              border: '1px solid #3e3e42',
              marginTop: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              resize: 'none',
            }}
          />
        </div>

        <button
          onClick={compileToXML}
          disabled={loading}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: loading ? '#3e3e42' : '#00d4cc',
            color: loading ? '#a0a0a0' : '#000',
            border: 'none',
            borderRadius: '3px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '12px',
          }}
        >
          {loading ? 'Compiling...' : 'Compile to XML'}
        </button>
      </div>

      {/* ===== RESULT ===== */}
      {xmlResult && (
        <div style={{ border: '1px solid #00d4cc', padding: '12px', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#00ff88', marginBottom: '8px' }}>
            ✓ {xmlResult.validationStatus === 'VALID' ? '✅ VALID XML' : '⚠️ ' + xmlResult.validationStatus}
          </div>

          <div
            style={{
              backgroundColor: '#1e1e1e',
              padding: '8px',
              borderRadius: '3px',
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#d4d4d4',
              maxHeight: '120px',
              overflow: 'auto',
              border: '1px solid #3e3e42',
              marginBottom: '8px',
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {xmlResult.xmlOutput.slice(0, 500)}
              {xmlResult.xmlOutput.length > 500 ? '...' : ''}
            </pre>
          </div>

          <div style={{ fontSize: '10px', color: '#a0a0a0' }}>
            {xmlResult.metadata.executionTimeMs}ms
          </div>
        </div>
      )}

      {/* ===== STEP 2: CONTROL MODEL ===== */}
      {xmlResult && (
        <div style={{ border: '1px solid #3e3e42', padding: '12px', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#00d4cc', marginBottom: '8px' }}>Step 2: Control Model with XML</div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', color: '#a0a0a0' }}>Model:</label>
            <select
              value={modelSelection}
              onChange={(e) => setModelSelection(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 6px',
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                border: '1px solid #3e3e42',
                marginTop: '4px',
                fontSize: '11px',
              }}
            >
              <option value="nemotron">Nemotron (Nvidia)</option>
              <option value="granite">IBM Granite</option>
              <option value="mistral">Mistral</option>
              <option value="llama2">Llama 2</option>
            </select>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', color: '#a0a0a0' }}>Query:</label>
            <textarea
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Ask the model something..."
              style={{
                width: '100%',
                height: '60px',
                padding: '6px',
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                border: '1px solid #3e3e42',
                marginTop: '4px',
                fontSize: '11px',
                fontFamily: 'monospace',
                resize: 'none',
              }}
            />
          </div>

          <button
            onClick={controlModel}
            disabled={loading}
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: loading ? '#3e3e42' : '#ffd700',
              color: loading ? '#a0a0a0' : '#000',
              border: 'none',
              borderRadius: '3px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            {loading ? 'Running...' : 'Run Model'}
          </button>
        </div>
      )}

      {/* ===== MODEL RESPONSE ===== */}
      {modelResponse && (
        <div style={{ border: '1px solid #ffd700', padding: '12px', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#ffd700', marginBottom: '8px' }}>✓ Model Response ({modelResponse.model})</div>

          <div
            style={{
              backgroundColor: '#1e1e1e',
              padding: '8px',
              borderRadius: '3px',
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#d4d4d4',
              maxHeight: '120px',
              overflow: 'auto',
              border: '1px solid #3e3e42',
              marginBottom: '8px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {modelResponse.response}
          </div>

          <div style={{ fontSize: '10px', color: '#a0a0a0' }}>
            {modelResponse.executionTimeMs}ms
          </div>
        </div>
      )}

      {/* ===== ERROR ===== */}
      {error && (
        <div
          style={{
            backgroundColor: '#ff5470',
            color: '#000',
            padding: '8px',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          ❌ {error}
        </div>
      )}
    </div>
  );
}

/**
 * USAGE IN APP:
 *
 * import { XMLCompilerPanel } from './components/xml/XMLCompilerPanel';
 *
 * export function App() {
 *   return (
 *     <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', height: '100vh' }}>
 *       <SovereignIDE />
 *       <XMLCompilerPanel />
 *     </div>
 *   );
 * }
 */
