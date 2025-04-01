
/**
 * Procesador adaptativo de frames de cámara
 * Implementa técnicas de optimización según las capacidades del dispositivo
 */

import DeviceCapabilityDetector, { DeviceCapabilities } from './DeviceCapabilityDetector';

interface FrameProcessingOptions {
  targetWidth: number;
  targetHeight: number;
  subsamplingFactor: number;
  useGPUAcceleration: boolean;
  useOffscreenCanvas: boolean;
}

export class AdaptiveFrameProcessor {
  private deviceCapabilities: DeviceCapabilities;
  private canvas: HTMLCanvasElement;
  private offscreenCanvas: OffscreenCanvas | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
  private options: FrameProcessingOptions;
  private lastFrameTime: number = 0;
  private frameInterval: number = 0;
  private frameRateThrottle: boolean = false;
  
  /**
   * Constructor del procesador adaptativo
   */
  constructor() {
    // Configuración inicial conservadora
    this.deviceCapabilities = {
      performanceScore: 50,
      isLowEndDevice: false,
      isMidRangeDevice: true,
      isHighEndDevice: false,
      maxFPS: 15,
      recommendedResolution: {
        width: 640,
        height: 480
      },
      shouldUseLowPowerMode: false,
      shouldUsePixelSubsampling: false,
      subsamplingFactor: 1,
      gpuAccelerationAvailable: false
    };
    
    // Crear canvas para procesamiento
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    
    // Configuración inicial
    this.options = {
      targetWidth: 640,
      targetHeight: 480,
      subsamplingFactor: 1,
      useGPUAcceleration: false,
      useOffscreenCanvas: false
    };
    
    this.frameInterval = 1000 / 15; // Por defecto 15 FPS
  }
  
  /**
   * Inicializa el procesador con las capacidades del dispositivo
   */
  public async initialize(): Promise<void> {
    try {
      // Detectar capacidades
      const detector = DeviceCapabilityDetector.getInstance();
      this.deviceCapabilities = await detector.detectCapabilities();
      
      // Configurar según capacidades
      this.configureProcessorOptions();
      
      // Inicializar recursos
      this.initializeResources();
      
      console.log("AdaptiveFrameProcessor inicializado con opciones:", this.options);
    } catch (error) {
      console.error("Error inicializando AdaptiveFrameProcessor:", error);
      // En caso de error, mantener configuración por defecto
    }
  }
  
  /**
   * Configura las opciones basadas en las capacidades del dispositivo
   */
  private configureProcessorOptions(): void {
    const capabilities = this.deviceCapabilities;
    
    // Configurar dimensiones objetivo
    this.options.targetWidth = capabilities.recommendedResolution.width;
    this.options.targetHeight = capabilities.recommendedResolution.height;
    
    // Configurar submuestreo
    this.options.subsamplingFactor = capabilities.shouldUsePixelSubsampling ? 
      capabilities.subsamplingFactor : 1;
    
    // Configurar aceleración GPU si está disponible
    this.options.useGPUAcceleration = capabilities.gpuAccelerationAvailable;
    
    // Usar OffscreenCanvas para dispositivos que no sean de gama baja
    this.options.useOffscreenCanvas = !capabilities.isLowEndDevice && 
      typeof OffscreenCanvas !== 'undefined';
    
    // Configurar intervalo de frames
    this.frameInterval = 1000 / capabilities.maxFPS;
    this.frameRateThrottle = capabilities.maxFPS < 30;
  }
  
