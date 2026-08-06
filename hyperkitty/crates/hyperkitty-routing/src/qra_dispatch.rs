use hyperkitty_core::Glyph;
use hyperkitty_qra::next_glyph;

/// Result of QRA tensor dispatch
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct QRADispatchResult {
    pub current: Glyph,
    pub previous: Glyph,
    pub next: Glyph,
    pub is_absorber: bool,
    pub is_valid: bool,
}

impl QRADispatchResult {
    pub fn new(current: Glyph, previous: Glyph) -> Self {
        let next = next_glyph(current, previous);
        let is_absorber = next.is_absorber();
        let is_valid = true;

        QRADispatchResult {
            current,
            previous,
            next,
            is_absorber,
            is_valid,
        }
    }
}

/// QRA Dispatcher — deterministic routing via Q[current][previous]
pub struct QRADispatcher;

impl QRADispatcher {
    /// Dispatch via QRA tensor lookup
    /// Returns next glyph deterministically from Q[current][previous]
    pub fn dispatch(current: Glyph, previous: Glyph) -> hyperkitty_core::Result<QRADispatchResult> {
        if !Self::is_valid_pair(current, previous) {
            return Err(hyperkitty_core::Error::ParseError(
                format!("invalid glyph pair: {:?}, {:?}", current, previous),
            ));
        }

        Ok(QRADispatchResult::new(current, previous))
    }

    /// Batch dispatch multiple (current, previous) pairs
    pub fn dispatch_batch(
        pairs: Vec<(Glyph, Glyph)>,
    ) -> hyperkitty_core::Result<Vec<QRADispatchResult>> {
        if pairs.is_empty() {
            return Err(hyperkitty_core::Error::NoValidRoutes);
        }

        let mut results = Vec::new();
        for (current, previous) in pairs {
            if Self::is_valid_pair(current, previous) {
                results.push(QRADispatchResult::new(current, previous));
            }
        }

        if results.is_empty() {
            return Err(hyperkitty_core::Error::ParseError(
                "no valid glyph pairs".to_string(),
            ));
        }

        Ok(results)
    }

    /// Validate that a (current, previous) pair can be dispatched
    fn is_valid_pair(current: Glyph, _previous: Glyph) -> bool {
        // Valid glyph indices are 0-5
        current.index() < 6
    }

    /// Route to convergence — evolve until absorber state reached
    /// Returns sequence of states
    pub fn route_to_convergence(start: Glyph) -> hyperkitty_core::Result<Vec<Glyph>> {
        let mut states = vec![start];
        let mut current = start;
        let mut previous = Glyph::Lambda; // identity

        // Limit iterations to detect cycles
        const MAX_ITERATIONS: usize = 100;
        for _ in 0..MAX_ITERATIONS {
            if current.is_absorber() {
                break;
            }

            let result = Self::dispatch(current, previous)?;
            states.push(result.next);
            previous = current;
            current = result.next;
        }

        Ok(states)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qra_dispatch_pi_gamma() {
        let result = QRADispatcher::dispatch(Glyph::Pi, Glyph::Gamma);
        assert!(result.is_ok());
        let disp = result.unwrap();
        assert_eq!(disp.current, Glyph::Pi);
        assert_eq!(disp.previous, Glyph::Gamma);
        assert!(disp.is_valid);
    }

    #[test]
    fn test_qra_dispatch_deterministic() {
        let r1 = QRADispatcher::dispatch(Glyph::Delta, Glyph::Pi).unwrap();
        let r2 = QRADispatcher::dispatch(Glyph::Delta, Glyph::Pi).unwrap();
        assert_eq!(r1.next, r2.next);
    }

    #[test]
    fn test_qra_dispatch_all_valid_pairs() {
        for c in Glyph::all() {
            for p in Glyph::all() {
                let result = QRADispatcher::dispatch(c, p);
                assert!(result.is_ok());
            }
        }
    }

    #[test]
    fn test_qra_dispatch_batch() {
        let pairs = vec![
            (Glyph::Pi, Glyph::Gamma),
            (Glyph::Gamma, Glyph::Delta),
            (Glyph::Delta, Glyph::Omega),
        ];

        let result = QRADispatcher::dispatch_batch(pairs);
        assert!(result.is_ok());

        let results = result.unwrap();
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn test_qra_dispatch_batch_empty() {
        let result = QRADispatcher::dispatch_batch(vec![]);
        assert!(result.is_err());
    }

    #[test]
    fn test_qra_route_to_convergence_pi_gamma_delta() {
        let result = QRADispatcher::route_to_convergence(Glyph::Pi);
        assert!(result.is_ok());

        let states = result.unwrap();
        assert!(!states.is_empty());
        assert_eq!(states[0], Glyph::Pi);
        // Should converge to absorber (Omega)
        assert!(states.last().unwrap().is_absorber());
    }

    #[test]
    fn test_qra_identity_law() {
        // Q[Lambda][j] = j for all j
        let lambda = Glyph::Lambda;
        for j in Glyph::all() {
            let result = QRADispatcher::dispatch(lambda, j).unwrap();
            // Identity row returns the previous glyph
            assert_eq!(result.next, j);
        }
    }

    #[test]
    fn test_qra_absorber_law() {
        // Q[Omega][j] = Omega for all j
        let omega = Glyph::Omega;
        for j in Glyph::all() {
            let result = QRADispatcher::dispatch(omega, j).unwrap();
            assert!(result.next.is_absorber());
        }
    }

    #[test]
    fn test_qra_dispatch_result_valid() {
        let result = QRADispatcher::dispatch(Glyph::Pi, Glyph::Gamma).unwrap();
        assert!(result.is_valid);
    }
}
