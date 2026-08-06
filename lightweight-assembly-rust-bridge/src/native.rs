//! Native x86-64 backend bindings

use crate::KernelResult;

/// Native x86-64 kernel operations
pub struct NativeBackend;

impl NativeBackend {
    pub fn new() -> KernelResult<Self> {
        Ok(NativeBackend)
    }
}

impl Default for NativeBackend {
    fn default() -> Self {
        Self::new().expect("Failed to create native backend")
    }
}
