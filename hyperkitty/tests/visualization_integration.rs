//! Integration tests: Formal Proofs → Visualization → WORM Receipts
use hyperkitty_art::{
    TheoremAst, TheoremKind, SceneGraph, Renderer, RenderFormat, VisualizationPipeline,
    receipt_from_artifact,
};

#[test]
fn qlg_sphere_proof_to_svg() {
    let theorem = TheoremAst::qlg_sphere();
    let scene = SceneGraph::from_theorem(&theorem);

    assert_eq!(theorem.name, "QLG Sphere Invariant");
    assert_eq!(scene.name, "QLG Sphere");
    assert_eq!(scene.root.children.len(), 0);
}

#[test]
fn sla_balance_proof_to_visualization() {
    let theorem = TheoremAst::sla_balance();
    let scene = SceneGraph::from_theorem(&theorem);

    assert_eq!(scene.root.children.len(), 2);
    assert_eq!(scene.root.children[0].label, Some("Debit (δ)".to_string()));
    assert_eq!(scene.root.children[1].label, Some("Credit (ι)".to_string()));
}

#[test]
fn witness_exhaustion_animated_proof() {
    let theorem = TheoremAst::witness_exhaustion();
    let scene = SceneGraph::from_theorem(&theorem);

    assert_eq!(scene.root.children.len(), 3);
    for (i, child) in scene.root.children.iter().enumerate() {
        assert!(child.label.is_some());
        let expected_step = format!("Step {}", i);
        assert_eq!(child.label.as_ref().unwrap(), &expected_step);
    }
}

#[test]
fn nand_completeness_gates_visualization() {
    let theorem = TheoremAst::nand_completeness();
    let scene = SceneGraph::from_theorem(&theorem);

    assert_eq!(scene.root.children.len(), 3);
    let gates = ["NOT", "AND", "OR"];
    for (i, gate) in gates.iter().enumerate() {
        assert_eq!(scene.root.children[i].label, Some(gate.to_string()));
    }
}

#[test]
fn pipeline_theorem_to_receipt() {
    let theorem = TheoremAst::qlg_sphere();
    let mut pipeline = VisualizationPipeline::new(theorem);

    let svg = pipeline.render(RenderFormat::SVG).unwrap();
    assert!(!svg.is_empty());

    let receipt = pipeline.receipt();
    assert_eq!(receipt.theorem_name, "QLG Sphere Invariant");
    assert_eq!(receipt.format, RenderFormat::SVG);
    assert_eq!(receipt.size, svg.len());
}

#[test]
fn multi_format_rendering() {
    let theorem = TheoremAst::sla_balance();
    let mut pipeline = VisualizationPipeline::new(theorem);

    // SVG render
    let svg = pipeline.render(RenderFormat::SVG).unwrap();
    assert!(svg.len() > 0);

    // Canvas render
    let canvas = pipeline.render(RenderFormat::Canvas).unwrap();
    assert!(canvas.len() > 0);

    // WebGL render
    let webgl = pipeline.render(RenderFormat::WebGL).unwrap();
    assert!(webgl.len() > 0);

    // All should have different content
    assert_ne!(svg, canvas);
    assert_ne!(canvas, webgl);
}

#[test]
fn receipt_verification() {
    let artifact_data = b"test visualization artifact";
    let receipt = receipt_from_artifact(
        "Test Theorem".to_string(),
        RenderFormat::SVG,
        artifact_data,
    )
    .unwrap();

    // Verify receipt matches artifact
    assert!(receipt.verify(artifact_data).unwrap());

    // Verify fails on modified data
    let modified = b"tampered data";
    assert!(!receipt.verify(modified).unwrap());
}

#[test]
fn theorem_kinds_have_colors() {
    use hyperkitty_art::Color;

    let kinds = [
        TheoremKind::QLGSphere,
        TheoremKind::SLABalance,
        TheoremKind::QRAIdentity,
        TheoremKind::QRAAbsorber,
        TheoremKind::WitnessExhaustion,
        TheoremKind::TripartiteIso,
        TheoremKind::JordanCommutativity,
        TheoremKind::NANDCompleteness,
    ];

    for kind in kinds.iter() {
        let color = Color::theorem_color(kind);
        assert!(color.r > 0 || color.g > 0 || color.b > 0);
    }
}

#[test]
fn svg_output_validity() {
    let theorem = TheoremAst::qlg_sphere();
    let mut pipeline = VisualizationPipeline::new(theorem);
    let svg = pipeline.render(RenderFormat::SVG).unwrap();
    let svg_str = String::from_utf8(svg).unwrap();

    assert!(svg_str.contains("<?xml"));
    assert!(svg_str.contains("<svg"));
    assert!(svg_str.contains("</svg>"));
    assert!(svg_str.contains("QLG Sphere"));
}

#[test]
fn canvas_json_output_validity() {
    let theorem = TheoremAst::sla_balance();
    let mut pipeline = VisualizationPipeline::new(theorem);
    let canvas_data = pipeline.render(RenderFormat::Canvas).unwrap();
    let canvas_str = String::from_utf8(canvas_data).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&canvas_str).unwrap();

    assert_eq!(parsed["type"], "canvas_2d");
    assert!(parsed["elements"].is_array());
}

#[test]
fn scene_graph_bounds_consistency() {
    let theorems = vec![
        TheoremAst::qlg_sphere(),
        TheoremAst::sla_balance(),
        TheoremAst::witness_exhaustion(),
    ];

    for theorem in theorems {
        let scene = SceneGraph::from_theorem(&theorem);
        let (x_min, y_min, x_max, y_max) = scene.bounds;

        assert!(x_min < x_max);
        assert!(y_min < y_max);
        assert!(x_max - x_min > 0.0);
        assert!(y_max - y_min > 0.0);
    }
}
