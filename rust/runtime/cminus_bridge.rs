use hyperkitty_core::Glyph;

/// Fixed-width ABI for Rust/C-- boundary
/// All fields must be stable width across targets
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RouteDecision {
    // ABI version for safety check
    pub abi_version: u32,

    // State representation (0-5 = valid glyphs)
    pub current_state: u8,
    pub previous_state: u8,
    pub next_state: u8,
    pub padding_0: u8,

    // Validity status
    pub accepted: u32,
    pub failed_gate: u32,

    // Entropy (IEEE 754 f64)
    pub entropy: f64,
    pub entropy_ok: u32,
    pub padding_1: u32,

    // Reconciliation status
    pub reconciliation_ok: u32,
    pub route_valid: u32,
    pub invariant_preserved: u32,

    // Trace identity (WORM correlation ID)
    pub trace_id: u64,

    // Proof status
    pub proof_ok: u32,
    pub padding_2: u32,
}

impl RouteDecision {
    pub const ABI_VERSION: u32 = 1;
    pub const SIZE: usize = std::mem::size_of::<RouteDecision>();

    pub fn new(
        current: Glyph,
        previous: Glyph,
        next: Glyph,
        entropy: f64,
        accepted: bool,
        failed_gate: u32,
        entropy_ok: bool,
        reconciliation_ok: bool,
        route_valid: bool,
        invariant_ok: bool,
        trace_id: u64,
        proof_ok: bool,
    ) -> Self {
        RouteDecision {
            abi_version: Self::ABI_VERSION,
            current_state: current.to_byte(),
            previous_state: previous.to_byte(),
            next_state: next.to_byte(),
            padding_0: 0,
            accepted: if accepted { 1 } else { 0 },
            failed_gate,
            entropy,
            entropy_ok: if entropy_ok { 1 } else { 0 },
            padding_1: 0,
            reconciliation_ok: if reconciliation_ok { 1 } else { 0 },
            route_valid: if route_valid { 1 } else { 0 },
            invariant_preserved: if invariant_ok { 1 } else { 0 },
            trace_id,
            proof_ok: if proof_ok { 1 } else { 0 },
            padding_2: 0,
        }
    }

    pub fn from_reconciliation(
        decision: &crate::reconciliation::ReconciliationDecision,
    ) -> Self {
        let next = decision.next_state.unwrap_or(Glyph::Lambda);
        let failed_gate_code = match decision.failed_gate {
            None => 0,
            Some(crate::validity::ValidityGate::Balance) => 1,
            Some(crate::validity::ValidityGate::Invariant) => 2,
            Some(crate::validity::ValidityGate::Entropy) => 3,
            Some(crate::validity::ValidityGate::Proof) => 4,
            Some(crate::validity::ValidityGate::Reconciliation) => 5,
            Some(crate::validity::ValidityGate::Route) => 6,
        };

        RouteDecision::new(
            decision.current_state,
            decision.previous_state,
            next,
            decision.entropy,
            decision.accepted,
            failed_gate_code,
            decision.entropy <= crate::hyperkitty_core::MAX_ENTROPY,
            decision.validity_decision.reconciliation_ok,
            decision.route_valid,
            decision.invariant_preserved,
            decision.trace_id,
            decision.validity_decision.proof_ok,
        )
    }

    /// Validate ABI header before processing
    pub fn validate_header(&self) -> Result<(), String> {
        if self.abi_version != Self::ABI_VERSION {
            return Err(format!(
                "ABI version mismatch: expected {}, got {}",
                Self::ABI_VERSION,
                self.abi_version
            ));
        }
        Ok(())
    }

    /// Validate glyph indices are valid (0-5)
    pub fn validate_glyphs(&self) -> Result<(), String> {
        if self.current_state > 5 {
            return Err(format!("invalid current_state: {}", self.current_state));
        }
        if self.previous_state > 5 {
            return Err(format!("invalid previous_state: {}", self.previous_state));
        }
        if self.next_state > 5 {
            return Err(format!("invalid next_state: {}", self.next_state));
        }
        Ok(())
    }

