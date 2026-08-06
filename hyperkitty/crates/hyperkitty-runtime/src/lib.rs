pub mod world;
pub mod action;
pub mod proof;
pub mod tick;
pub mod advancement;
pub mod validity;
pub mod reconciliation;

pub use world::WorldState;
pub use action::Action;
pub use proof::{ProofObligation, ProofCertificate};
pub use tick::Tick;
pub use advancement::Runtime;
pub use validity::{ValidityPredicate, ValidityInput, ValidityDecision, ValidityGate};
pub use reconciliation::{ReconciliationProtocol, ReconciliationDecision, ReconciliationState};

pub fn create_runtime() -> Runtime {
    Runtime::new()
}
