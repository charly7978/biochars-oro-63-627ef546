
/**
 * Captura de frames de la cámara
 * Proporciona funcionalidades para la captura y procesamiento inicial de imágenes
 */

/**
 * Configura la cámara con los parámetros óptimos según el dispositivo
 */
export const configureCameraForDevice = (
  videoTrack: MediaStreamTrack,
  isAndroid: boolean = false, 
  isIOS: boolean = false
): Promise<void> => {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const capabilities = videoTrack.getCapabilities();
      console.log("Capacidades de la cámara:", capabilities);
      
      const advancedConstraints: MediaTrackConstraintSet[] = [];
      
      // Configuración según plataforma
      if (isAndroid) {
        if (capabilities.torch) {
          console.log("Activando linterna en Android");
          await videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          });
        }
      } else {
        // Configuración para otras plataformas
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
        
        if (capabilities.brightness && capabilities.brightness.max) {
          const maxBrightness = capabilities.brightness.max;
          advancedConstraints.push({ brightness: maxBrightness * 0.2 });
        }
        
        if (capabilities.contrast && capabilities.contrast.max) {
          const maxContrast = capabilities.contrast.max;
          advancedConstraints.push({ contrast: maxContrast * 0.6 });
        }

        if (advancedConstraints.length > 0) {
          console.log("Aplicando configuraciones avanzadas:", advancedConstraints);
          await videoTrack.applyConstraints({
            advanced: advancedConstraints
          });
        }

        // Activar linterna para todas las plataformas si está disponible
        if (capabilities.torch) {
          console.log("Activando linterna para mejorar la señal PPG");
          await videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          });
        } else {
          console.log("La linterna no está disponible en este dispositivo");
        }
      }
      
      resolve();
    } catch (error) {
      console.error("Error al configurar la cámara:", error);
      // Resolver de todos modos para no bloquear el flujo
      resolve();
    }
  });
};

/**
 * Extrae datos de un frame de la cámara para procesamiento
 */
export const extractFrameData = (
  frame: ImageBitmap, 
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D,
  targetWidth: number = 320,
  targetHeight: number = 240
): ImageData | null => {
  try {
    // Ajustar tamaño del canvas si es necesario
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    
    // Dibujar el frame en el canvas con el tamaño objetivo
    ctx.drawImage(
      frame, 
      0, 0, frame.width, frame.height, 
      0, 0, targetWidth, targetHeight
    );
    
    // Obtener los datos de imagen para procesamiento
    return ctx.getImageData(0, 0, targetWidth, targetHeight);
  } catch (error) {
    console.error("Error al extraer datos del frame:", error);
    return null;
  }
};

/**
 * Procesa frames de la cámara a una tasa controlada
 */
export const processFramesControlled = (
  imageCapture: any, // Use 'any' here to avoid type issues while ensuring global definition works
  isMonitoring: boolean,
  targetFrameRate: number,
  processCallback: (imageData: ImageData) => void
): () => void => {
  let lastProcessTime = 0;
  const targetFrameInterval = 1000 / targetFrameRate;
  let frameCount = 0;
  let lastFpsUpdateTime = Date.now();
  let processingFps = 0;
  let requestId: number | null = null;
  
  // Canvas para procesamiento de frames
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
  
  if (!tempCtx) {
    console.error("No se pudo obtener el contexto 2D para procesamiento de frames");
    return () => {};
  }
  
  const processImage = async () => {
    if (!isMonitoring) return;
    
    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessTime;
    
    // Control de tasa de frames
    if (timeSinceLastProcess >= targetFrameInterval) {
      try {
        const frame = await imageCapture.grabFrame();
        
        const imageData = extractFrameData(frame, tempCanvas, tempCtx);
        if (imageData) {
          processCallback(imageData);
        }
        
        frameCount++;
        lastProcessTime = now;
        
        // Log de rendimiento cada segundo
        if (now - lastFpsUpdateTime > 1000) {
          processingFps = frameCount;
          frameCount = 0;
          lastFpsUpdateTime = now;
          console.log(`Rendimiento de procesamiento: ${processingFps} FPS`);
        }
      } catch (error) {
        console.error("Error capturando frame:", error);
      }
    }
    
    if (isMonitoring) {
      requestId = requestAnimationFrame(processImage);
    }
  };
  
  // Iniciar procesamiento
  requestId = requestAnimationFrame(processImage);
  
  // Retornar función para cancelar el procesamiento
  return () => {
    if (requestId !== null) {
      cancelAnimationFrame(requestId);
      requestId = null;
    }
  };
};
