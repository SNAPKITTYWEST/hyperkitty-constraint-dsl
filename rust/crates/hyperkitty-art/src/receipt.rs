//! Artifact Receipt System - WORM-sealed cryptographic proofs
use crate::renderer::RenderFormat;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::io::Write;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactReceipt {
    pub theorem_name: String,
    pub format: RenderFormat,
    pub hash: String,
    pub size: usize,
}

impl Default for ArtifactReceipt {
    fn default() -> Self {
        Self {
            theorem_name: String::new(),
            format: RenderFormat::SVG,
            hash: String::new(),
            size: 0,
        }
    }
}

impl ArtifactReceipt {
    pub fn new(theorem_name: String, format: RenderFormat, artifact: &[u8]) -> Result<Self, String> {
        let mut hasher = Sha256::new();
        hasher.write_all(artifact).map_err(|e| e.to_string())?;
        let hash = hasher.finalize();

        Ok(Self {
            theorem_name,
            format,
            hash: format!("{:x}", hash),
            size: artifact.len(),
        })
    }

    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string(self).map_err(|e| e.to_string())
    }

    pub fn verify(&self, artifact: &[u8]) -> Result<bool, String> {
        let receipt = Self::new(self.theorem_name.clone(), self.format, artifact)?;
        Ok(receipt.hash == self.hash && receipt.size == self.size)
    }
}

pub fn receipt_from_artifact(
    theorem_name: String,
    format: RenderFormat,
    artifact: &[u8],
) -> Result<ArtifactReceipt, String> {
    ArtifactReceipt::new(theorem_name, format, artifact)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn receipt_creation() {
        let data = b"test artifact data";
        let receipt = ArtifactReceipt::new("Test".to_string(), RenderFormat::SVG, data).unwrap();
        assert_eq!(receipt.theorem_name, "Test");
        assert_eq!(receipt.format, RenderFormat::SVG);
        assert_eq!(receipt.size, data.len());
    }

    #[test]
    fn receipt_verification() {
        let data = b"test artifact data";
        let receipt = ArtifactReceipt::new("Test".to_string(), RenderFormat::PNG, data).unwrap();
        assert!(receipt.verify(data).unwrap());
    }

    #[test]
    fn receipt_fails_on_modified_data() {
        let data = b"test artifact data";
        let receipt = ArtifactReceipt::new("Test".to_string(), RenderFormat::WebGL, data).unwrap();
        let modified = b"modified artifact data";
        assert!(!receipt.verify(modified).unwrap());
    }

    #[test]
    fn receipt_json_serialization() {
        let data = b"theorem visualization";
        let receipt = ArtifactReceipt::new("QLG Sphere".to_string(), RenderFormat::SVG, data).unwrap();
        let json = receipt.to_json().unwrap();
        assert!(json.contains("QLG Sphere"));
        assert!(json.contains("hash"));
    }
}