  /**
   * Inicializa recursos según la configuración
   */
  private initializeResources(): void {
    // Configurar canvas principal
    this.canvas.width = this.options.targetWidth;
    this.canvas.height = this.options.targetHeight;
    
    // Configurar OffscreenCanvas si está disponible y habilitado
    if (this.options.useOffscreenCanvas && typeof OffscreenCanvas !== 'undefined') {
      try {
        this.offscreenCanvas = new OffscreenCanvas(
          this.options.targetWidth,
          this.options.targetHeight
        );
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', 
          { willReadFrequently: true }
        ) as OffscreenCanvasRenderingContext2D;
        
        console.log("OffscreenCanvas inicializado para procesamiento optimizado");
      } catch (error) {
        console.error("Error inicializando OffscreenCanvas:", error);
        this.options.useOffscreenCanvas = false;
      }
    } else {
      this.options.useOffscreenCanvas = false;
    }
  }
  
  /**
   * Procesa un frame de la cámara con optimizaciones adaptativas
   */
  public processFrame(
    frame: ImageBitmap | HTMLVideoElement, 
    callback: (imageData: ImageData) => void
  ): boolean {
    const now = performance.now();
    
    // Control de tasa de frames
    if (this.frameRateThrottle && now - this.lastFrameTime < this.frameInterval) {
      return false; // Saltamos este frame para mantener la tasa objetivo
    }
    
    this.lastFrameTime = now;
    
    try {
      // Usar OffscreenCanvas si está disponible
      if (this.options.useOffscreenCanvas && this.offscreenCtx && this.offscreenCanvas) {
        // Dibujar en OffscreenCanvas con resolución reducida
        this.offscreenCtx.drawImage(
          frame, 
          0, 0, frame instanceof HTMLVideoElement ? frame.videoWidth : frame.width, 
          frame instanceof HTMLVideoElement ? frame.videoHeight : frame.height,
          0, 0, this.options.targetWidth, this.options.targetHeight
        );
        
        // Obtener ImageData de OffscreenCanvas
        const imageData = this.offscreenCtx.getImageData(
          0, 0, this.options.targetWidth, this.options.targetHeight
        );
        
        // Si se requiere submuestreo, aplicarlo
        if (this.options.subsamplingFactor > 1) {
          this.applySubsampling(imageData);
        }
        
        // Llamar al callback con los datos procesados
        callback(imageData);
      } 
      // Fallback a canvas normal
      else if (this.ctx) {
        // Dibujar en canvas normal con resolución reducida
        this.ctx.drawImage(
          frame, 
          0, 0, frame instanceof HTMLVideoElement ? frame.videoWidth : frame.width, 
          frame instanceof HTMLVideoElement ? frame.videoHeight : frame.height,
          0, 0, this.options.targetWidth, this.options.targetHeight
        );
        
        // Obtener ImageData
        const imageData = this.ctx.getImageData(
          0, 0, this.options.targetWidth, this.options.targetHeight
        );
        
        // Si se requiere submuestreo, aplicarlo
        if (this.options.subsamplingFactor > 1) {
          this.applySubsampling(imageData);
        }
        
        // Llamar al callback con los datos procesados
        callback(imageData);
      } else {
        console.error("No hay contexto disponible para procesar el frame");
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error procesando frame:", error);
      return false;
    }
  }
  
  /**
   * Aplica submuestreo a los datos de imagen
   * Procesa sólo 1 de cada N píxeles y copia el valor al resto
   */
  private applySubsampling(imageData: ImageData): void {
    const { data, width, height } = imageData;
    const factor = this.options.subsamplingFactor;
    
    // Si el factor es 1, no hay submuestreo
    if (factor <= 1) return;
    
    // Aplicar submuestreo horizontal y vertical
    for (let y = 0; y < height; y += factor) {
      for (let x = 0; x < width; x += factor) {
        // Índice del píxel de referencia
        const refIdx = (y * width + x) * 4;
        
        // Valores del píxel de referencia
        const r = data[refIdx];
        const g = data[refIdx + 1];
        const b = data[refIdx + 2];
        
        // Copiar a los píxeles vecinos en el bloque factor×factor
        for (let dy = 0; dy < factor && y + dy < height; dy++) {
          for (let dx = 0; dx < factor && x + dx < width; dx++) {
            // Saltarse el píxel de referencia
            if (dy === 0 && dx === 0) continue;
            
            // Índice del píxel vecino
            const idx = ((y + dy) * width + (x + dx)) * 4;
            
            // Copiar valores
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            // Mantener alpha original
          }
        }
      }
    }
  }
  
  /**
   * Obtiene un valor unidimensional representativo del frame (promedio del canal rojo)
   * Optimizado según capacidades del dispositivo
   */
  public extractPPGValue(imageData: ImageData): number {
    const { data, width, height } = imageData;
    const factor = this.options.subsamplingFactor;
    const pixelCount = Math.ceil(width * height / (factor * factor));
    
    let sum = 0;
    let sampledPixels = 0;
    
    // Si usamos submuestreo, solo considerar uno de cada N píxeles
    if (factor > 1) {
      for (let i = 0; i < data.length; i += 4 * factor) {
        sum += data[i]; // Canal rojo
        sampledPixels++;
      }
    } 
    // Sin submuestreo, procesar todos los píxeles
    else {
      for (let i = 0; i < data.length; i += 4) {
        sum += data[i]; // Canal rojo
        sampledPixels++;
      }
    }
    
    // Normalizar a [0,1]
    return sum / (sampledPixels * 255);
  }
  
  /**
   * Obtiene las opciones de procesamiento actuales
   */
  public getProcessingOptions(): FrameProcessingOptions {
    return { ...this.options };
  }
  
  /**
   * Obtiene las capacidades del dispositivo
   */
  public getDeviceCapabilities(): DeviceCapabilities {
    return { ...this.deviceCapabilities };
  }
}

export default AdaptiveFrameProcessor;
