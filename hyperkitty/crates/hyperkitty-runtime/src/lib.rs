pub mod world;
pub mod action;
pub mod proof;
pub mod tick;
pub mod advancement;
pub mod validity;
pub mod reconciliation;
pub mod cminus_bridge;

pub use world::WorldState;
pub use action::Action;
pub use proof::{ProofObligation, ProofCertificate};
pub use tick::Tick;
pub use advancement::Runtime;
pub use validity::{ValidityPredicate, ValidityInput, ValidityDecision, ValidityGate};
pub use reconciliation::{ReconciliationProtocol, ReconciliationDecision, ReconciliationState};
pub use cminus_bridge::RouteDecision;

pub fn create_runtime() -> Runtime {
    Runtime::new()
}
