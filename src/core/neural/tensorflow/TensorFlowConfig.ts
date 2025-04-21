
/**
 * Configuración para TensorFlow
 */

export interface TensorFlowConfig {
  backend: 'webgl' | 'cpu' | 'wasm';
  modelDir?: string;
  flags?: Record<string, boolean | number | string>;
}

/**
 * Detecta la configuración óptima para TensorFlow
 */
export function detectOptimalConfig(): TensorFlowConfig {
  // Detectar si hay WebGL disponible
  const hasWebGL = hasWebGLSupport();
  
  // Configuración base
  const config: TensorFlowConfig = {
    backend: hasWebGL ? 'webgl' : 'cpu',
    flags: {}
  };
  
  // Optimizaciones para WebGL si está disponible
  if (hasWebGL) {
    config.flags = {
      'WEBGL_PACK': true,
      'WEBGL_FORCE_F16_TEXTURES': true,
      'WEBGL_PACK_DEPTHWISECONV': true,
      'WEBGL_LAZILY_UNPACK': true,
      'WEBGL_CONV_IM2COL': true,
      'WEBGL_RENDER_FLOAT32_ENABLED': false
    };
  }
  
  return config;
}

/**
 * Comprueba si hay soporte WebGL
 */
function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}
