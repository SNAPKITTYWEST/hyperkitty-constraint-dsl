//! Multi-format Renderer - SVG, Canvas, WebGL, PNG, PDF, GIF, WebM
use crate::scene_graph::{SceneGraph, NodeGeometry};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RenderFormat {
    SVG,     // Vector graphics (scalable)
    Canvas,  // Canvas 2D JSON specification
    WebGL,   // WebGL 3D specification
    PNG,     // Raster image (requires external renderer)
    PDF,     // PDF document
    GIF,     // Animated GIF
    WebM,    // Video format
}

impl RenderFormat {
    pub fn mime_type(&self) -> &'static str {
        match self {
            Self::SVG => "image/svg+xml",
            Self::Canvas => "application/json",
            Self::WebGL => "application/json",
            Self::PNG => "image/png",
            Self::PDF => "application/pdf",
            Self::GIF => "image/gif",
            Self::WebM => "video/webm",
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            Self::SVG => "svg",
            Self::Canvas => "json",
            Self::WebGL => "json",
            Self::PNG => "png",
            Self::PDF => "pdf",
            Self::GIF => "gif",
            Self::WebM => "webm",
        }
    }
}

pub struct Renderer {
    format: RenderFormat,
}

impl Renderer {
    pub fn new(format: RenderFormat) -> Self {
        Self { format }
    }

    pub fn render(&self, scene: &SceneGraph) -> Result<Vec<u8>, String> {
        match self.format {
            RenderFormat::SVG => self.render_svg(scene),
            RenderFormat::Canvas => self.render_canvas(scene),
            RenderFormat::WebGL => self.render_webgl(scene),
            RenderFormat::PNG => self.render_png_spec(scene),
            RenderFormat::PDF => self.render_pdf_spec(scene),
            RenderFormat::GIF => self.render_gif_spec(scene),
            RenderFormat::WebM => self.render_webm_spec(scene),
        }
    }

    fn render_svg(&self, scene: &SceneGraph) -> Result<Vec<u8>, String> {
        let (x_min, y_min, x_max, y_max) = scene.bounds;
        let width = (x_max - x_min) as i32;
        let height = (y_max - y_min) as i32;

        let mut svg = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="{} {} {} {}">
  <title>{}</title>
  <rect width="{}" height="{}" fill="white"/>
"#,
            width, height, x_min as i32, y_min as i32, width, height, scene.name, width, height
        );

        self.render_node_svg(&scene.root, &mut svg, x_min, y_min)?;

