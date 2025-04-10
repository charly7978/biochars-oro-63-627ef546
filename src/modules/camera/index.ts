
/**
 * Módulo de cámara - Punto de entrada
 * Exporta todos los componentes y funciones relacionadas con la captura de cámara
 */
export * from './CameraFrameCapture';
export { default as CameraView } from './CameraView';

// Add an additional export for ImageCapture availability check
export function isImageCaptureSupported(): boolean {
  return typeof window !== 'undefined' && 'ImageCapture' in window;
}
