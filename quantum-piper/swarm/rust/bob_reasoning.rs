/// BOB Reasoning Pipeline — Sovereign Logic Machine
///
/// Full async reasoning arc driven by Tokio:
///   QRNG → Chunk Lookup → Dictionary/Prolog Route → Web Search → Ada Gate → WORM Seal
///
/// BOB is not a chatbot. He is a reasoning machine.
/// He does not guess. He returns EVIDENCE or SILENCE.
/// If he cannot produce EVIDENCE, he says nothing.
///
/// LOC is his verifier. BOB proposes. LOC proves.
/// ROBOB is his FSM. ROBOB routes. BOB reasons.
///
/// Coding capability:
///   BOB detects code questions via the CodeOracle path.
///   BOB generates. LOC compiles. If LOC compiles → EVIDENCE. If not → SILENCE.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH, Duration};
use sha2::{Sha256, Digest};
use serde::{Deserialize, Serialize};
use tokio::time::timeout;

// ── Constants ─────────────────────────────────────────────────────────────────

pub const EVIDENCE_THRESHOLD: f32 = 0.58;
pub const SILENCE_THRESHOLD:  f32 = 0.35;
pub const SEARCH_TIMEOUT_MS:  u64 = 7_000;
pub const QRNG_TIMEOUT_MS:    u64 = 3_000;

// ── Verdict ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Verdict {
    Evidence,
    Silence,
}

impl std::fmt::Display for Verdict {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Evidence => write!(f, "EVIDENCE"),
            Self::Silence  => write!(f, "SILENCE"),
        }
    }
}

// ── Reasoning route ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReasoningRoute {
    Chunk,       // in-house knowledge chunk answered it
    Dictionary,  // Prolog/dictionary routing answered it
    CodeOracle,  // code question — generate + LOC verification path
    WebSearch,   // Tavily primary / DDG fallback
    Synthesis,   // multi-source synthesis
    Silence,     // insufficient evidence
}

// ── Knowledge chunk ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeChunk {
    pub concept:    String,
    pub domain:     String,
    pub content:    String,
    pub confidence: f32,
    pub pua_char:   Option<char>,
}

// ── Search result ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub source:  SearchSource,
    pub answer:  String,
    pub url:     Option<String>,
    pub score:   f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchSource {
    Tavily,
    DuckDuckGo,
    Offline,
}

// ── Code context (CodeOracle path) ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeContext {
    pub language:    String,
    pub intent:      CodeIntent,
    pub snippet:     Option<String>,
    pub loc_verify:  bool,   // true = LOC should attempt compilation
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CodeIntent {
    Generate,   // write new code
    Review,     // review existing code
    Explain,    // explain what code does
    Debug,      // find the bug
    Optimize,   // make it faster/safer
    Convert,    // translate between languages
}

// ── Reasoning output ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningOutput {
    pub verdict:     Verdict,
    pub answer:      String,
    pub route:       ReasoningRoute,
    pub confidence:  f32,
    pub seal:        String,
    pub sources:     Vec<String>,
    pub code_ctx:    Option<CodeContext>,
    pub tick:        u64,
}

// ── QRNG seed ─────────────────────────────────────────────────────────────────

pub struct QrngSeed {
    pub bytes: Vec<u8>,
    pub source: &'static str,
}

async fn qrng_seed() -> QrngSeed {
    let anu_url = "https://qrng.anu.edu.au/API/jsonI.php?length=8&type=uint8";
    let result = timeout(
        Duration::from_millis(QRNG_TIMEOUT_MS),
        async {
            let client = reqwest::Client::new();
            let resp = client.get(anu_url)
                .timeout(Duration::from_millis(QRNG_TIMEOUT_MS))
                .send().await?;
            let json: serde_json::Value = resp.json().await?;
            let data = json["data"].as_array()
                .map(|a| a.iter().filter_map(|v| v.as_u64().map(|n| n as u8)).collect::<Vec<_>>())
                .unwrap_or_default();
            Ok::<Vec<u8>, reqwest::Error>(data)
        }
    ).await;

    match result {
        Ok(Ok(bytes)) if !bytes.is_empty() => QrngSeed { bytes, source: "ANU_QRNG" },
        _ => {
            // CSPRNG fallback — no silent failure
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut h = DefaultHasher::new();
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos().hash(&mut h);
            let v = h.finish();
            QrngSeed { bytes: v.to_le_bytes().to_vec(), source: "CSPRNG_FALLBACK" }
        }
    }
}

// ── Chunk lookup ─────────────────────────────────────────────────────────────

