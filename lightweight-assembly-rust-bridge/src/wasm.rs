//! WebAssembly backend bindings

use crate::KernelResult;

/// WebAssembly kernel operations
pub struct WasmBackend;

impl WasmBackend {
    pub fn new() -> KernelResult<Self> {
        Ok(WasmBackend)
    }
}

impl Default for WasmBackend {
    fn default() -> Self {
        Self::new().expect("Failed to create WASM backend")
    }
}
