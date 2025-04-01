
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
  powerSavingMode: boolean;
  dynamicFrameRate: boolean;
  maxFrameRate: number;
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
  private batteryLevelThresholds = [0.2, 0.5, 0.8];
  private batteryLevel: number = 1.0;
  private isLowPowerMode: boolean = false;
  private powerSavingActivated: boolean = false;
  private processingTimeHistory: number[] = [];
  private lastBatteryCheck: number = 0;
  private batteryCheckInterval: number = 30000; // Check battery every 30 seconds
  
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
      useOffscreenCanvas: false,
      powerSavingMode: false,
      dynamicFrameRate: true,
      maxFrameRate: 15
    };
    
    this.frameInterval = 1000 / 15; // Por defecto 15 FPS
    
    // Iniciar monitoreo de batería si está disponible
    this.initBatteryMonitoring();
  }
  
  /**
   * Inicia el monitoreo de la batería si el API está disponible
   */
  private async initBatteryMonitoring(): Promise<void> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        
        // Actualizar nivel inicial
        this.batteryLevel = battery.level;
        this.isLowPowerMode = battery.charging === false && battery.level < 0.3;
        
        // Escuchar cambios en la batería
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.updatePowerSavingMode();
        });
        
        battery.addEventListener('chargingchange', () => {
          // Si se conecta a la carga, podemos desactivar el modo de ahorro
          if (battery.charging) {
            this.isLowPowerMode = false;
          } else if (battery.level < 0.3) {
            this.isLowPowerMode = true;
          }
          this.updatePowerSavingMode();
        });
        
        console.log("Monitoreo de batería iniciado:", {
          level: this.batteryLevel,
          charging: battery.charging
        });
      } else {
        console.log("API de batería no disponible en este dispositivo");
      }
    } catch (error) {
      console.error("Error al inicializar monitoreo de batería:", error);
    }
  }
  
  /**
   * Actualiza el modo de ahorro de energía según el nivel de batería
   */
  private updatePowerSavingMode(): void {
    const shouldActivatePowerSaving = 
      (this.isLowPowerMode || this.batteryLevel < 0.2) && 
      this.options.powerSavingMode;
    
    if (shouldActivatePowerSaving !== this.powerSavingActivated) {
      this.powerSavingActivated = shouldActivatePowerSaving;
      
      if (shouldActivatePowerSaving) {
        console.log("Activando modo de ahorro de energía:", {
          batteryLevel: this.batteryLevel,
          isLowPowerMode: this.isLowPowerMode
        });
        
        // Reducir tasa de frames
        this.frameInterval = 1000 / Math.max(5, this.options.maxFrameRate / 2);
        
        // Aumentar factor de submuestreo
        if (this.options.subsamplingFactor < 2) {
          this.options.subsamplingFactor = 2;
        } else {
          this.options.subsamplingFactor += 1;
        }
        
        // Reducir resolución si no es ya la mínima
        if (this.options.targetWidth > 320) {
          this.options.targetWidth = 320;
          this.options.targetHeight = 240;
          this.initializeResources(); // Reinicializar recursos con nueva resolución
        }
      } else {
        console.log("Desactivando modo de ahorro de energía");
        
        // Restaurar configuración basada en capacidades del dispositivo
        this.configureProcessorOptions();
        this.initializeResources();
      }
    }
  }
  
  /**
   * Verifica el nivel de batería periódicamente
   */
  private checkBatteryStatus(): void {
    const now = Date.now();
    
    // Solo verificar cada cierto intervalo para evitar consumo excesivo
    if (now - this.lastBatteryCheck >= this.batteryCheckInterval) {
      this.lastBatteryCheck = now;
      
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          this.batteryLevel = battery.level;
          this.isLowPowerMode = battery.charging === false && battery.level < 0.3;
          this.updatePowerSavingMode();
        }).catch((error: any) => {
          console.error("Error al obtener nivel de batería:", error);
        });
      }
    }
  }
  
  /**
   * Adapta la tasa de frames dinámicamente según rendimiento
   */
  private adaptFrameRate(processingTime: number): void {
    if (!this.options.dynamicFrameRate) return;
    
    // Mantener historial de tiempos de procesamiento
    this.processingTimeHistory.push(processingTime);
    if (this.processingTimeHistory.length > 10) {
      this.processingTimeHistory.shift();
    }
    
    // Si tenemos suficientes muestras, ajustar tasa de frames
    if (this.processingTimeHistory.length >= 5) {
      const avgProcessingTime = this.processingTimeHistory.reduce((sum, time) => sum + time, 0) / 
                               this.processingTimeHistory.length;
      
      // Si el procesamiento toma más del 70% del intervalo de frames, reducir FPS
      if (avgProcessingTime > this.frameInterval * 0.7) {
        // Reducir FPS gradualmente (no más del 20% a la vez)
        const currentFPS = 1000 / this.frameInterval;
        const targetFPS = Math.max(5, currentFPS * 0.8);
        this.frameInterval = 1000 / targetFPS;
        
        console.log("Reduciendo tasa de frames por rendimiento insuficiente:", {
          avgProcessingTime,
          newFPS: targetFPS
        });
      } 
      // Si el procesamiento es rápido y no estamos en modo de ahorro, podemos aumentar FPS
      else if (avgProcessingTime < this.frameInterval * 0.3 && !this.powerSavingActivated) {
        const currentFPS = 1000 / this.frameInterval;
        // Aumentar FPS gradualmente, sin exceder el máximo
        const targetFPS = Math.min(this.options.maxFrameRate, currentFPS * 1.2);
        this.frameInterval = 1000 / targetFPS;
      }
    }
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
    
    // Activar ahorro de energía para dispositivos de gama baja
    this.options.powerSavingMode = capabilities.isLowEndDevice || 
                                  capabilities.shouldUseLowPowerMode;
    
    // Tasa de frames y ajuste dinámico
    this.options.maxFrameRate = capabilities.maxFPS;
    this.frameInterval = 1000 / capabilities.maxFPS;
    this.frameRateThrottle = capabilities.maxFPS < 30;
    
    // Activar ajuste dinámico de FPS si es dispositivo de gama baja o media
    this.options.dynamicFrameRate = capabilities.isLowEndDevice || 
                                   capabilities.isMidRangeDevice;
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
    const processStart = now;
    
    // Verificar nivel de batería periódicamente
    this.checkBatteryStatus();
    
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
      
      // Calcular tiempo de procesamiento para ajuste dinámico
      const processingTime = performance.now() - processStart;
      this.adaptFrameRate(processingTime);
      
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
   * Activa o desactiva el modo de ahorro de energía
   */
  public setPowerSavingMode(enabled: boolean): void {
    if (this.options.powerSavingMode !== enabled) {
      this.options.powerSavingMode = enabled;
      console.log(`Modo de ahorro de energía ${enabled ? 'activado' : 'desactivado'}`);
      
      // Actualizar configuración si es necesario
      this.updatePowerSavingMode();
    }
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
  
  /**
   * Obtiene el estado de energía actual
   */
  public getPowerStatus(): {
    batteryLevel: number;
    isLowPowerMode: boolean;
    powerSavingActivated: boolean;
    currentFrameRate: number;
  } {
    return {
      batteryLevel: this.batteryLevel,
      isLowPowerMode: this.isLowPowerMode,
      powerSavingActivated: this.powerSavingActivated,
      currentFrameRate: 1000 / this.frameInterval
    };
  }
}

export default AdaptiveFrameProcessor;