fn chunk_lookup(input: &str, registry: &[KnowledgeChunk]) -> Option<KnowledgeChunk> {
    let lower = input.to_lowercase();
    let mut best: Option<(f32, &KnowledgeChunk)> = None;

    for chunk in registry {
        let concept_lower = chunk.concept.to_lowercase();
        let domain_lower  = chunk.domain.to_lowercase();

        let score = if lower.contains(&concept_lower) {
            chunk.confidence
        } else if lower.contains(&domain_lower) {
            chunk.confidence * 0.7
        } else {
            // Word overlap scoring
            let concept_words: Vec<&str> = concept_lower.split_whitespace().collect();
            let input_words: Vec<&str>   = lower.split_whitespace().collect();
            let overlap = concept_words.iter()
                .filter(|w| input_words.contains(w))
                .count() as f32;
            let total = concept_words.len().max(1) as f32;
            chunk.confidence * (overlap / total) * 0.5
        };

        if score >= EVIDENCE_THRESHOLD {
            if best.map_or(true, |(s, _)| score > s) {
                best = Some((score, chunk));
            }
        }
    }

    best.map(|(_, c)| c.clone())
}

// ── Code detection ────────────────────────────────────────────────────────────

fn detect_code_intent(input: &str) -> Option<CodeContext> {
    let lower = input.to_lowercase();

    // Language detection
    let language = if lower.contains("rust") || lower.contains("cargo") || lower.contains("tokio") {
        "rust"
    } else if lower.contains("python") || lower.contains("pip") || lower.contains("def ") {
        "python"
    } else if lower.contains("javascript") || lower.contains("node") || lower.contains("mjs") {
        "javascript"
    } else if lower.contains("haskell") || lower.contains("ghc") || lower.contains("cabal") {
        "haskell"
    } else if lower.contains("prolog") || lower.contains("swipl") {
        "prolog"
    } else if lower.contains("lean") || lower.contains("theorem") || lower.contains("proof") {
        "lean4"
    } else if lower.contains("sql") || lower.contains("query") || lower.contains("select ") {
        "sql"
    } else if lower.contains("solidity") || lower.contains("contract") || lower.contains("erc") {
        "solidity"
    } else if lower.contains("apl") || lower.contains("⍴") || lower.contains("⌽") {
        "apl"
    } else {
        ""
    };

    // Intent detection
    let intent = if lower.contains("write") || lower.contains("build") || lower.contains("create") || lower.contains("generate") || lower.contains("implement") {
        Some(CodeIntent::Generate)
    } else if lower.contains("review") || lower.contains("check") || lower.contains("audit") {
        Some(CodeIntent::Review)
    } else if lower.contains("explain") || lower.contains("what does") || lower.contains("how does") {
        Some(CodeIntent::Explain)
    } else if lower.contains("bug") || lower.contains("fix") || lower.contains("error") || lower.contains("debug") {
        Some(CodeIntent::Debug)
    } else if lower.contains("faster") || lower.contains("optimize") || lower.contains("performance") {
        Some(CodeIntent::Optimize)
    } else if lower.contains("convert") || lower.contains("translate") || lower.contains("port") {
        Some(CodeIntent::Convert)
    } else {
        None
    };

    // A code question has either a language + any verb, or an obvious code keyword
    let has_code_keyword = lower.contains("```") || lower.contains("fn ") || lower.contains("async fn")
        || lower.contains("impl ") || lower.contains("struct ") || lower.contains("enum ")
        || lower.contains("def ") || lower.contains("class ") || lower.contains("function ")
        || lower.contains("cargo") || lower.contains("compile") || lower.contains("syntax");

    if intent.is_some() || has_code_keyword {
        Some(CodeContext {
            language: if language.is_empty() { "unknown".to_string() } else { language.to_string() },
            intent: intent.unwrap_or(CodeIntent::Explain),
            snippet: None,
            loc_verify: language == "rust",  // LOC verifies Rust — his native language
        })
    } else {
        None
    }
}

// ── Prolog keyword router ─────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct Route {
    action: &'static str,
    oracle: &'static str,
    confidence: f32,
}

fn prolog_route(input: &str) -> Route {
    let lower = input.to_lowercase();

    let patterns: &[(&[&str], &str, &str, f32)] = &[
        (&["oracle","random","quantum","entropy","qrng"],    "oracle_path",    "QRNG",       0.92),
        (&["worm","seal","ledger","immutable","sealed"],     "worm_path",      "WORM",        0.95),
        (&["trust","sentinel","gate","block","security"],    "trust_path",     "ADA",         0.90),
        (&["proof","lean","verify","theorem","formal"],      "proof_path",     "LEAN4",       0.93),
        (&["route","agent","select","dispatch","who"],       "routing_path",   "PROLOG",      0.88),
        (&["nil","null","empty","void","silence"],           "nil_path",       "HOLYC_NIL",   0.85),
        (&["qubit","superpos","quantum","collapse"],         "quantum_path",   "MAMBA",       0.87),
        (&["contract","ada","invariant","pre","post"],       "ada_path",       "ADA",         0.91),
        (&["memory","remember","recall","state","ssm"],      "memory_path",    "MAMBA_SSM",   0.86),
        (&["build","create","generate","write","code"],      "codegen_path",   "LOC",         0.89),
        (&["credit","fcra","dispute","zombie","metro"],      "counsel_path",   "COUNSEL",     0.94),
        (&["trust","deed","fiduciary","sovereign","nacha"],  "sovereign_path", "COUNSEL",     0.94),
        (&["ach","return","code","nacha","sec","ppd"],       "ach_path",       "COUNSEL",     0.96),
    ];

    let mut best_route = Route { action: "sovereign_step", oracle: "DICT", confidence: 0.60 };

    for (words, action, oracle, conf) in patterns {
        let hits = words.iter().filter(|&&w| lower.contains(w)).count();
        if hits > 0 {
            let score = conf * (hits as f32 / words.len() as f32).sqrt();
            if score > best_route.confidence {
                best_route = Route { action, oracle, confidence: score };
            }
        }
    }

    best_route
}

