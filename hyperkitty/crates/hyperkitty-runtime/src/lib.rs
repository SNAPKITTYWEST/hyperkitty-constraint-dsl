pub mod world;
pub mod action;
pub mod proof;
pub mod tick;
pub mod advancement;
pub mod validity;

pub use world::WorldState;
pub use action::Action;
pub use proof::{ProofObligation, ProofCertificate};
pub use tick::Tick;
pub use advancement::Runtime;
pub use validity::{ValidityPredicate, ValidityInput, ValidityDecision, ValidityGate};

pub fn create_runtime() -> Runtime {
    Runtime::new()
}
