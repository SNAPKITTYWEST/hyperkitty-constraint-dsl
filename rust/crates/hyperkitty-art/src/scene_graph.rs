//! Scene Graph - Intermediate representation for rendering
use crate::theorem_ast::{TheoremAst, TheoremKind};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Color {
    pub fn rgb(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b, a: 255 }
    }

    pub fn rgba(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r, g, b, a }
    }

    pub fn theorem_color(kind: &TheoremKind) -> Self {
        match kind {
            TheoremKind::QLGSphere => Self::rgb(70, 130, 180),     // Steel blue
            TheoremKind::SLABalance => Self::rgb(34, 139, 34),     // Forest green
            TheoremKind::QRAIdentity => Self::rgb(220, 20, 60),    // Crimson
            TheoremKind::QRAAbsorber => Self::rgb(139, 69, 19),    // Saddle brown
            TheoremKind::WitnessExhaustion => Self::rgb(255, 165, 0), // Orange
            TheoremKind::TripartiteIso => Self::rgb(128, 0, 128),  // Purple
            TheoremKind::JordanCommutativity => Self::rgb(0, 128, 128), // Teal
            TheoremKind::NANDCompleteness => Self::rgb(255, 20, 147), // Deep pink
            TheoremKind::Custom(_) => Self::rgb(128, 128, 128),    // Gray
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub scale: f64,
    pub rotation: f64,
}

impl Transform {
    pub fn identity() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            scale: 1.0,
            rotation: 0.0,
        }
    }

    pub fn translated(x: f64, y: f64) -> Self {
        Self {
            x,
            y,
            z: 0.0,
            scale: 1.0,
            rotation: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeGeometry {
    Sphere { radius: f64 },
    Cube { size: f64 },
    Plane { width: f64, height: f64 },
    Point { radius: f64 },
    Line { x1: f64, y1: f64, x2: f64, y2: f64 },
    Text { content: String, font_size: f64 },
    Group,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub geometry: NodeGeometry,
    pub transform: Transform,
    pub color: Color,
    pub children: Vec<Node>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneGraph {
    pub name: String,
    pub root: Node,
    pub bounds: (f64, f64, f64, f64), // (x_min, y_min, x_max, y_max)
}

impl SceneGraph {
    pub fn new(name: String) -> Self {
        Self {
            name,
            root: Node {
                id: "root".to_string(),
                geometry: NodeGeometry::Group,
                transform: Transform::identity(),
                color: Color::rgb(255, 255, 255),
                children: vec![],
                label: None,
            },
            bounds: (0.0, 0.0, 100.0, 100.0),
        }
    }

    pub fn from_theorem(theorem: &TheoremAst) -> Self {
        match theorem.kind {
            TheoremKind::QLGSphere => Self::qlg_sphere_scene(),
            TheoremKind::SLABalance => Self::sla_balance_scene(),
            TheoremKind::WitnessExhaustion => Self::witness_exhaustion_scene(),
            TheoremKind::NANDCompleteness => Self::nand_completeness_scene(),
            _ => Self::generic_theorem_scene(&theorem.name),
        }
    }

    fn qlg_sphere_scene() -> Self {
        let mut scene = Self::new("QLG Sphere".to_string());
        scene.root.geometry = NodeGeometry::Sphere { radius: 50.0 };
        scene.root.color = Color::theorem_color(&TheoremKind::QLGSphere);
        scene.root.label = Some("x² + y² + z² = 1".to_string());
        scene.bounds = (-60.0, -60.0, 60.0, 60.0);
        scene
    }

    fn sla_balance_scene() -> Self {
        let mut scene = Self::new("SLA Balance".to_string());
        let debit = Node {
            id: "debit".to_string(),
            geometry: NodeGeometry::Cube { size: 20.0 },
            transform: Transform::translated(-25.0, 0.0),
            color: Color::rgb(220, 20, 60),
            children: vec![],
            label: Some("Debit (δ)".to_string()),
        };

        let credit = Node {
            id: "credit".to_string(),
            geometry: NodeGeometry::Cube { size: 20.0 },
            transform: Transform::translated(25.0, 0.0),
            color: Color::rgb(34, 139, 34),
            children: vec![],
            label: Some("Credit (ι)".to_string()),
        };

        scene.root.children = vec![debit, credit];
        scene.bounds = (-50.0, -30.0, 50.0, 30.0);
        scene
    }

    fn witness_exhaustion_scene() -> Self {
        let mut scene = Self::new("Witness Exhaustion".to_string());
        let mut children = vec![];

        for step in 0..3 {
            let node = Node {
                id: format!("step_{}", step),
                geometry: NodeGeometry::Point { radius: 8.0 },
                transform: Transform::translated((step as f64 - 1.0) * 30.0, 0.0),
                color: Color::rgb(255, 165, 0),
                children: vec![],
                label: Some(format!("Step {}", step)),
            };
            children.push(node);
        }

        scene.root.children = children;
        scene.bounds = (-40.0, -30.0, 40.0, 30.0);
        scene
    }

    fn nand_completeness_scene() -> Self {
        let mut scene = Self::new("NAND Completeness".to_string());
        let mut children = vec![];

        for (i, gate) in ["NOT", "AND", "OR"].iter().enumerate() {
            let node = Node {
                id: format!("gate_{}", gate),
                geometry: NodeGeometry::Cube { size: 15.0 },
                transform: Transform::translated((i as f64 - 1.0) * 30.0, 0.0),
                color: Color::rgb(255, 20, 147),
                children: vec![],
                label: Some(gate.to_string()),
            };
            children.push(node);
        }

        scene.root.children = children;
        scene.bounds = (-50.0, -30.0, 50.0, 30.0);
        scene
    }

    fn generic_theorem_scene(name: &str) -> Self {
        let mut scene = Self::new(name.to_string());
        scene.root.label = Some(name.to_string());
        scene
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sphere_scene() {
        let scene = SceneGraph::qlg_sphere_scene();
        assert_eq!(scene.name, "QLG Sphere");
    }

    #[test]
    fn balance_scene() {
        let scene = SceneGraph::sla_balance_scene();
        assert_eq!(scene.root.children.len(), 2);
    }

    #[test]
    fn witness_exhaustion_scene() {
        let scene = SceneGraph::witness_exhaustion_scene();
        assert_eq!(scene.root.children.len(), 3);
    }
}