    /// Validate entropy is finite and within bound
    pub fn validate_entropy(&self) -> Result<(), String> {
        if !self.entropy.is_finite() {
            return Err(format!("nonfinite entropy: {}", self.entropy));
        }
        if self.entropy < 0.0 {
            return Err(format!("negative entropy: {}", self.entropy));
        }
        if self.entropy > crate::hyperkitty_core::MAX_ENTROPY {
            return Err(format!("entropy exceeds bound: {}", self.entropy));
        }
        Ok(())
    }

    /// Full validation before C-- commits
    pub fn validate_all(&self) -> Result<(), String> {
        self.validate_header()?;
        self.validate_glyphs()?;
        self.validate_entropy()?;

        // Consistency check: accepted requires all gates OK
        if self.accepted == 1 {
            if self.entropy_ok == 0 {
                return Err("accepted but entropy_ok=0".to_string());
            }
            if self.reconciliation_ok == 0 {
                return Err("accepted but reconciliation_ok=0".to_string());
            }
            if self.route_valid == 0 {
                return Err("accepted but route_valid=0".to_string());
            }
            if self.proof_ok == 0 {
                return Err("accepted but proof_ok=0".to_string());
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_route_decision_abi_size() {
        // Ensure fixed width for ABI safety
        assert_eq!(RouteDecision::SIZE, 88);
    }

    #[test]
    fn test_route_decision_construction() {
        let decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true,
            0,
            true,
            true,
            true,
            true,
            42,
            true,
        );

        assert_eq!(decision.abi_version, RouteDecision::ABI_VERSION);
        assert_eq!(decision.accepted, 1);
        assert_eq!(decision.entropy, 0.15);
    }

    #[test]
    fn test_route_decision_validate_header_success() {
        let decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true,
            0,
            true,
            true,
            true,
            true,
            42,
            true,
        );
        assert!(decision.validate_header().is_ok());
    }

    #[test]
    fn test_route_decision_validate_header_fail() {
        let mut decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true,
            0,
            true,
            true,
            true,
            true,
            42,
            true,
        );
        decision.abi_version = 999;
        assert!(decision.validate_header().is_err());
    }

    #[test]
    fn test_route_decision_validate_glyphs_success() {
        let decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true,
            0,
            true,
            true,
            true,
            true,
            42,
            true,
        );
        assert!(decision.validate_glyphs().is_ok());
    }

    #[test]
    fn test_route_decision_validate_glyphs_fail() {
        let mut decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true,
            0,
            true,
            true,
            true,
            true,
            42,
            true,
        );
        decision.current_state = 99;
        assert!(decision.validate_glyphs().is_err());
    }

    #[test]
    fn test_route_decision_validate_entropy_success() {
        let decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true,
            0,
            true,
            true,
            true,
            true,
            42,
            true,
        );
        assert!(decision.validate_entropy().is_ok());
    }

    #[test]
    fn test_route_decision_validate_entropy_high() {
        let mut decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true,
            0,
            true,
            true,
            true,
            true,
            42,
            true,
        );
        decision.entropy = 0.25; // Exceeds MAX_ENTROPY (0.20)
        assert!(decision.validate_entropy().is_err());
    }

    #[test]
    fn test_route_decision_validate_entropy_nonfinite() {
        let mut decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true,
            0,
            true,
            true,
            true,
            true,
            42,
            true,
        );
        decision.entropy = f64::NAN;
        assert!(decision.validate_entropy().is_err());
    }

    #[test]
    fn test_route_decision_validate_all_success() {
        let decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true,
            0,
            true,
            true,
            true,
            true,
            42,
            true,
        );
        assert!(decision.validate_all().is_ok());
    }

    #[test]
    fn test_route_decision_validate_all_consistency_fail() {
        let decision = RouteDecision::new(
            Glyph::Pi,
            Glyph::Gamma,
            Glyph::Delta,
            0.15,
            true, // accepted=1
            0,
            false, // entropy_ok=0 (contradiction!)
            true,
            true,
            true,
            42,
            true,
        );
        assert!(decision.validate_all().is_err());
    }
}
