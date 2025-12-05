use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct RendererInfo {
    backend: String,
    adapter_name: String,
    features: String,
}

#[wasm_bindgen]
impl RendererInfo {
    #[wasm_bindgen(getter)]
    pub fn backend(&self) -> String {
        self.backend.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn adapter_name(&self) -> String {
        self.adapter_name.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn features(&self) -> String {
        self.features.clone()
    }
}

fn selected_backends() -> wgpu::Backends {
    let mut backends = wgpu::Backends::empty();

    #[cfg(feature = "webgpu")]
    {
        backends |= wgpu::Backends::BROWSER_WEBGPU;
    }

    #[cfg(feature = "webgl2")]
    {
        backends |= wgpu::Backends::GL;
    }

    #[cfg(feature = "cpu")]
    {
        backends |= wgpu::Backends::GL;
    }

    if backends.is_empty() {
        wgpu::Backends::BROWSER_WEBGPU
    } else {
        backends
    }
}

#[wasm_bindgen]
pub async fn initialize_renderer() -> Result<RendererInfo, JsValue> {
    let backends = selected_backends();

    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
        backends,
        flags: wgpu::InstanceFlags::default(),
        dx12_shader_compiler: wgpu::Dx12Compiler::default(),
    });

    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
        })
        .await
        .ok_or_else(|| JsValue::from_str("No compatible WebGPU adapter found"))?;

    let info = adapter.get_info();
    let features = format!("{:?}", adapter.features());

    Ok(RendererInfo {
        backend: format!("{:?}", info.backend),
        adapter_name: info.name,
        features,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    async fn initializes_renderer() {
        let info = initialize_renderer().await.expect("renderer initializes");
        assert!(!info.backend().is_empty());
        assert!(!info.adapter_name().is_empty());
    }
}
