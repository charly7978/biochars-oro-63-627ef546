
/**
 * Captura de frames de la cámara
 * Proporciona funcionalidades para la captura y procesamiento inicial de imágenes
 * Versión adaptativa para dispositivos con capacidades limitadas
 */

import DeviceCapabilityDetector from './DeviceCapabilityDetector';
import AdaptiveFrameProcessor from './AdaptiveFrameProcessor';

// Cache para los procesadores
let adaptiveProcessorInstance: AdaptiveFrameProcessor | null = null;
let deviceCapabilitiesInitialized = false;

/**
 * Configura la cámara con los parámetros óptimos según el dispositivo
 */
export const configureCameraForDevice = async (
  videoTrack: MediaStreamTrack,
  isAndroid: boolean = false, 
  isIOS: boolean = false
): Promise<void> => {
  try {
    // Inicializar detector de capacidades si no está ya inicializado
    if (!deviceCapabilitiesInitialized) {
      const detector = DeviceCapabilityDetector.getInstance();
      await detector.detectCapabilities();
      deviceCapabilitiesInitialized = true;
    }
    
    const capabilities = videoTrack.getCapabilities();
    console.log("Capacidades de la cámara:", capabilities);
    
    // Obtener capacidades del dispositivo para optimización
    const deviceDetector = DeviceCapabilityDetector.getInstance();
    const deviceCapabilities = deviceDetector.getCapabilities();
    
    // Ajustar configuración de cámara según capacidades del dispositivo
    const baseConstraints: MediaTrackConstraintSet[] = [];
    
    // Configuración según plataforma y capacidades
    if (isAndroid) {
      console.log("Configurando para Android");
      
      // Para dispositivos de gama baja, usar configuración más ligera
      if (deviceCapabilities.isLowEndDevice) {
        baseConstraints.push({
          width: { ideal: deviceCapabilities.recommendedResolution.width },
          height: { ideal: deviceCapabilities.recommendedResolution.height },
          frameRate: { ideal: deviceCapabilities.maxFPS }
        });
      } else {
        baseConstraints.push({
          frameRate: { ideal: Math.min(30, deviceCapabilities.maxFPS) },
          width: { ideal: deviceCapabilities.recommendedResolution.width },
          height: { ideal: deviceCapabilities.recommendedResolution.height }
        });
      }
      
      // Siempre intentar activar la linterna en Android
      if (capabilities.torch) {
        console.log("Activando linterna en Android");
        await videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        });
      }
    } else {
      // Configuración para otras plataformas
      baseConstraints.push({
        width: { ideal: deviceCapabilities.recommendedResolution.width },
        height: { ideal: deviceCapabilities.recommendedResolution.height },
        frameRate: { ideal: deviceCapabilities.maxFPS }
      });
      
      if (capabilities.exposureMode) {
        const exposureConstraint: MediaTrackConstraintSet = { 
          exposureMode: 'continuous' 
        };
        
        if (capabilities.exposureCompensation?.max) {
          exposureConstraint.exposureCompensation = capabilities.exposureCompensation.max;
        }
        
        baseConstraints.push(exposureConstraint);
      }
      
      if (capabilities.focusMode) {
        baseConstraints.push({ focusMode: 'continuous' });
      }
      
      if (capabilities.whiteBalanceMode) {
        baseConstraints.push({ whiteBalanceMode: 'continuous' });
      }
      
      // Ajustar brillo y contraste para dispositivos no de gama baja
      if (!deviceCapabilities.isLowEndDevice) {
        if (capabilities.brightness && capabilities.brightness.max) {
          baseConstraints.push({ brightness: capabilities.brightness.max * 0.2 });
        }
        
        if (capabilities.contrast && capabilities.contrast.max) {
          baseConstraints.push({ contrast: capabilities.contrast.max * 0.6 });
        }
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
    
    // Aplicar todas las configuraciones
    if (baseConstraints.length > 0) {
      try {
        console.log("Aplicando configuraciones adaptativas:", baseConstraints);
        for (const constraint of baseConstraints) {
          await videoTrack.applyConstraints({
            advanced: [constraint]
          });
          // Pequeña pausa para evitar problemas con algunos dispositivos
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        console.warn("No se pudieron aplicar algunas restricciones:", error);
      }
    }
    
    console.log("Cámara configurada con éxito para capacidades del dispositivo");
  } catch (error) {
    console.error("Error al configurar la cámara:", error);
    // Resolver de todos modos para no bloquear el flujo
  }
};

/**
 * Extrae datos de un frame de la cámara para procesamiento
 * Optimizado para dispositivos de gama baja
 */
export const extractFrameData = (
  frame: ImageBitmap, 
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D,
  targetWidth?: number,
  targetHeight?: number
): ImageData | null => {
  try {
    // Si no hay dimensiones específicas, usar las del detector de capacidades
    if (!targetWidth || !targetHeight) {
      const detector = DeviceCapabilityDetector.getInstance();
      const capabilities = detector.getCapabilities();
      targetWidth = capabilities.recommendedResolution.width;
      targetHeight = capabilities.recommendedResolution.height;
    }
    
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
 * Con optimizaciones para dispositivos de gama baja
 */
export const processFramesControlled = (
  imageCapture: any,
  isMonitoring: boolean,
  targetFrameRate: number,
  processCallback: (imageData: ImageData) => void
): () => void => {
  let requestId: number | null = null;
  
  // Inicializar procesador adaptativo si no existe
  const initializeProcessor = async () => {
    if (!adaptiveProcessorInstance) {
      adaptiveProcessorInstance = new AdaptiveFrameProcessor();
      await adaptiveProcessorInstance.initialize();
    }
    
    return adaptiveProcessorInstance;
  };
  
  // Función para procesar frames de manera adaptativa
  const processFramesAdaptively = async () => {
    if (!isMonitoring) return;
    
    try {
      // Asegurar que tenemos procesador
      const processor = await initializeProcessor();
      
      // Capturar frame
      const frame = await imageCapture.grabFrame();
      
      // Procesar frame con optimizaciones adaptativas
      processor.processFrame(frame, processCallback);
    } catch (error) {
      console.error("Error capturando o procesando frame:", error);
    }
    
    if (isMonitoring) {
      requestId = requestAnimationFrame(processFramesAdaptively);
    }
  };
  
  // Fallback para dispositivos que no soportan el procesador adaptativo
  const processFramesLegacy = async () => {
    if (!isMonitoring) return;
    
    const now = Date.now();
    const targetFrameInterval = 1000 / targetFrameRate;
    static let lastProcessTime = 0;
    
    // Control de tasa de frames
    if (now - lastProcessTime >= targetFrameInterval) {
      try {
        const frame = await imageCapture.grabFrame();
        
        // Canvas para procesamiento
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
        
        if (tempCtx) {
          // Usar dimensiones adaptativas si es posible
          const detector = DeviceCapabilityDetector.getInstance();
          const capabilities = detector.getCapabilities();
          const targetWidth = capabilities.recommendedResolution.width;
          const targetHeight = capabilities.recommendedResolution.height;
          
          const imageData = extractFrameData(frame, tempCanvas, tempCtx, targetWidth, targetHeight);
          if (imageData) {
            processCallback(imageData);
          }
        }
        
        lastProcessTime = now;
      } catch (error) {
        console.error("Error capturando frame:", error);
      }
    }
    
    if (isMonitoring) {
      requestId = requestAnimationFrame(processFramesLegacy);
    }
  };
  
  // Iniciar procesamiento según disponibilidad
  const startProcessing = async () => {
    try {
      // Intentar usar procesador adaptativo
      await initializeProcessor();
      requestId = requestAnimationFrame(processFramesAdaptively);
      console.log("Usando procesador adaptativo para frames");
    } catch (error) {
      // Fallback al procesamiento legacy
      console.warn("Error inicializando procesador adaptativo, usando legacy:", error);
      requestId = requestAnimationFrame(processFramesLegacy);
    }
  };
  
  // Iniciar procesamiento
  startProcessing();
  
  // Retornar función para cancelar el procesamiento
  return () => {
    if (requestId !== null) {
      cancelAnimationFrame(requestId);
      requestId = null;
    }
  };
};

export default {
  configureCameraForDevice,
  extractFrameData,
  processFramesControlled
};
