/**
 * BOB ARTIFACT MONOREPO — Type Definitions & Schema
 * All work in tools consolidated into artifact types
 */

// =====================================================================
// ARTIFACT TYPES (QuantumPiper)
// =====================================================================

export enum ArtifactType {
  FortranModule = "FortranModule",
  CmmModule = "CmmModule",
  MLIRModule = "MLIRModule",
  LLVMModule = "LLVMModule",
  PulseSchedule = "PulseSchedule",
  IsabelleTheorem = "IsabelleTheorem",
  ProofCertificate = "ProofCertificate",
  ConfigFile = "ConfigFile",
  BinaryELF = "BinaryELF",
  WASMModule = "WASMModule",
}

// =====================================================================
// VERIFICATION STATUSES
// =====================================================================

export type VerificationStatus =
  | "Unverified"
  | "TypeChecked"
  | { Alive2Verified: string[] }
  | "IsabelleProven"
  | "QuantumValidated";

// =====================================================================
// EXECUTION REALMS
// =====================================================================

export enum Realm {
  Hamiltonian = "Hamiltonian",        // Quantum state evolution
  Trotter = "Trotter",                // Trotter decomposition
  Pulse = "Pulse",                    // Pulse schedule compilation
  Verification = "Verification",      // Formal theorem proving
  QuantumIR = "QuantumIR",            // Intermediate representation
  Runtime = "Runtime",                // Execution engine
  WORM = "WORM",                      // Immutable attestation
}

// =====================================================================
// QUANTUM PROPERTIES
// =====================================================================

export interface QuantumProperties {
  entanglementEntropy?: number;       // S(ρ)
  fidelity?: number;                  // ⟨ψ|φ⟩
  purity?: number;                    // Tr(ρ²)
  correlationLength?: number;
  energyExpectation?: number;         // ⟨H⟩
  phDecay?: number;                   // φ-decay from Thermal monad
}

// =====================================================================
// ARTIFACT METADATA
// =====================================================================

export interface ArtifactMetadata {
  timestamp: number;
  team: string;
  verificationStatus: VerificationStatus;
  quantumProps: QuantumProperties;
  sizeBytes: number;
  isImmutable: boolean;
}

// =====================================================================
// CORE ARTIFACT TYPE
// =====================================================================

export interface QArtifact {
  hash: string;                       // Blake3 content hash
  type: ArtifactType;
  realm: Realm;
  team: string;                       // Agent/team that produced it
  content: Uint8Array | string;
  metadata: ArtifactMetadata;
  dependencies: Map<string, string>;  // artifact_name -> hash
  wormAnchor?: string;                // WORM chain transaction hash
}

// =====================================================================
// WORM CHAIN TYPES
// =====================================================================

export interface WORMTx {
  hash: string;                       // Blake3 hash of artifact
  timestamp: number;
  signature: string;                  // Ed25519 signature
  artifactType: ArtifactType;
  height: number;                     // Chain height
}

export interface WORMChain {
  genesis: WORMTx;
  blocks: WORMTx[];
  height: number;                     // Total blocks
}

// =====================================================================
// ARTIFACT STORE
// =====================================================================

export interface ArtifactStore {
  artifacts: Map<string, QArtifact>;
  wormChain: WORMChain;
  proofCache: Map<string, boolean>;
  capabilityStore: Map<string, Permission>;
}

export enum Permission {
  Read = "Read",
  Write = "Write",
  Verify = "Verify",
  Calibrate = "Calibrate",
  Deploy = "Deploy",
  Attest = "Attest",
  Admin = "Admin",
}

// =====================================================================
// STAGE EXECUTORS (11-STAGE PIPELINE)
// =====================================================================

export enum PipelineStage {
  Fortran = "Fortran",                // Stage 1: Polynomial proofs
  Cmm = "Cmm",                        // Stage 2: C-- code gen
  MLIR = "MLIR",                      // Stage 3: Polyhedral fusion
  LLVM = "LLVM",                      // Stage 4: LLVM optimization
  Alive2 = "Alive2",                  // Stage 5: IR verification
  Isabelle = "Isabelle",              // Stage 6: Theorem proving
  QuantumVerify = "QuantumVerify",    // Stage 7: Circuit validation
  PulseCompile = "PulseCompile",      // Stage 8: Pulse scheduling
  WASM = "WASM",                      // Stage 9: WebAssembly
  Native = "Native",                  // Stage 10: Native code
  Custom = "Custom",                  // Stage 11: Custom execution
}

// =====================================================================
// MANIFEST (ORCHESTRATION INPUT)
// =====================================================================

export interface QPManifest {
  version: string;
  name: string;
  stages: PipelineStageConfig[];
  inputs: ArtifactReference[];
  outputs: ArtifactReference[];
  wormAttest: boolean;
  timeout: number;                    // seconds
}

export interface PipelineStageConfig {
  stage: PipelineStage;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface ArtifactReference {
  name: string;
  hash: string;
  type: ArtifactType;
}

// =====================================================================
// QUANTUM PROPERTIES (RICH)
// =====================================================================

export interface Claim {
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // Refinement level
  property: string;
  proven: boolean;
}

export interface RefinementType {
  base: string;
  predicate: string;                  // {v : T | P v}
  claims: Claim[];
}

// =====================================================================
// PHASE 3 PRODUCTION COMPONENTS
// =====================================================================

export interface IsabelleSession {
  sessionId: string;
  workdir: string;
  theorems: Map<string, IsabelleProof>;
}

export interface IsabelleProof {
  theorem: string;
  proof: string;
  status: "Unproven" | "Pending" | "Success" | "Failed";
  timestamp: number;
}

export interface GraniteModel {
  modelId: string;                    // "ibm/granite-13b"
  version: string;
  context: number;                    // 4096 | 8192 | 32768
  vocabSize: number;
  quantization: "Q4_K" | "Q8_0" | "F16" | "BF16" | "F32";
  parameters: Record<string, unknown>;
}

export interface WebGPUDevice {
  deviceId: string;
  backend: "Metal" | "Vulkan" | "DirectX12" | "OpenGL";
  maxComputeWorkgroups: [number, number, number];
  maxWorkgroupSize: number;
}

export interface TerminalSession {
  sessionId: string;
  rows: number;
  cols: number;
  backend: "WinConsole" | "UnixPTY" | "VirtualTerminal";
  history: string[];
}

// =====================================================================
// INTEGRATION BRIDGES
// =====================================================================

export interface QuantumGovernance {
  stateTransitions: Map<string, string>;
  capabilityTokens: Map<string, Permission>;
  quantumMonad: RefinementType;
}

export interface ResonanceGraph {
  vertices: Map<string, unknown>;
  edges: Array<[string, string]>;
  phi: number;                        // Golden ratio
  topologicalOrder: string[];
}

// =====================================================================
// END-TO-END ARTIFACT FLOW
// =====================================================================

export interface ArtifactPipeline {
  manifest: QPManifest;
  store: ArtifactStore;
  wormChain: WORMChain;
  stages: Map<PipelineStage, QArtifact[]>;
  finalArtifact: QArtifact;
}
