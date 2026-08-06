//! Lightweight Assembly Rust Bridge
//!
//! Three-backend execution platform:
//! - Native x86-64 assembly (NASM)
//! - WebAssembly (WAT format)
//! - Pure Rust reference implementation
//!
//! All backends provide identical semantics verified by 1000+ equivalence tests.

#![allow(dead_code)]

pub mod error;
pub mod backend;
pub mod native;
pub mod wasm;
pub mod reference;

#[cfg(feature = "xml-transform")]
pub mod xml_transform;

pub use error::{KernelError, KernelResult};
pub use backend::{Backend, BackendSelector};
pub use reference::ReferenceBackend;

/// Main kernel API - dispatches to selected backend
pub struct KernelBridge {
    backend: Backend,
}

impl KernelBridge {
    /// Create new kernel bridge with default backend
    pub fn new() -> KernelResult<Self> {
        Ok(KernelBridge {
            backend: Backend::detect()?,
        })
    }

    /// Create kernel bridge with specific backend
    pub fn with_backend(selector: BackendSelector) -> KernelResult<Self> {
        Ok(KernelBridge {
            backend: Backend::select(selector)?,
        })
    }
}

impl Default for KernelBridge {
    fn default() -> Self {
        Self::new().expect("Failed to initialize kernel bridge")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_creation() {
        let _bridge = KernelBridge::new().expect("Failed to create bridge");
    }
}
