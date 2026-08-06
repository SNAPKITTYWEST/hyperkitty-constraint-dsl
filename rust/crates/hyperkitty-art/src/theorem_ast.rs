//! Theorem AST - Represents formal proofs as visual data structures
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TheoremKind {
    QLGSphere,           // x² + y² + z² = 1
    SLABalance,          // δ + ι = 0
    QRAIdentity,         // Q[Λ][j] = j
    QRAAbsorber,         // Q[Ω][j] = Ω
    WitnessExhaustion,   // witness → [Ω,Ω,Ω] in 2 steps
    TripartiteIso,       // K_QLG = ω_SLA = target_QRA
    JordanCommutativity, // x ∘ y = y ∘ x
    NANDCompleteness,    // All Boolean ops from NAND
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofStep {
    pub name: String,
    pub description: String,
    pub visual_hint: Option<String>, // e.g., "sphere", "arrow", "tree"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TheoremAst {
    pub name: String,
    pub kind: TheoremKind,
    pub proof_steps: Vec<ProofStep>,
}

impl TheoremAst {
    pub fn qlg_sphere() -> Self {
        Self {
            name: "QLG Sphere Invariant".to_string(),
            kind: TheoremKind::QLGSphere,
            proof_steps: vec![
                ProofStep {
                    name: "Canonical Closure".to_string(),
                    description: "All canonical points lie on unit sphere".to_string(),
                    visual_hint: Some("sphere".to_string()),
                },
                ProofStep {
                    name: "Evolution Preservation".to_string(),
                    description: "Evolution preserves sphere distance".to_string(),
                    visual_hint: Some("rotation".to_string()),
                },
            ],
        }
    }

    pub fn sla_balance() -> Self {
        Self {
            name: "SLA Balance Axiom".to_string(),
            kind: TheoremKind::SLABalance,
            proof_steps: vec![
                ProofStep {
                    name: "Debit-Credit Axiom".to_string(),
                    description: "For every debit, credit exists".to_string(),
                    visual_hint: Some("balance_scale".to_string()),
                },
            ],
        }
    }

    pub fn qra_identity() -> Self {
        Self {
            name: "QRA Identity Row".to_string(),
            kind: TheoremKind::QRAIdentity,
            proof_steps: vec![
                ProofStep {
                    name: "Row Construction".to_string(),
                    description: "Identity matrix row property".to_string(),
                    visual_hint: Some("matrix".to_string()),
                },
            ],
        }
    }

    pub fn witness_exhaustion() -> Self {
        Self {
            name: "Witness Exhaustion".to_string(),
            kind: TheoremKind::WitnessExhaustion,
            proof_steps: vec![
                ProofStep {
                    name: "Iteration 1".to_string(),
                    description: "First evolution step".to_string(),
                    visual_hint: Some("arrow".to_string()),
                },
                ProofStep {
                    name: "Iteration 2".to_string(),
                    description: "Second evolution step reaching [Ω,Ω,Ω]".to_string(),
                    visual_hint: Some("checkmark".to_string()),
                },
            ],
        }
    }

    pub fn jordan_commutativity() -> Self {
        Self {
            name: "Jordan Commutativity".to_string(),
            kind: TheoremKind::JordanCommutativity,
            proof_steps: vec![
                ProofStep {
                    name: "Product Symmetry".to_string(),
                    description: "Spin factor product is commutative".to_string(),
                    visual_hint: Some("symmetric".to_string()),
                },
            ],
        }
    }

    pub fn nand_completeness() -> Self {
        Self {
            name: "NAND Completeness".to_string(),
            kind: TheoremKind::NANDCompleteness,
            proof_steps: vec![
                ProofStep {
                    name: "NOT from NAND".to_string(),
                    description: "Derive NOT gate".to_string(),
                    visual_hint: Some("gate".to_string()),
                },
                ProofStep {
                    name: "AND from NAND".to_string(),
                    description: "Derive AND gate".to_string(),
                    visual_hint: Some("gate".to_string()),
                },
                ProofStep {
                    name: "OR from NAND".to_string(),
                    description: "Derive OR gate".to_string(),
                    visual_hint: Some("gate".to_string()),
                },
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sphere_ast() {
        let ast = TheoremAst::qlg_sphere();
        assert_eq!(ast.name, "QLG Sphere Invariant");
        assert_eq!(ast.proof_steps.len(), 2);
    }

    #[test]
    fn balance_ast() {
        let ast = TheoremAst::sla_balance();
        assert_eq!(ast.name, "SLA Balance Axiom");
    }

    #[test]
    fn witness_exhaustion_ast() {
        let ast = TheoremAst::witness_exhaustion();
        assert_eq!(ast.proof_steps.len(), 2);
    }
}