        svg.push_str("</svg>\n");
        Ok(svg.into_bytes())
    }

    fn render_node_svg(&self, node: &crate::scene_graph::Node, svg: &mut String, x_offset: f64, y_offset: f64) -> Result<(), String> {
        let x = node.transform.x - x_offset;
        let y = node.transform.y - y_offset;

        match &node.geometry {
            NodeGeometry::Sphere { radius } => {
                svg.push_str(&format!(
                    r#"  <circle cx="{}" cy="{}" r="{}" fill="rgb({}, {}, {})" opacity="{}" stroke="black" stroke-width="1"/>
"#,
                    x as i32,
                    y as i32,
                    *radius as i32,
                    node.color.r,
                    node.color.g,
                    node.color.b,
                    node.color.a as f64 / 255.0
                ));
            }
            NodeGeometry::Cube { size } => {
                let half = size / 2.0;
                svg.push_str(&format!(
                    r#"  <rect x="{}" y="{}" width="{}" height="{}" fill="rgb({}, {}, {})" opacity="{}" stroke="black" stroke-width="1"/>
"#,
                    (x - half) as i32,
                    (y - half) as i32,
                    *size as i32,
                    *size as i32,
                    node.color.r,
                    node.color.g,
                    node.color.b,
                    node.color.a as f64 / 255.0
                ));
            }
            NodeGeometry::Point { radius } => {
                svg.push_str(&format!(
                    r#"  <circle cx="{}" cy="{}" r="{}" fill="rgb({}, {}, {})" opacity="{}"/>
"#,
                    x as i32,
                    y as i32,
                    *radius as i32,
                    node.color.r,
                    node.color.g,
                    node.color.b,
                    node.color.a as f64 / 255.0
                ));
            }
            NodeGeometry::Plane { width, height } => {
                svg.push_str(&format!(
                    r#"  <rect x="{}" y="{}" width="{}" height="{}" fill="rgb({}, {}, {})" opacity="{}" stroke="black" stroke-width="1"/>
"#,
                    (x - width / 2.0) as i32,
                    (y - height / 2.0) as i32,
                    *width as i32,
                    *height as i32,
                    node.color.r,
                    node.color.g,
                    node.color.b,
                    node.color.a as f64 / 255.0
                ));
            }
            NodeGeometry::Line { x1, y1, x2, y2 } => {
                svg.push_str(&format!(
                    r#"  <line x1="{}" y1="{}" x2="{}" y2="{}" stroke="rgb({}, {}, {})" stroke-width="2"/>
"#,
                    *x1 as i32, *y1 as i32, *x2 as i32, *y2 as i32, node.color.r, node.color.g, node.color.b
                ));
            }
            NodeGeometry::Text { content, font_size } => {
                svg.push_str(&format!(
                    r#"  <text x="{}" y="{}" font-size="{}" fill="rgb({}, {}, {})">{}</text>
"#,
                    x as i32, y as i32, *font_size as i32, node.color.r, node.color.g, node.color.b, content
                ));
            }
            NodeGeometry::Group => {
                // Groups don't render directly
            }
        }

        if let Some(label) = &node.label {
            svg.push_str(&format!(
                r#"  <text x="{}" y="{}" font-size="12" fill="black">{}</text>
"#,
                (x - 10.0) as i32,
                (y - 20.0) as i32,
                label
            ));
        }

        for child in &node.children {
            self.render_node_svg(child, svg, x_offset, y_offset)?;
        }

        Ok(())
    }

    fn render_canvas(&self, scene: &SceneGraph) -> Result<Vec<u8>, String> {
        let spec = serde_json::json!({
            "type": "canvas_2d",
            "scene": scene.name,
            "format": "JSON",
            "bounds": {
                "x_min": scene.bounds.0,
                "y_min": scene.bounds.1,
                "x_max": scene.bounds.2,
                "y_max": scene.bounds.3,
            },
            "elements": self.scene_to_canvas_elements(&scene.root)?,
        });

        Ok(spec.to_string().into_bytes())
    }

    fn scene_to_canvas_elements(&self, node: &crate::scene_graph::Node) -> Result<serde_json::Value, String> {
        let mut elements = vec![];

        match &node.geometry {
            NodeGeometry::Sphere { radius } => {
                elements.push(serde_json::json!({
                    "type": "circle",
                    "x": node.transform.x,
                    "y": node.transform.y,
                    "radius": radius,
                    "fill": format!("rgb({}, {}, {})", node.color.r, node.color.g, node.color.b),
                }));
            }
            NodeGeometry::Cube { size } => {
                elements.push(serde_json::json!({
                    "type": "rect",
                    "x": node.transform.x - size / 2.0,
                    "y": node.transform.y - size / 2.0,
                    "width": size,
                    "height": size,
                    "fill": format!("rgb({}, {}, {})", node.color.r, node.color.g, node.color.b),
                }));
            }
            _ => {}
        }

        for child in &node.children {
            let child_elements = self.scene_to_canvas_elements(child)?;
            if let serde_json::Value::Array(arr) = child_elements {
                elements.extend(arr);
            }
        }

        Ok(serde_json::Value::Array(elements))
    }

    fn render_webgl(&self, _scene: &SceneGraph) -> Result<Vec<u8>, String> {
        let spec = serde_json::json!({
            "type": "webgl",
            "format": "GLSL + JSON",
            "capabilities": ["3D", "lighting", "texture_mapping"],
            "note": "Render as GLTF with Khronos materials"
        });

        Ok(spec.to_string().into_bytes())
    }

    fn render_png_spec(&self, _scene: &SceneGraph) -> Result<Vec<u8>, String> {
        let spec = serde_json::json!({
            "type": "png_specification",
            "note": "Use headless Chromium or Puppeteer to render SVG → PNG",
            "pipeline": "SVG → rasterize(96 DPI) → PNG"
        });

        Ok(spec.to_string().into_bytes())
    }

    fn render_pdf_spec(&self, _scene: &SceneGraph) -> Result<Vec<u8>, String> {
        let spec = serde_json::json!({
            "type": "pdf_specification",
            "note": "Use wkhtmltopdf or similar to generate PDF from SVG",
            "pipeline": "SVG → PDF renderer → PDF"
        });

        Ok(spec.to_string().into_bytes())
    }

    fn render_gif_spec(&self, _scene: &SceneGraph) -> Result<Vec<u8>, String> {
        let spec = serde_json::json!({
            "type": "gif_specification",
            "note": "Render animation frames from scene graph transformations",
            "pipeline": "Scene → interpolate keyframes → render each → GIF encode"
        });

        Ok(spec.to_string().into_bytes())
    }

    fn render_webm_spec(&self, _scene: &SceneGraph) -> Result<Vec<u8>, String> {
        let spec = serde_json::json!({
            "type": "webm_specification",
            "note": "Generate video from animated proof steps",
            "codec": "VP8 or VP9",
            "pipeline": "Scene → render frames → encode WebM"
        });

        Ok(spec.to_string().into_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_mime_types() {
        assert_eq!(RenderFormat::SVG.mime_type(), "image/svg+xml");
        assert_eq!(RenderFormat::PNG.mime_type(), "image/png");
    }

    #[test]
    fn format_extensions() {
        assert_eq!(RenderFormat::SVG.extension(), "svg");
        assert_eq!(RenderFormat::WebM.extension(), "webm");
    }
}
