//! HyperKitty Art Layer - Formal Proofs to Visual Artifacts
//!
//! Bridges:
//! - Lean 4/Agda theorems → Visual AST
//! - Visual AST → Scene Graph
//! - Scene Graph → Multi-backend renderers (SVG, Canvas, WebGL, PNG, PDF, GIF, WebM)
//! - All artifacts sealed via WORM cryptographic receipts

pub mod theorem_ast;
pub mod scene_graph;
pub mod renderer;
pub mod receipt;

pub use theorem_ast::{TheoremAst, TheoremKind, ProofStep};
pub use scene_graph::{SceneGraph, Node, Transform, Color};
pub use renderer::{Renderer, RenderFormat};
pub use receipt::{ArtifactReceipt, receipt_from_artifact};

use sha2::{Sha256, Digest};
use std::io::Write;

/// Complete pipeline: Theorem → Scene → Rendered → Receipt
pub struct VisualizationPipeline {
    theorem: TheoremAst,
    scene: SceneGraph,
    rendered: Vec<u8>,
    receipt: ArtifactReceipt,
}

impl VisualizationPipeline {
    pub fn new(theorem: TheoremAst) -> Self {
        let scene = SceneGraph::from_theorem(&theorem);
        Self {
            theorem,
            scene,
            rendered: vec![],
            receipt: ArtifactReceipt::default(),
        }
    }

    pub fn render(&mut self, format: RenderFormat) -> Result<Vec<u8>, String> {
        let renderer = Renderer::new(format);
        self.rendered = renderer.render(&self.scene)?;

        // Seal with WORM receipt
        let mut hasher = Sha256::new();
        hasher.write_all(&self.rendered).map_err(|e| e.to_string())?;
        let hash = hasher.finalize();

        self.receipt = ArtifactReceipt {
            theorem_name: self.theorem.name.clone(),
            format: format,
            hash: format!("{:x}", hash),
            size: self.rendered.len(),
        };

        Ok(self.rendered.clone())
    }

    pub fn receipt(&self) -> &ArtifactReceipt {
        &self.receipt
    }

    pub fn scene(&self) -> &SceneGraph {
        &self.scene
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pipeline_creation() {
        let theorem = TheoremAst {
            name: "QLG Sphere".to_string(),
            kind: TheoremKind::QLGSphere,
            proof_steps: vec![],
        };
        let pipeline = VisualizationPipeline::new(theorem);
        assert_eq!(pipeline.theorem.name, "QLG Sphere");
    }
}
