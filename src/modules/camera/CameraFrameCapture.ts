
/**
 * Módulo de captura de frames de cámara
 * Proporciona funciones para configurar la cámara y procesar frames
 */

/**
 * Configura la cámara para el dispositivo específico
 */
export async function configureCameraForDevice(
  videoTrack: MediaStreamTrack,
  isAndroid: boolean,
  isIOS: boolean
): Promise<void> {
  try {
    const capabilities = videoTrack.getCapabilities();
    console.log("CameraFrameCapture: Capacidades de la cámara:", capabilities);
    
    const advancedConstraints: MediaTrackConstraintSet[] = [];
    
    if (isAndroid) {
      if (capabilities.torch) {
        console.log("CameraFrameCapture: Activando linterna en Android");
        await videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        });
      }
    } else {
      if (capabilities.exposureMode) {
        const exposureConstraint: MediaTrackConstraintSet = { 
          exposureMode: 'continuous' 
        };
        
        if (capabilities.exposureCompensation?.max) {
          exposureConstraint.exposureCompensation = capabilities.exposureCompensation.max;
        }
        
        advancedConstraints.push(exposureConstraint);
      }
      
      if (capabilities.focusMode) {
        advancedConstraints.push({ focusMode: 'continuous' });
      }
      
      if (capabilities.whiteBalanceMode) {
        advancedConstraints.push({ whiteBalanceMode: 'continuous' });
      }
      
      if (advancedConstraints.length > 0) {
        console.log("CameraFrameCapture: Aplicando configuraciones avanzadas:", advancedConstraints);
        await videoTrack.applyConstraints({
          advanced: advancedConstraints
        });
      }

      if (capabilities.torch) {
        console.log("CameraFrameCapture: Activando linterna para mejorar la señal PPG");
        await videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        });
      }
    }
  } catch (error) {
    console.error("CameraFrameCapture: Error configurando cámara:", error);
  }
}

/**
 * Procesa frames de cámara con control de tasa
 * Devuelve una función para detener el procesamiento
 */
export function processFramesControlled(
  imageCapture: ImageCapture,
  isEnabled: boolean,
  frameRate: number,
  onFrameProcessed: (imageData: ImageData) => void
): () => void {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!context) {
    console.error("CameraFrameCapture: No se pudo obtener contexto 2D");
    return () => {};
  }
  
  let running = true;
  const interval = Math.floor(1000 / frameRate);
  
  console.log(`CameraFrameCapture: Iniciando procesamiento controlado de frames a ${frameRate} FPS (intervalo: ${interval}ms)`);
  
  const processFrame = async () => {
    if (!running || !isEnabled) return;
    
    try {
      const frame = await imageCapture.grabFrame();
      canvas.width = frame.width;
      canvas.height = frame.height;
      context.drawImage(frame, 0, 0);
      
      const imageData = context.getImageData(0, 0, frame.width, frame.height);
      onFrameProcessed(imageData);
    } catch (error) {
      console.error("CameraFrameCapture: Error capturando frame:", error);
    }
    
    if (running) {
      setTimeout(processFrame, interval);
    }
  };
  
  processFrame();
  
  return () => {
    running = false;
    console.log("CameraFrameCapture: Procesamiento de frames detenido");
  };
}