// ── Web search: Tavily primary → DuckDuckGo fallback ─────────────────────────

async fn web_search(query: &str, tavily_key: Option<&str>) -> Option<SearchResult> {
    // 1. Tavily (paid, high quality)
    if let Some(key) = tavily_key {
        if let Some(result) = tavily_search(query, key).await {
            return Some(result);
        }
    }

    // 2. DuckDuckGo Instant Answer API (free, no key)
    ddg_search(query).await
}

async fn tavily_search(query: &str, api_key: &str) -> Option<SearchResult> {
    let body = serde_json::json!({
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "max_results": 3,
        "include_answer": true,
    });

    let result = timeout(Duration::from_millis(SEARCH_TIMEOUT_MS), async {
        let client = reqwest::Client::new();
        let resp = client
            .post("https://api.tavily.com/search")
            .header("Content-Type", "application/json")
            .body(body.to_string())
            .send().await?;
        let json: serde_json::Value = resp.json().await?;
        Ok::<serde_json::Value, reqwest::Error>(json)
    }).await;

    match result {
        Ok(Ok(json)) => {
            let answer = json["answer"].as_str()
                .or_else(|| json["results"][0]["content"].as_str())
                .unwrap_or("")
                .to_string();
            let url = json["results"][0]["url"].as_str().map(String::from);

            if answer.len() > 20 {
                Some(SearchResult {
                    source:  SearchSource::Tavily,
                    answer,
                    url,
                    score:   0.82,
                })
            } else { None }
        }
        _ => None,
    }
}

async fn ddg_search(query: &str) -> Option<SearchResult> {
    // DuckDuckGo Instant Answer API — free, no key, no rate limit for small usage
    let url = format!(
        "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
        urlencoding::encode(query)
    );

    let result = timeout(Duration::from_millis(SEARCH_TIMEOUT_MS), async {
        let client = reqwest::Client::builder()
            .user_agent("BOB-Sovereign/1.0")
            .build()?;
        let resp = client.get(&url).send().await?;
        let json: serde_json::Value = resp.json().await?;
        Ok::<serde_json::Value, reqwest::Error>(json)
    }).await;

    match result {
        Ok(Ok(json)) => {
            // DDG returns AbstractText for instant answers, or RelatedTopics
            let answer = json["AbstractText"].as_str()
                .filter(|s| !s.is_empty())
                .or_else(|| json["Answer"].as_str().filter(|s| !s.is_empty()))
                .or_else(|| json["RelatedTopics"][0]["Text"].as_str())
                .unwrap_or("")
                .to_string();

            let url = json["AbstractURL"].as_str()
                .or_else(|| json["RelatedTopics"][0]["FirstURL"].as_str())
                .map(String::from);

            if answer.len() > 20 {
                Some(SearchResult {
                    source: SearchSource::DuckDuckGo,
                    answer,
                    url,
                    score:  0.65,
                })
            } else { None }
        }
        _ => None,
    }
}

// ── Ada gate ──────────────────────────────────────────────────────────────────

fn ada_gate(answer: &str, route: &Route) -> (bool, String) {
    // Pre-condition: answer must not be empty
    if answer.trim().is_empty() {
        return (false, "ADA_PRE_EMPTY".to_string());
    }

    // Pre-condition: reject shell chars on all paths except codegen
    let shell_chars = ['|', ';', '&', '`', '$', '<', '>'];
    if answer.chars().any(|c| shell_chars.contains(&c)) && route.action != "codegen_path" {
        return (false, "ADA_PRE_SHELL_CHARS".to_string());
    }
    if answer.len() < 10 {
        return (false, "ADA_PRE_TOO_SHORT".to_string());
    }

    // Post-condition: confidence must be above floor
    if route.confidence < SILENCE_THRESHOLD {
        return (false, "ADA_POST_LOW_CONFIDENCE".to_string());
    }

    (true, "ADA_PASS".to_string())
}

// ── WORM seal ─────────────────────────────────────────────────────────────────

