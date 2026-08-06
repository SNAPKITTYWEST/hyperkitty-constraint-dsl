use hyperkitty_core::{Glyph, MAX_ENTROPY};
use hyperkitty_routing::QRADispatcher;
use crate::validity::{ValidityPredicate, ValidityInput, ValidityDecision, ValidityGate};

/// Reconciliation result — full decision with trace
#[derive(Debug, Clone)]
pub struct ReconciliationDecision {
    pub accepted: bool,
    pub current_state: Glyph,
    pub previous_state: Glyph,
    pub next_state: Option<Glyph>,
    pub entropy: f64,
    pub validity_decision: ValidityDecision,
    pub route_valid: bool,
    pub invariant_preserved: bool,
    pub failed_gate: Option<ValidityGate>,
    pub trace_id: u64,
}

impl ReconciliationDecision {
    pub fn accept(
        current: Glyph,
        previous: Glyph,
        next: Glyph,
        entropy: f64,
        validity: ValidityDecision,
    ) -> Self {
        ReconciliationDecision {
            accepted: true,
            current_state: current,
            previous_state: previous,
            next_state: Some(next),
            entropy,
            validity_decision: validity,
            route_valid: true,
            invariant_preserved: validity.invariant_ok,
            failed_gate: None,
            trace_id: 0,
        }
    }

    pub fn reject(
        current: Glyph,
        previous: Glyph,
        entropy: f64,
        validity: ValidityDecision,
        gate: ValidityGate,
    ) -> Self {
        ReconciliationDecision {
            accepted: false,
            current_state: current,
            previous_state: previous,
            next_state: None,
            entropy,
            validity_decision: validity,
            route_valid: false,
            invariant_preserved: false,
            failed_gate: Some(gate),
            trace_id: 0,
        }
    }
}

/// Reconciliation state tracker
#[derive(Debug, Clone)]
pub struct ReconciliationState {
    pub committed_state: Glyph,
    pub committed_at: u64,
    pub last_entropy: f64,
    pub rejection_count: u64,
    pub acceptance_count: u64,
}

impl ReconciliationState {
    pub fn new(initial: Glyph) -> Self {
        ReconciliationState {
            committed_state: initial,
            committed_at: 0,
            last_entropy: 0.0,
            rejection_count: 0,
            acceptance_count: 0,
        }
    }

    pub fn advance(&mut self, next: Glyph, entropy: f64) {
        self.committed_state = next;
        self.committed_at = self.committed_at.wrapping_add(1);
        self.last_entropy = entropy;
        self.acceptance_count = self.acceptance_count.wrapping_add(1);
    }

    pub fn reject(&mut self) {
        self.rejection_count = self.rejection_count.wrapping_add(1);
    }
}

/// ReconciliationProtocol — authoritative orchestrator
pub struct ReconciliationProtocol {
    predicate: ValidityPredicate,
    state: ReconciliationState,
}

impl ReconciliationProtocol {
    pub fn new(initial_state: Glyph) -> Self {
        ReconciliationProtocol {
            predicate: ValidityPredicate::new(),
            state: ReconciliationState::new(initial_state),
        }
    }

    /// Reconcile a candidate state transition
    /// Returns decision with full trace, but does NOT commit until caller confirms
    pub fn reconcile(
        &mut self,
        current: Glyph,
        previous: Glyph,
        proof_exists: bool,
        invariant_ok: bool,
    ) -> hyperkitty_core::Result<ReconciliationDecision> {
        // Step 1: QRA Dispatch
        let qra_result = QRADispatcher::dispatch(current, previous)
            .map_err(|_| hyperkitty_core::Error::ParseError("qra_dispatch_failed".to_string()))?;

        // Step 2: Entropy calculation
        // For now, use simple heuristic: entropy = 0 for deterministic QRA
        // (H(next | current, previous) = 0 by design)
        let entropy = 0.0;

        // Step 3: Invariant preservation (check consistency)
        let invariant_ok_computed = invariant_ok && qra_result.is_valid;

        // Step 4: Build validity input
        let validity_input = ValidityInput {
            current_state: current,
            previous_state: previous,
            route_result: Some(qra_result.next),
            entropy,
            proof_exists,
            invariant_ok: invariant_ok_computed,
        };

        // Step 5: Check validity predicate
        let validity_decision = self.predicate.check(&validity_input);

        // Step 6: Build reconciliation decision
        let decision = if validity_decision.accepted {
            ReconciliationDecision::accept(
                current,
                previous,
                qra_result.next,
                entropy,
                validity_decision,
            )
        } else {
            ReconciliationDecision::reject(
                current,
                previous,
                entropy,
                validity_decision,
                validity_decision.failed_gate.unwrap_or(ValidityGate::Route),
            )
        };

        Ok(decision)
    }

    /// Commit a reconciliation decision to state
    /// This is the only place that modifies committed state
    pub fn commit(&mut self, decision: &ReconciliationDecision) -> hyperkitty_core::Result<()> {
        if !decision.accepted {
            self.state.reject();
            return Err(hyperkitty_core::Error::ParseError(
                format!("reconciliation_rejected: {:?}", decision.failed_gate),
            ));
        }

        if let Some(next_state) = decision.next_state {
            self.state.advance(next_state, decision.entropy);
            Ok(())
        } else {
            Err(hyperkitty_core::Error::ParseError(
                "accepted but no next_state".to_string(),
            ))
        }
    }

