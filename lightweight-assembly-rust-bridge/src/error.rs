//! Error types for kernel operations

use thiserror::Error;

#[derive(Error, Debug)]
pub enum KernelError {
    #[error("Backend not available: {0}")]
    BackendNotAvailable(String),

    #[error("Buffer size mismatch: expected {expected}, got {actual}")]
    BufferSizeMismatch { expected: usize, actual: usize },

    #[error("Invalid operation: {0}")]
    InvalidOperation(String),

    #[error("Execution failed: {0}")]
    ExecutionFailure(String),

    #[error("Type error: {0}")]
    TypeError(String),

    #[cfg(feature = "xml-transform")]
    #[error("XML transformation error: {0}")]
    XmlTransformError(String),
}

pub type KernelResult<T> = Result<T, KernelError>;
