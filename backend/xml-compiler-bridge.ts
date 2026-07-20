/**
 * SOVEREIGN XML COMPILER BRIDGE
 * Natural language → valid XML system prompts (zero syntax errors, one shot)
 * Controls mini models (IBM Granite, Nemotron, etc.) via XML + natural language
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// =====================================================================
// XML COMPILATION MODES
// =====================================================================

export enum CompilationMode {
  GBNF = 'gbnf',           // Grammar-constrained (llama.cpp) — 100% valid
  SKELETON = 'skeleton',   // Fill {{PLACEHOLDERS}} in template
  DUALPASS = 'dual-pass',  // CoT: thought_process first, xml_output second
}

export interface XMLCompilationRequest {
  mode: CompilationMode;
  naturalLanguage: string;
  llamaUrl?: string;
  ollamaUrl?: string;
  model?: string;
  temperature?: number;
}

export interface XMLCompilationResponse {
  mode: CompilationMode;
  input: string;
  xmlOutput: string;
  validationStatus: 'VALID' | 'INVALID' | 'PARTIAL';
  metadata: {
    timestamp: number;
    executionTimeMs: number;
    tokenCount?: number;
  };
}

// =====================================================================
// XML VALIDATOR
// =====================================================================

function validateXML(xmlText: string): {
  valid: boolean;
  errors: string[];
} {
  try {
    // Basic well-formedness check
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    if (doc.documentElement.tagName === 'parsererror') {
      return {
        valid: false,
        errors: [doc.documentElement.textContent || 'XML parse error'],
      };
    }

    // Check required tags
    const requiredTags = ['system_prompt', 'identity', 'logic_gates', 'execution_flow'];
    const missingTags = requiredTags.filter((tag) => !doc.querySelector(tag));

    if (missingTags.length > 0) {
      return {
        valid: false,
        errors: [`Missing required tags: ${missingTags.join(', ')}`],
      };
    }

    return { valid: true, errors: [] };
  } catch (e: any) {
    return {
      valid: false,
      errors: [e.message],
    };
  }
}

// =====================================================================
// COMPILATION ORCHESTRATOR
// =====================================================================

export async function compileNaturalLanguageToXML(
  req: XMLCompilationRequest
): Promise<XMLCompilationResponse> {
  const startTime = Date.now();

  try {
    let xmlOutput: string;

    switch (req.mode) {
      case CompilationMode.GBNF:
        xmlOutput = await compileWithGBNF(req);
        break;
      case CompilationMode.SKELETON:
        xmlOutput = await compileWithSkeleton(req);
        break;
      case CompilationMode.DUALPASS:
        xmlOutput = await compileWithDualPass(req);
        break;
      default:
        throw new Error(`Unknown mode: ${req.mode}`);
    }

    const validation = validateXML(xmlOutput);

    return {
      mode: req.mode,
      input: req.naturalLanguage,
      xmlOutput,
      validationStatus: validation.valid ? 'VALID' : 'INVALID',
      metadata: {
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
      },
    };
  } catch (error: any) {
    throw new Error(`XML compilation failed (${req.mode}): ${error.message}`);
  }
}

// =====================================================================
// MODE 1: GBNF CONSTRAINED DECODING
// =====================================================================

async function compileWithGBNF(req: XMLCompilationRequest): Promise<string> {
  // Requires llama.cpp server with grammar support
  const llamaUrl = req.llamaUrl || process.env.LLAMA_URL || 'http://localhost:8080';

  try {
    // Read GBNF grammar
    const grammarPath = path.join(
      __dirname,
      '../artifacts/bridges/xml-compiler-grammars/sovereign_prompt.gbnf'
    );
    const grammarText = await fs.readFile(grammarPath, 'utf-8');

    // Call llama.cpp with grammar constraint
    const payload = {
      prompt: `Convert this natural language instruction into a sovereign XML system prompt:\n\n${req.naturalLanguage}`,
      grammar: grammarText,
      temperature: req.temperature || 0.3,
      n_predict: 2048,
    };

    const response = await fetch(`${llamaUrl}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`llama.cpp responded with ${response.status}`);
    }

    const data = await response.json();
    return data.content || '';
  } catch (e: any) {
    throw new Error(`GBNF compilation failed: ${e.message}`);
  }
}

// =====================================================================
// MODE 2: SKELETON IN-FILLING
// =====================================================================

async function compileWithSkeleton(req: XMLCompilationRequest): Promise<string> {
  const ollamaUrl = req.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = req.model || process.env.XML_MODEL || 'nemotron';

  try {
    // Read skeleton template
    const skeletonPath = path.join(
      __dirname,
      '../artifacts/bridges/xml-compiler-skeletons/sovereign_prompt.xml'
    );
    const skeleton = await fs.readFile(skeletonPath, 'utf-8');

    // Extract placeholders
    const placeholders = skeleton.match(/\{\{(\w+)\}\}/g) || [];
    const placeholderKeys = placeholders.map((p) => p.replace(/\{|\}/g, ''));

    // Call LLM to fill placeholders
    const systemPrompt = `You are a Skeleton Filler Agent.
You will receive an XML skeleton with {{PLACEHOLDER}} tokens.
Return ONLY a JSON object mapping each placeholder key to its value.
No XML. No explanation. Pure JSON.`;

    const userPrompt = `Skeleton placeholders to fill: ${placeholderKeys.join(', ')}

Natural language instruction:
${req.naturalLanguage}`;

    const payload = {
      model,
      system: systemPrompt,
      prompt: userPrompt,
      stream: false,
      options: {
        temperature: req.temperature || 0.3,
        top_p: 0.9,
      },
    };

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    const data = await response.json();
    const llmResponse = data.response || '{}';

    // Parse JSON response
    let fillMapping: Record<string, string> = {};
    try {
      fillMapping = JSON.parse(llmResponse);
    } catch {
      // Try extracting JSON from response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        fillMapping = JSON.parse(jsonMatch[0]);
      }
    }

    // Inject values into skeleton
    let filledXML = skeleton;
    for (const [key, value] of Object.entries(fillMapping)) {
      filledXML = filledXML.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }

    // Remove any remaining placeholders
    filledXML = filledXML.replace(/\{\{(\w+)\}\}/g, '');

    return filledXML;
  } catch (e: any) {
    throw new Error(`Skeleton compilation failed: ${e.message}`);
  }
}

// =====================================================================
// MODE 3: DUAL-PASS CHAIN-OF-XML
// =====================================================================

async function compileWithDualPass(req: XMLCompilationRequest): Promise<string> {
  const ollamaUrl = req.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = req.model || process.env.XML_MODEL || 'nemotron';

  try {
    const systemPrompt = `You are a Compiler Agent. Convert natural language into sovereign XML prompts.

Follow this exact output sequence:
1. <thought_process>: outline the identity, logic gates, and execution flow needed.
2. <xml_output>: convert your thought process into the finalized XML.
   Do not output any text after </xml_output>.

The XML must match this structure:
<system_prompt>
  <identity>...</identity>
  <logic_gates><gate><name/><condition/><action/></gate></logic_gates>
  <execution_flow><step><order/><instruction/></step></execution_flow>
</system_prompt>`;

    const payload = {
      model,
      system: systemPrompt,
      prompt: req.naturalLanguage,
      stream: false,
      options: {
        temperature: req.temperature || 0.3,
        top_p: 0.9,
      },
    };

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    const data = await response.json();
    const fullResponse = data.response || '';

    // Extract <xml_output>...</xml_output>
    const xmlMatch = fullResponse.match(/<xml_output>([\s\S]*?)<\/xml_output>/);
    const xmlOutput = xmlMatch ? xmlMatch[1].trim() : fullResponse;

    return xmlOutput;
  } catch (e: any) {
    throw new Error(`Dual-pass compilation failed: ${e.message}`);
  }
}

// =====================================================================
// MODEL CONTROL VIA XML
// =====================================================================

export interface ModelControlRequest {
  xmlPrompt: string;
  model: string;  // 'granite', 'nemotron', 'mistral', etc.
  userQuery: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelControlResponse {
  model: string;
  response: string;
  promptUsed: string;
  executionTimeMs: number;
}

export async function controlModelViaXML(
  req: ModelControlRequest
): Promise<ModelControlResponse> {
  const startTime = Date.now();
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  try {
    // Validate XML first
    const validation = validateXML(req.xmlPrompt);
    if (!validation.valid) {
      throw new Error(`Invalid XML prompt: ${validation.errors.join('; ')}`);
    }

    // Extract system prompt from XML
    const systemPrompt = extractSystemPromptFromXML(req.xmlPrompt);

    // Call LLM with XML-derived system prompt
    const payload = {
      model: req.model,
      system: systemPrompt,
      prompt: req.userQuery,
      stream: false,
      options: {
        temperature: req.temperature || 0.7,
        top_p: 0.9,
        num_predict: req.maxTokens || 512,
      },
    };

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    const data = await response.json();

    return {
      model: req.model,
      response: data.response || '',
      promptUsed: systemPrompt,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (e: any) {
    throw new Error(`Model control failed: ${e.message}`);
  }
}

// =====================================================================
// UTILITY: Extract system prompt from XML
// =====================================================================

function extractSystemPromptFromXML(xmlText: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const identity = doc.querySelector('identity')?.textContent || '';
    const gates = Array.from(doc.querySelectorAll('logic_gates gate'))
      .map((gate) => `${gate.querySelector('name')?.textContent}: ${gate.querySelector('condition')?.textContent}`)
      .join('\n');

    const flow = Array.from(doc.querySelectorAll('execution_flow step'))
      .map((step) => `${step.querySelector('order')?.textContent}. ${step.querySelector('instruction')?.textContent}`)
      .join('\n');

    return `${identity}\n\nLogic Gates:\n${gates}\n\nExecution Flow:\n${flow}`;
  } catch {
    // Fallback: return raw XML
    return xmlText;
  }
}

export default {
  compileNaturalLanguageToXML,
  controlModelViaXML,
  CompilationMode,
};
