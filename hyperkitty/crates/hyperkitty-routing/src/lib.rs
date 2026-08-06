//! # Hyperkitty Routing Pipeline
//!
//! A complete 11-stage routing pipeline for intelligent message dispatch across expert agents.
//!
//! ## Pipeline Stages
//!
//! 1. **RegexParser** — tokenize input, reject blocked patterns
//! 2. **ASTBuilder** — construct typed inverted AST
//! 3. **SymbolicGraph** — convert to weighted adjacency matrix
//! 4. **JordanTransformer** — spectral radius, Jordan decomposition
//! 5. **JacobianLens** — route sensitivity, dead paths
//! 6. **ConstraintEval** — evaluate validity predicates
//! 7. **SparseActivation** — expert activation set
//! 8. **RoutingNodes** — convert activations to nodes
//! 9. **NANDFilter** — remove incompatible routes
//! 10. **AgentDispatch** — execute admitted experts
//! 11. **MergeOutput** — recombine under merge policy

pub mod pipeline;
pub mod nodes;
pub mod dispatch;
pub mod qra_dispatch;

pub use pipeline::{RoutingPipeline, PipelineState};
pub use nodes::RoutingNode;
pub use dispatch::Dispatcher;
pub use qra_dispatch::{QRADispatcher, QRADispatchResult};

/// Route a message through the complete 11-stage pipeline
pub fn route_message(input: &str) -> hyperkitty_core::Result<String> {
    let pipeline = RoutingPipeline::new();
    pipeline.process(input)
}

/// Route a message with custom dispatcher
pub fn route_with_dispatcher(
    input: &str,
    _dispatcher: &mut Dispatcher,
) -> hyperkitty_core::Result<String> {
    route_message(input)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_route_message_valid_input() {
        let result = route_message("test input");
        assert!(result.is_ok());
    }

    #[test]
    fn test_route_message_empty_input() {
        let result = route_message("");
        assert!(result.is_err());
    }

    #[test]
    fn test_route_message_contains_output() {
        let result = route_message("hello world");
        assert!(result.is_ok());
        assert!(result.unwrap().contains("routed"));
    }

    #[test]
    fn test_route_with_dispatcher() {
        let mut dispatcher = Dispatcher::new();
        let result = route_with_dispatcher("test", &mut dispatcher);
        assert!(result.is_ok());
    }
}
