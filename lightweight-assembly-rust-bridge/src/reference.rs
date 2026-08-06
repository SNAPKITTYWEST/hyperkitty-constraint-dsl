//! Pure Rust reference implementation

use crate::KernelResult;

/// Reference backend - pure Rust implementation
pub struct ReferenceBackend;

impl ReferenceBackend {
    pub fn new() -> KernelResult<Self> {
        Ok(ReferenceBackend)
    }
}

impl Default for ReferenceBackend {
    fn default() -> Self {
        Self::new().expect("Failed to create reference backend")
    }
}
