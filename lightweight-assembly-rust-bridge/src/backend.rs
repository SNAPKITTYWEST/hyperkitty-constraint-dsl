//! Backend selection and dispatch

use crate::KernelError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendSelector {
    Native,
    Wasm,
    Reference,
    Auto,
}

#[derive(Debug)]
pub enum Backend {
    Native,
    Wasm,
    Reference,
}

impl Backend {
    pub fn detect() -> crate::KernelResult<Self> {
        #[cfg(target_arch = "x86_64")]
        {
            Ok(Backend::Native)
        }
        #[cfg(target_arch = "wasm32")]
        {
            Ok(Backend::Wasm)
        }
        #[cfg(not(any(target_arch = "x86_64", target_arch = "wasm32")))]
        {
            Ok(Backend::Reference)
        }
    }

    pub fn select(selector: BackendSelector) -> crate::KernelResult<Self> {
        match selector {
            BackendSelector::Native => {
                #[cfg(target_arch = "x86_64")]
                {
                    Ok(Backend::Native)
                }
                #[cfg(not(target_arch = "x86_64"))]
                {
                    Err(KernelError::BackendNotAvailable(
                        "Native x86-64 backend not available".to_string(),
                    ))
                }
            }
            BackendSelector::Wasm => {
                #[cfg(target_arch = "wasm32")]
                {
                    Ok(Backend::Wasm)
                }
                #[cfg(not(target_arch = "wasm32"))]
                {
                    Err(KernelError::BackendNotAvailable(
                        "WASM backend not available".to_string(),
                    ))
                }
            }
            BackendSelector::Reference => Ok(Backend::Reference),
            BackendSelector::Auto => Self::detect(),
        }
    }
}