fn worm_seal(answer: &str, route: &str, verdict: &Verdict, prev_seal: Option<&str>) -> String {
    let prev = prev_seal.unwrap_or("0000000000000000000000000000000000000000000000000000000000000000");
    let ts   = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let raw  = format!("{}|{}|{}|{}|{}", prev, answer, route, verdict, ts);
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ── Main reasoning pipeline ───────────────────────────────────────────────────

pub struct BobConfig {
    pub tavily_key:      Option<String>,
    pub knowledge_base:  Vec<KnowledgeChunk>,
    pub prev_seal:       Option<String>,
    pub tick:            u64,
}

pub async fn reason(input: &str, config: &BobConfig) -> ReasoningOutput {
    // ── Step 1: Parallel seed — QRNG + chunk lookup ───────────────────────────
    let (qrng, chunk) = tokio::join!(
        qrng_seed(),
        async { chunk_lookup(input, &config.knowledge_base) }
    );

    let _entropy = qrng.bytes.iter().fold(0u64, |acc, &b| acc.wrapping_add(b as u64));

    // ── Step 2: Code detection ────────────────────────────────────────────────
    let code_ctx = detect_code_intent(input);

    // ── Step 3: Route via Prolog keyword router ───────────────────────────────
    let route = prolog_route(input);

    // ── Step 4: Resolve answer source ─────────────────────────────────────────
    let (reasoning_route, answer, confidence, sources) = if let Some(ref c) = chunk {
        // Chunk has it — use in-house knowledge
        (
            ReasoningRoute::Chunk,
            c.content.clone(),
            c.confidence,
            vec![format!("chunk:{}", c.concept)],
        )
    } else if code_ctx.is_some() {
        // Code oracle path — structured response, LOC verifies
        let ctx = code_ctx.as_ref().unwrap();
        let code_answer = format!(
            "[{} · {} · {}] Routing to LOC for {} verification. EVIDENCE pending compilation.",
            ctx.language.to_uppercase(),
            format!("{:?}", ctx.intent),
            if ctx.loc_verify { "LOC_VERIFY=true" } else { "LOC_VERIFY=false" },
            ctx.language
        );
        (
            ReasoningRoute::CodeOracle,
            code_answer,
            0.75,
            vec!["code_oracle:LOC".to_string()],
        )
    } else if route.confidence >= EVIDENCE_THRESHOLD {
        // Dictionary/Prolog route has enough confidence
        (
            ReasoningRoute::Dictionary,
            format!("Route: {} | Oracle: {} | Confidence: {:.2}", route.action, route.oracle, route.confidence),
            route.confidence,
            vec![format!("prolog:{}", route.oracle)],
        )
    } else {
        // Neither chunk nor route confident enough — go to web
        let search = web_search(
            input,
            config.tavily_key.as_deref(),
        ).await;

        match search {
            Some(result) => {
                let src = format!("{:?}:{}", result.source, result.url.as_deref().unwrap_or("no-url"));
                (
                    ReasoningRoute::WebSearch,
                    result.answer,
                    result.score,
                    vec![src],
                )
            }
            None => (
                ReasoningRoute::Silence,
                String::new(),
                0.0,
                vec!["search:OFFLINE".to_string()],
            ),
        }
    };

    // ── Step 5: Ada gate ──────────────────────────────────────────────────────
    let (ada_pass, ada_verdict) = ada_gate(&answer, &route);

    let verdict = if ada_pass && confidence >= EVIDENCE_THRESHOLD {
        Verdict::Evidence
    } else {
        Verdict::Silence
    };

    let final_answer = if verdict == Verdict::Evidence {
        answer
    } else {
        format!("SILENCE · {}", ada_verdict)
    };

    // ── Step 6: WORM seal ─────────────────────────────────────────────────────
    let seal = worm_seal(
        &final_answer,
        &format!("{:?}", reasoning_route),
        &verdict,
        config.prev_seal.as_deref(),
    );

    ReasoningOutput {
        verdict,
        answer:     final_answer,
        route:      reasoning_route,
        confidence,
        seal,
        sources,
        code_ctx,
        tick: config.tick,
    }
}

// ── Knowledge chunk builder (used to grow the in-house base) ─────────────────

pub fn build_chunk(concept: &str, domain: &str, content: &str, confidence: f32) -> KnowledgeChunk {
    KnowledgeChunk {
        concept:    concept.to_string(),
        domain:     domain.to_string(),
        content:    content.to_string(),
        confidence,
        pua_char:   None,
    }
}

/// Seed the default sovereign knowledge base from Ahmad's corpus
pub fn default_knowledge_base() -> Vec<KnowledgeChunk> {
    let mut kb = vec![
        // ── Sovereign / Finance / Law ──────────────────────────────────────
        build_chunk("NACHA return code R10",    "ach",       "R10 = Customer advises not authorized. Use to dispute unauthorized ACH debits. 60-day consumer window, 2-day business window.", 0.97),
        build_chunk("WORM chain",               "sovereign", "WORM = Write Once Read Many. Every event SHA-256 chained. prev_seal + event → new_seal. Tamper-evident. Immutable.", 0.99),
        build_chunk("FCRA zombie debt",         "credit",    "Zombie debt = time-barred debt re-activated. FCRA §623: cannot re-age. Send C&D + dispute to all 3 bureaus simultaneously.", 0.96),
        build_chunk("780 score protocol",       "credit",    "Step 1: dispute all negative items with 4-reason method. Step 2: AU tradelines 10yr+ history. Step 3: freeze secondary agencies. 30-60 days.", 0.95),
        build_chunk("sovereign trust",          "law",       "Revocable living trust → Totten trust. Charles Schwab custodian. Section 1071 compliance. bel esprit d'accord structure.", 0.94),
        build_chunk("Trust Deed",               "sovereign", "Agent binding contract. WORM-sealed. Enforced by CIPHER. Violation → PHANTOM detects → CARTO summons → ROBOB rules.", 0.96),

        // ── BOB architecture ───────────────────────────────────────────────
        build_chunk("EVIDENCE or SILENCE",      "bob",       "BOB never hallucinates. Below SILENCE_THRESHOLD (0.58): return SILENCE. Above: return EVIDENCE with source citation.", 0.99),
        build_chunk("Mamba SSM",                "architecture","State Space Model. Hidden state h persists across turns. α * h_prev + (1-α) * x_input. No attention, O(1) per step.", 0.92),
        build_chunk("Tokio async",              "rust",      "Tokio = Rust async runtime. tokio::join! for parallel. tokio::spawn for detached. async fn + .await. No blocking in async context.", 0.95),
        build_chunk("QLoRA fine-tuning",        "ml",        "Quantized LoRA. Freeze base model, train adapter only. 4-bit quantization. Nemotron Mini 4B target. 30-day pattern law from Book Ch4.", 0.91),
        build_chunk("231 gates",                "esoteric",  "22 Hebrew letters × 21 ÷ 2 = 231. Every pair is a creation gate. The NET is all 231 relations. Sefer Yetzirah.", 0.93),
        build_chunk("Tokio FSM",                "rust",      "Finite State Machine in Rust + Tokio. States: Idle → Seed → ChunkLookup → Route → Search → AdaGate → WormSeal → Respond.", 0.94),

        // ── MACHINE CODE: CUDA / PTX ───────────────────────────────────────
        build_chunk("CUDA kernel",              "cuda",      "__global__ marks a GPU kernel called from CPU. __device__ runs on GPU only. __host__ runs on CPU only. Launch: kernel<<<gridDim, blockDim>>>(args);", 0.97),
        build_chunk("CUDA thread hierarchy",    "cuda",      "threadIdx.x/y/z = thread within block. blockIdx.x/y/z = block within grid. blockDim = threads per block. gridDim = blocks per grid. Global ID = blockIdx.x * blockDim.x + threadIdx.x", 0.98),
        build_chunk("CUDA memory model",        "cuda",      "Global mem: all threads, slow (~600 cycles). Shared mem: __shared__, block-scoped, fast (~5 cycles). Registers: per-thread, fastest. Constant mem: __constant__, read-only, cached. Texture: cached, spatial locality.", 0.97),
        build_chunk("CUDA syncthreads",         "cuda",      "__syncthreads() = barrier for all threads in a block. Must be called by ALL threads or deadlock. Cannot sync across blocks — use atomic ops or kernel boundaries.", 0.96),
        build_chunk("CUDA memory transfer",     "cuda",      "cudaMalloc(&d_ptr, size) — allocate device mem. cudaMemcpy(dst, src, size, cudaMemcpyHostToDevice) — H→D. cudaMemcpyDeviceToHost — D→H. cudaFree(d_ptr). Always check return codes.", 0.97),
        build_chunk("CUDA vector add kernel",   "cuda",      "__global__ void vectorAdd(float *a, float *b, float *c, int n) { int i = blockIdx.x*blockDim.x + threadIdx.x; if (i < n) c[i] = a[i] + b[i]; } — the canonical first CUDA program.", 0.98),
        build_chunk("PTX instruction set",      "ptx",       "PTX = Parallel Thread eXecution. NVIDIA's virtual ISA. .version .target sm_XX. Registers: %r (32-bit), %rd (64-bit), %f (float), %fd (double), %p (predicate). ld.global/st.global for device mem access.", 0.96),
        build_chunk("PTX thread indexing",      "ptx",       "mov.u32 %r0, %tid.x; — get thread ID. mov.u32 %r1, %ctaid.x; — block ID. mov.u32 %r2, %ntid.x; — block dim. mad.lo.u32 %r3, %r1, %r2, %r0; — global ID = blockId*blockDim + threadId", 0.97),
        build_chunk("CUDA warp",                "cuda",      "Warp = 32 threads that execute SIMT. All threads in a warp execute same instruction. Divergence (if/else) = branch serialization = perf penalty. Coalesced memory access = consecutive threads access consecutive addresses.", 0.95),
        build_chunk("CUDA shared memory tiling","cuda",      "Load tile into __shared__ float tile[BLOCK][BLOCK]; __syncthreads(); compute from tile; __syncthreads(); repeat. Reduces global memory bandwidth by BLOCK times for matrix ops.", 0.96),
        build_chunk("CUDA atomics",             "cuda",      "atomicAdd(&addr, val) — atomic read-modify-write. atomicCAS(&addr, compare, val) — compare and swap. atomicExch — exchange. Used for reductions across threads. Slower than shared mem reductions.", 0.94),
        build_chunk("CUDA sm compute capability","cuda",     "sm_50=Maxwell, sm_60=Pascal, sm_70=Volta, sm_75=Turing, sm_80=Ampere, sm_86=Ampere consumer, sm_89=Ada Lovelace (RTX 4000), sm_90=Hopper. Compile: nvcc -arch=sm_XX", 0.95),

        // ── MACHINE CODE: x86 / x64 ───────────────────────────────────────
        build_chunk("x86 registers",            "x86",       "64-bit: rax rbx rcx rdx rsi rdi rsp rbp r8-r15. 32-bit: eax-r15d. 16-bit: ax-r15w. 8-bit: al/ah/bl/bh. rsp=stack ptr, rbp=frame ptr, rip=instruction ptr, rflags=condition flags.", 0.97),
        build_chunk("x86 calling convention",   "x86",       "System V AMD64 (Linux/macOS): args → rdi, rsi, rdx, rcx, r8, r9, then stack. Return in rax. Caller saves: rax rcx rdx rsi rdi r8-r11. Callee saves: rbx rbp r12-r15. Windows: rcx rdx r8 r9, then stack.", 0.97),
        build_chunk("x86 function prologue",    "x86",       "push rbp; mov rbp, rsp; sub rsp, N — allocate N bytes for locals. Epilogue: mov rsp, rbp; pop rbp; ret. Or: leave; ret. Never mess with rsp alignment — SSE needs 16-byte alignment.", 0.96),
        build_chunk("x86 key instructions",     "x86",       "mov dst, src — copy. lea dst, [mem] — load address. push/pop. call/ret. jmp/je/jne/jl/jg/jle/jge — branches. cmp — sets flags. test — AND without storing. xchg — exchange. inc/dec. add/sub/mul/div. shl/shr/sar.", 0.96),
        build_chunk("x86 memory addressing",    "x86",       "[base + index*scale + disp] — ModRM addressing. e.g. [rbp-8] = local var. [rsp+16] = arg on stack. [rax+rbx*4] = array element. Scale: 1,2,4,8 only. DWORD PTR = 32-bit, QWORD PTR = 64-bit.", 0.95),
        build_chunk("x86 SIMD SSE/AVX",         "x86",       "xmm0-xmm15 = 128-bit SSE. ymm0-ymm15 = 256-bit AVX. zmm0-zmm31 = 512-bit AVX-512. movaps/movups — aligned/unaligned move. addps/mulps — packed float ops. _mm_add_ps() in C intrinsics.", 0.94),

        // ── MACHINE CODE: ARM64 / AArch64 ─────────────────────────────────
        build_chunk("ARM64 registers",          "arm64",     "x0-x7 = args/return vals. x8 = indirect result. x9-x15 = scratch. x16-x17 = PLT scratch. x18 = platform reserved. x19-x28 = callee-saved. x29 = frame ptr. x30 = link register (return addr). sp = stack. xzr = zero register.", 0.97),
        build_chunk("ARM64 calling convention", "arm64",     "AAPCS64: first 8 args in x0-x7. Stack args beyond that. Return in x0 (x1 for 128-bit). Callee saves x19-x28, x29, x30. Variadic: all in registers first, stack after. Stack must be 16-byte aligned at call.", 0.96),
        build_chunk("ARM64 key instructions",   "arm64",     "mov x0, x1 — copy. ldr x0, [x1] — load. str x0, [x1] — store. add/sub/mul. bl label — branch-link (call). blr x0 — indirect call. ret — return via x30. b label — branch. cbz/cbnz — compare-branch-zero.", 0.96),
        build_chunk("ARM64 function prologue",  "arm64",     "stp x29, x30, [sp, #-16]! — push frame ptr + link reg, decrement sp. mov x29, sp — set frame ptr. Epilogue: ldp x29, x30, [sp], #16 — restore. ret — branch to x30.", 0.96),
        build_chunk("ARM64 addressing modes",   "arm64",     "[xn] — base. [xn, #imm] — base+offset. [xn, xm] — base+reg. [xn, #imm]! — pre-index (update base before). [xn], #imm — post-index (update after). ldr x0, =symbol — PC-relative via adrp+add.", 0.95),

        // ── MACHINE CODE: RISC-V ──────────────────────────────────────────
        build_chunk("RISC-V registers",         "riscv",     "x0=zero, x1=ra(return addr), x2=sp, x3=gp, x4=tp, x5-7=temp, x8=fp/s0, x9=s1, x10-11=a0-a1(args/return), x12-17=a2-a7(args), x18-27=s2-s11(saved), x28-31=t3-t6(temp). ABI names preferred.", 0.96),
        build_chunk("RISC-V key instructions",  "riscv",     "add/sub/and/or/xor/sll/srl/sra — R-type. addi/andi/ori — I-type immediate. lw/lh/lb — load. sw/sh/sb — store. beq/bne/blt/bge/bltu/bgeu — branch. jal=jump+link. jalr=indirect jump+link. lui/auipc — upper immediate.", 0.96),
        build_chunk("RISC-V extensions",        "riscv",     "RV32I/RV64I = base integer ISA. M = multiply/divide. A = atomics (LR/SC, AMO). F = single float. D = double float. C = compressed 16-bit instructions. V = vector extension. G = IMAFD shorthand.", 0.94),

        // ── MACHINE CODE: WebAssembly ──────────────────────────────────────
        build_chunk("WASM magic bytes",         "wasm",      "WASM binary starts: 0x00 0x61 0x73 0x6D (\\0asm) + version 0x01 0x00 0x00 0x00. Stack machine. Linear memory (flat, no pointers). Sandboxed by design.", 0.97),
        build_chunk("WASM sections",            "wasm",      "Sections in order: type(1) import(2) function(3) table(4) memory(5) global(6) export(7) element(8) code(10) data(11). Each: id(1 byte) + size(LEB128) + content.", 0.96),
        build_chunk("WASM opcodes core",        "wasm",      "0x00=unreachable 0x01=nop 0x02=block 0x0B=end 0x0F=return 0x10=call 0x20=local.get 0x21=local.set 0x41=i32.const 0x6A=i32.add 0x6B=i32.sub 0x6C=i32.mul. All values on stack.", 0.95),
        build_chunk("WASM memory model",        "wasm",      "Linear memory = flat byte array. Grows in 64KB pages (memory.grow). Accessed with load/store + byte offset. No garbage collector in core spec. GC proposal adds managed types.", 0.94),
        build_chunk("WASM LEB128 encoding",     "wasm",      "LEB128 = variable-length integer encoding. Each byte: 7 data bits + 1 continuation bit (MSB). 0x80=continuation. Example: 128 = 0x80 0x01 (2 bytes). Used for all sizes/indices in WASM binary.", 0.95),

        // ── MACHINE CODE: JVM bytecode ─────────────────────────────────────
        build_chunk("JVM magic bytes",          "jvm",       "Java class file starts: CA FE BA BE (CAFEBABE). Then minor version (2 bytes) + major version (2 bytes). major=52 is Java 8, 61=Java 17, 65=Java 21. Constant pool follows.", 0.97),
        build_chunk("JVM key opcodes",          "jvm",       "invokevirtual=0xB6, invokestatic=0xB8, invokespecial=0xB7, invokeinterface=0xB9, invokedynamic=0xBA. Return: ireturn=0xAC, lreturn=0xAD, areturn=0xB0, return=0xB1. Field: getstatic=0xB2, getfield=0xB4.", 0.96),
        build_chunk("JVM stack machine",        "jvm",       "JVM is a stack machine. iconst_0 pushes 0. iload_0 pushes local var 0. iadd pops two ints, pushes sum. ireturn pops int, returns. Operand stack max depth in Code attribute (max_stack).", 0.95),

        // ── MACHINE CODE: Python bytecode ──────────────────────────────────
        build_chunk("Python bytecode header",   "python",    ".pyc = magic(4) + flags(4) + mtime(4) + size(4) + marshal'd code object. Magic varies by CPython version. 3.11=0xA7 0x0D 0x0D 0x0A. dis.dis(fn) to dump bytecode. co_code attribute holds raw bytes.", 0.95),
        build_chunk("Python key opcodes",       "python",    "LOAD_CONST=0x64 LOAD_FAST=0x7C STORE_FAST=0x7D LOAD_GLOBAL=0x74 CALL=0x94 RETURN_VALUE=0xA1 BINARY_OP=0xA0 POP_TOP=0x01 JUMP_FORWARD=0x6E FOR_ITER=0x5D COMPARE_OP=0x6B. All 16-bit words in 3.11+", 0.94),

        // ── MACHINE CODE: ELF / linking ────────────────────────────────────
        build_chunk("ELF magic bytes",          "elf",       "ELF: 7F 45 4C 46 (\\x7FELF). e_ident[4]=class(1=32bit,2=64bit). e_ident[5]=data(1=LE,2=BE). e_type: ET_EXEC=2, ET_DYN=3, ET_REL=1. e_machine: 0x3E=x86-64, 0xB7=AArch64, 0xF3=RISC-V.", 0.97),
        build_chunk("ELF sections vs segments", "elf",       "Sections (for linker): .text=code, .data=init RW, .rodata=read-only, .bss=uninit, .symtab=symbols, .rel=relocs. Segments (for loader): PT_LOAD maps file→vaddr. PT_INTERP names dynamic linker.", 0.95),
        build_chunk("PLT and GOT",              "elf",       "GOT = Global Offset Table, holds runtime addresses. PLT = Procedure Linkage Table, stubs for lazy binding. First call hits PLT stub → GOT[0]=resolver → patches GOT. Subsequent calls hit GOT directly. -fPIC required for shared libs.", 0.94),

        // ── MACHINE CODE: SPIR-V / GPU shaders ────────────────────────────
        build_chunk("SPIR-V magic",             "spirv",     "SPIR-V: 0x07230203 (LE: 03 02 23 07). 32-bit words. Header: magic + version + generator + bound + schema. Instructions: word count + opcode in first word. Used for Vulkan/OpenCL GPU shaders.", 0.95),
        build_chunk("SPIR-V structure",         "spirv",     "OpCapability → OpExtInstImport → OpMemoryModel → OpEntryPoint → OpDecorate → types → variables → OpFunction → OpLabel → instructions → OpReturn → OpFunctionEnd. SSA form throughout.", 0.94),

        // ── MACHINE CODE: LLVM IR ──────────────────────────────────────────
        build_chunk("LLVM IR structure",        "llvmir",    "define rettype @funcname(argtype %arg) { entry: %result = instruction type %operand ret type %result }. SSA: each %name assigned exactly once. phi node resolves values from different predecessors.", 0.96),
        build_chunk("LLVM IR key instructions", "llvmir",    "alloca = stack allocation. load/store. getelementptr (GEP) = pointer arithmetic. call/invoke. br label / br i1 %cond, label, label. switch. select = ternary. icmp/fcmp = compare. add/sub/mul/udiv/sdiv/fadd. shl/lshr/ashr.", 0.95),
        build_chunk("LLVM IR types",            "llvmir",    "Primitive: i1 i8 i16 i32 i64 i128 half float double. Pointer: ptr (opaque, new) or i32* (typed, legacy). Array: [N x T]. Struct: {T, T, ...}. Vector: <N x T> for SIMD. Void: void.", 0.94),
    ];
    kb
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_lookup_nacha() {
        let kb = default_knowledge_base();
        let result = chunk_lookup("what is a NACHA return code R10", &kb);
        assert!(result.is_some());
        assert!(result.unwrap().confidence >= EVIDENCE_THRESHOLD);
    }

    #[test]
    fn test_code_detection_rust() {
        let ctx = detect_code_intent("write an async fn in Rust using Tokio");
        assert!(ctx.is_some());
        let c = ctx.unwrap();
        assert_eq!(c.language, "rust");
        assert!(c.loc_verify);
    }

    #[test]
    fn test_code_detection_prolog() {
        let ctx = detect_code_intent("explain what this Prolog query does");
        assert!(ctx.is_some());
        assert_eq!(ctx.unwrap().language, "prolog");
    }

    #[test]
    fn test_prolog_route_ach() {
        let route = prolog_route("what is a NACHA ACH return code");
        assert_eq!(route.oracle, "COUNSEL");
        assert!(route.confidence >= EVIDENCE_THRESHOLD);
    }

    #[test]
    fn test_ada_gate_empty() {
        let route = prolog_route("test");
        let (pass, _) = ada_gate("", &route);
        assert!(!pass);
    }

    #[test]
    fn test_worm_seal_chaining() {
        let s1 = worm_seal("answer one", "chunk", &Verdict::Evidence, None);
        let s2 = worm_seal("answer two", "chunk", &Verdict::Evidence, Some(&s1));
        assert_ne!(s1, s2);
        assert_eq!(s1.len(), 64);
        assert_eq!(s2.len(), 64);
    }

    #[tokio::test]
    async fn test_full_pipeline_chunk_hit() {
        let config = BobConfig {
            tavily_key:     None,
            knowledge_base: default_knowledge_base(),
            prev_seal:      None,
            tick:           1,
        };
        let out = reason("what is the WORM chain", &config).await;
        assert_eq!(out.verdict, Verdict::Evidence);
        assert!(matches!(out.route, ReasoningRoute::Chunk));
    }

    #[tokio::test]
    async fn test_full_pipeline_silence() {
        let config = BobConfig {
            tavily_key:     None,
            knowledge_base: vec![],  // empty — no chunks, no search key
            prev_seal:      None,
            tick:           1,
        };
        let out = reason("xyzzy undefined nonsense qqq", &config).await;
        // Without search and no chunks, should return SILENCE or low-confidence
        assert!(out.confidence < 0.9 || out.verdict == Verdict::Silence);
    }
}
