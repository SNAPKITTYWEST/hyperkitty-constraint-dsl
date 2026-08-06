use hyperkitty_core::{Glyph, MAX_ENTROPY};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValidityGate {
    Balance,
    Invariant,
    Entropy,
    Proof,
    Reconciliation,
    Route,
}

#[derive(Debug, Clone)]
pub struct ValidityInput {
    pub current_state: Glyph,
    pub previous_state: Glyph,
    pub route_result: Option<Glyph>,
    pub entropy: f64,
    pub proof_exists: bool,
    pub invariant_ok: bool,
}

#[derive(Debug, Clone)]
pub struct ValidityDecision {
    pub accepted: bool,
    pub balance_ok: bool,
    pub invariant_ok: bool,
    pub entropy_ok: bool,
    pub proof_ok: bool,
    pub reconciliation_ok: bool,
    pub route_ok: bool,
    pub failed_gate: Option<ValidityGate>,
    pub measured_entropy: f64,
}

impl ValidityDecision {
    pub fn reject(gate: ValidityGate, entropy: f64) -> Self {
        ValidityDecision {
            accepted: false,
            balance_ok: false,
            invariant_ok: false,
            entropy_ok: false,
            proof_ok: false,
            reconciliation_ok: false,
            route_ok: false,
            failed_gate: Some(gate),
            measured_entropy: entropy,
        }
    }

    pub fn accept() -> Self {
        ValidityDecision {
            accepted: true,
            balance_ok: true,
            invariant_ok: true,
            entropy_ok: true,
            proof_ok: true,
            reconciliation_ok: true,
            route_ok: true,
            failed_gate: None,
            measured_entropy: 0.0,
        }
    }
}

pub struct ValidityPredicate {
    entropy_threshold: f64,
}

impl ValidityPredicate {
    pub fn new() -> Self {
        ValidityPredicate {
            entropy_threshold: MAX_ENTROPY,
        }
    }

    pub fn check(&self, input: &ValidityInput) -> ValidityDecision {
        // Gate 1: Route must exist and be valid
        if input.route_result.is_none() {
            return ValidityDecision::reject(ValidityGate::Route, input.entropy);
        }

        // Gate 2: Entropy must be finite and within bound
        if !input.entropy.is_finite() || input.entropy < 0.0 {
            return ValidityDecision::reject(ValidityGate::Entropy, input.entropy);
        }

        if input.entropy > self.entropy_threshold {
            return ValidityDecision::reject(ValidityGate::Entropy, input.entropy);
        }

        // Gate 3: Proof must exist
        if !input.proof_exists {
            return ValidityDecision::reject(ValidityGate::Proof, input.entropy);
        }

        // Gate 4: Invariant must be preserved
        if !input.invariant_ok {
            return ValidityDecision::reject(ValidityGate::Invariant, input.entropy);
        }

        // Gate 5: Balance (route consistency)
        let current_idx = input.current_state.index();
        let previous_idx = input.previous_state.index();
        if current_idx >= 6 || previous_idx >= 6 {
            return ValidityDecision::reject(ValidityGate::Balance, input.entropy);
        }

        // All gates pass
        ValidityDecision::accept()
    }
}

impl Default for ValidityPredicate {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validity_predicate_accepts_valid_input() {
        let pred = ValidityPredicate::new();
        let input = ValidityInput {
            current_state: Glyph::Pi,
            previous_state: Glyph::Gamma,
            route_result: Some(Glyph::Delta),
            entropy: 0.15,
            proof_exists: true,
            invariant_ok: true,
        };
        let decision = pred.check(&input);
        assert!(decision.accepted);
        assert_eq!(decision.failed_gate, None);
    }

    #[test]
    fn test_validity_predicate_rejects_missing_route() {
        let pred = ValidityPredicate::new();
        let input = ValidityInput {
            current_state: Glyph::Pi,
            previous_state: Glyph::Gamma,
            route_result: None,
            entropy: 0.15,
            proof_exists: true,
            invariant_ok: true,
        };
        let decision = pred.check(&input);
        assert!(!decision.accepted);
        assert_eq!(decision.failed_gate, Some(ValidityGate::Route));
    }

    #[test]
    fn test_validity_predicate_rejects_high_entropy() {
        let pred = ValidityPredicate::new();
        let input = ValidityInput {
            current_state: Glyph::Pi,
            previous_state: Glyph::Gamma,
            route_result: Some(Glyph::Delta),
            entropy: 0.25,
            proof_exists: true,
            invariant_ok: true,
        };
        let decision = pred.check(&input);
        assert!(!decision.accepted);
        assert_eq!(decision.failed_gate, Some(ValidityGate::Entropy));
    }

    #[test]
    fn test_validity_predicate_rejects_missing_proof() {
        let pred = ValidityPredicate::new();
        let input = ValidityInput {
            current_state: Glyph::Pi,
            previous_state: Glyph::Gamma,
            route_result: Some(Glyph::Delta),
            entropy: 0.15,
            proof_exists: false,
            invariant_ok: true,
        };
        let decision = pred.check(&input);
        assert!(!decision.accepted);
        assert_eq!(decision.failed_gate, Some(ValidityGate::Proof));
    }

    #[test]
    fn test_validity_predicate_rejects_nonfinite_entropy() {
        let pred = ValidityPredicate::new();
        let input = ValidityInput {
            current_state: Glyph::Pi,
            previous_state: Glyph::Gamma,
            route_result: Some(Glyph::Delta),
            entropy: f64::NAN,
            proof_exists: true,
            invariant_ok: true,
        };
        let decision = pred.check(&input);
        assert!(!decision.accepted);
        assert_eq!(decision.failed_gate, Some(ValidityGate::Entropy));
    }
}