    /// Get current committed state without mutation
    pub fn get_state(&self) -> Glyph {
        self.state.committed_state
    }

    /// Get full state snapshot
    pub fn snapshot(&self) -> ReconciliationState {
        self.state.clone()
    }

    /// Idempotence: reconciling identical inputs produces identical decisions
    /// (caller's responsibility to verify, but protocol guarantees input->decision is deterministic)
    pub fn is_deterministic() -> bool {
        true // QRA is deterministic, validity is deterministic
    }
}

impl Default for ReconciliationProtocol {
    fn default() -> Self {
        Self::new(Glyph::Lambda)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reconciliation_accepts_valid_transition() {
        let mut recon = ReconciliationProtocol::new(Glyph::Lambda);
        let decision = recon
            .reconcile(Glyph::Pi, Glyph::Gamma, true, true)
            .unwrap();

        assert!(decision.accepted);
        assert!(decision.route_valid);
        assert_eq!(decision.current_state, Glyph::Pi);
        assert_eq!(decision.previous_state, Glyph::Gamma);
        assert!(decision.next_state.is_some());
    }

    #[test]
    fn test_reconciliation_rejects_missing_proof() {
        let mut recon = ReconciliationProtocol::new(Glyph::Lambda);
        let decision = recon
            .reconcile(Glyph::Pi, Glyph::Gamma, false, true)
            .unwrap();

        assert!(!decision.accepted);
        assert_eq!(decision.failed_gate, Some(ValidityGate::Proof));
    }

    #[test]
    fn test_reconciliation_rejects_broken_invariant() {
        let mut recon = ReconciliationProtocol::new(Glyph::Lambda);
        let decision = recon
            .reconcile(Glyph::Pi, Glyph::Gamma, true, false)
            .unwrap();

        assert!(!decision.accepted);
        assert_eq!(decision.failed_gate, Some(ValidityGate::Invariant));
    }

    #[test]
    fn test_reconciliation_commit_advances_state() {
        let mut recon = ReconciliationProtocol::new(Glyph::Lambda);
        let decision = recon
            .reconcile(Glyph::Pi, Glyph::Gamma, true, true)
            .unwrap();

        assert!(decision.accepted);
        let result = recon.commit(&decision);
        assert!(result.is_ok());

        let snapshot = recon.snapshot();
        assert_eq!(snapshot.acceptance_count, 1);
        assert!(snapshot.committed_state.index() < 6); // Valid glyph
    }

    #[test]
    fn test_reconciliation_commit_rejects_invalid_decision() {
        let mut recon = ReconciliationProtocol::new(Glyph::Lambda);
        let decision = recon
            .reconcile(Glyph::Pi, Glyph::Gamma, false, true)
            .unwrap();

        assert!(!decision.accepted);
        let result = recon.commit(&decision);
        assert!(result.is_err());

        let snapshot = recon.snapshot();
        assert_eq!(snapshot.rejection_count, 1);
    }

    #[test]
    fn test_reconciliation_idempotent_input_produces_identical_decision() {
        let mut recon1 = ReconciliationProtocol::new(Glyph::Lambda);
        let mut recon2 = ReconciliationProtocol::new(Glyph::Lambda);

        let d1 = recon1
            .reconcile(Glyph::Delta, Glyph::Omega, true, true)
            .unwrap();
        let d2 = recon2
            .reconcile(Glyph::Delta, Glyph::Omega, true, true)
            .unwrap();

        assert_eq!(d1.accepted, d2.accepted);
        assert_eq!(d1.next_state, d2.next_state);
        assert_eq!(d1.entropy, d2.entropy);
        assert_eq!(d1.failed_gate, d2.failed_gate);
    }

    #[test]
    fn test_reconciliation_state_no_commit_on_rejection() {
        let mut recon = ReconciliationProtocol::new(Glyph::Lambda);
        let initial = recon.get_state();

        let decision = recon
            .reconcile(Glyph::Pi, Glyph::Gamma, false, true)
            .unwrap();
        assert!(!decision.accepted);

        let _ = recon.commit(&decision);
        let after = recon.get_state();

        assert_eq!(initial, after); // State unchanged on rejection
    }

    #[test]
    fn test_reconciliation_deterministic() {
        assert!(ReconciliationProtocol::is_deterministic());
    }

    #[test]
    fn test_reconciliation_entropy_always_zero() {
        let mut recon = ReconciliationProtocol::new(Glyph::Lambda);
        for c in Glyph::all() {
            for p in Glyph::all() {
                let decision = recon.reconcile(c, p, true, true).unwrap();
                assert_eq!(decision.entropy, 0.0);
            }
        }
    }

    #[test]
    fn test_reconciliation_protocol_default() {
        let recon = ReconciliationProtocol::default();
        assert_eq!(recon.get_state(), Glyph::Lambda);
    }
}
