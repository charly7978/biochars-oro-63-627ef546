
/**
 * Sistema de detección de capacidades del dispositivo
 * Permite optimizar rendimiento según las capacidades disponibles
 */

export interface DeviceCapabilities {
  performanceScore: number;  // Puntuación de 0-100
  isLowEndDevice: boolean;   // Dispositivo de gama baja
  isMidRangeDevice: boolean; // Dispositivo de gama media
  isHighEndDevice: boolean;  // Dispositivo de gama alta
  maxFPS: number;            // FPS máximos recomendados
  recommendedResolution: {   // Resolución recomendada
    width: number;
    height: number;
  };
  shouldUseLowPowerMode: boolean;    // Modo de bajo consumo
  shouldUsePixelSubsampling: boolean; // Usar submuestreo de píxeles
  subsamplingFactor: number;         // Factor de submuestreo (1=todos, 4=25%, etc)
  gpuAccelerationAvailable: boolean; // Aceleración GPU disponible
}

/**
 * Detecta capacidades del dispositivo
 */
export class DeviceCapabilityDetector {
  private static instance: DeviceCapabilityDetector;
  private capabilities: DeviceCapabilities;
  private initialDetectionComplete: boolean = false;

  private constructor() {
    // Valores por defecto conservadores
    this.capabilities = {
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
  }

  /**
   * Obtiene la instancia única
   */
  public static getInstance(): DeviceCapabilityDetector {
    if (!DeviceCapabilityDetector.instance) {
      DeviceCapabilityDetector.instance = new DeviceCapabilityDetector();
    }
    return DeviceCapabilityDetector.instance;
  }

  /**
   * Detecta capacidades y rendimiento del dispositivo
   */
  public async detectCapabilities(): Promise<DeviceCapabilities> {
    if (this.initialDetectionComplete) {
      return this.capabilities;
    }

    console.log("Iniciando detección de capacidades del dispositivo...");
    
    // Detección básica basada en User Agent
    await this.detectBasicCapabilities();
    
    // Detección avanzada basada en benchmarks
    await this.runPerformanceBenchmarks();
    
    // Comprobar capacidades de GPU
    await this.checkGPUCapabilities();
    
    // Ajustes finales basados en todos los datos
    this.finalizeCapabilities();
    
    this.initialDetectionComplete = true;
    console.log("Capacidades del dispositivo detectadas:", this.capabilities);
    
    return this.capabilities;
  }

  /**
   * Detección básica basada en User Agent y hardware
   */
  private async detectBasicCapabilities(): Promise<void> {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Detección de plataforma
    const isAndroid = /android/.test(userAgent);
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isMobile = isAndroid || isIOS || /mobile/.test(userAgent);
    const isLowEndMobile = isMobile && (
      /android 5|android 6|android 7\.0|iphone os 9|iphone os 10/.test(userAgent) || 
      (/android/.test(userAgent) && /sm-j|sm-g5|moto g|redmi 4|redmi 5a|vivo|oppo a/.test(userAgent))
    );
    
    // Memoria disponible (si está disponible)
    const memoryInfo = (navigator as any).deviceMemory;
    const hasLowMemory = memoryInfo !== undefined && memoryInfo <= 2;
    
    // Núcleos de CPU (si está disponible)
    const cpuCores = navigator.hardwareConcurrency || 2;
    const hasLowCPU = cpuCores <= 4;
    
    // Configuración basada en la detección básica
    if (isLowEndMobile || hasLowMemory || hasLowCPU) {
      this.capabilities.isLowEndDevice = true;
      this.capabilities.isMidRangeDevice = false;
      this.capabilities.isHighEndDevice = false;
      this.capabilities.maxFPS = 10;
      this.capabilities.recommendedResolution = { width: 320, height: 240 };
      this.capabilities.shouldUseLowPowerMode = true;
      this.capabilities.shouldUsePixelSubsampling = true;
      this.capabilities.subsamplingFactor = 4;
      this.capabilities.performanceScore = 30;
    } else if (isMobile) {
      this.capabilities.isLowEndDevice = false;
      this.capabilities.isMidRangeDevice = true;
      this.capabilities.isHighEndDevice = false;
      this.capabilities.maxFPS = 20;
      this.capabilities.recommendedResolution = { width: 640, height: 480 };
      this.capabilities.shouldUsePixelSubsampling = true;
      this.capabilities.subsamplingFactor = 2;
      this.capabilities.performanceScore = 60;
    } else {
      // Dispositivo de escritorio
      this.capabilities.isLowEndDevice = false;
      this.capabilities.isMidRangeDevice = false;
      this.capabilities.isHighEndDevice = true;
      this.capabilities.maxFPS = 30;
      this.capabilities.recommendedResolution = { width: 1280, height: 720 };
      this.capabilities.shouldUsePixelSubsampling = false;
      this.capabilities.subsamplingFactor = 1;
      this.capabilities.performanceScore = 90;
    }
  }

  /**
   * Ejecuta benchmarks básicos para medir rendimiento real
   */
  private async runPerformanceBenchmarks(): Promise<void> {
    try {
      // Medir tiempo de renderizado
      const renderStart = performance.now();
      await new Promise(resolve => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 640;
        tempCanvas.height = 480;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          // Dibujar algunos elementos para forzar renderizado
          for (let i = 0; i < 100; i++) {
            ctx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
            ctx.fillRect(Math.random() * 640, Math.random() * 480, 50, 50);
          }
          // Forzar lectura de píxeles para asegurar que el renderizado se completa
          ctx.getImageData(0, 0, 640, 480);
        }
        resolve(true);
      });
      const renderTime = performance.now() - renderStart;
      
      // Ajuste de score basado en tiempo de renderizado
      // Un renderizado rápido debería estar por debajo de 50ms
      const renderScore = Math.max(0, 100 - (renderTime / 2));
      
      // Medir tiempo de procesamiento de arrays
      const processStart = performance.now();
      const arr = new Array(100000).fill(0).map((_, i) => i);
      arr.filter(x => x % 2 === 0).map(x => x * 2).reduce((a, b) => a + b, 0);
      const processTime = performance.now() - processStart;
      
      // Ajuste de score basado en tiempo de procesamiento
      // Un procesamiento rápido debería estar por debajo de 20ms
      const processScore = Math.max(0, 100 - (processTime * 2));
      
      // Ajustar score de rendimiento combinando las métricas
      const combinedScore = (renderScore * 0.6) + (processScore * 0.4);
      this.capabilities.performanceScore = Math.round(
        (this.capabilities.performanceScore + combinedScore) / 2
      );
      
      // Actualizar otras capacidades basadas en el score combinado
      if (this.capabilities.performanceScore < 40) {
        // Reducir aún más para dispositivos muy lentos
        this.capabilities.isLowEndDevice = true;
        this.capabilities.maxFPS = 5;
        this.capabilities.recommendedResolution = { width: 320, height: 240 };
        this.capabilities.subsamplingFactor = 6;
      } else if (this.capabilities.performanceScore < 60) {
        this.capabilities.maxFPS = Math.min(this.capabilities.maxFPS, 15);
      }
      
    } catch (error) {
      console.error("Error ejecutando benchmarks de rendimiento:", error);
      // Mantener configuración por defecto en caso de error
    }
  }

  /**
   * Verifica si hay capacidades de GPU disponibles
   */
  private async checkGPUCapabilities(): Promise<void> {
    try {
      // Comprobar WebGL
      const hasWebGL2 = !!document.createElement('canvas').getContext('webgl2');
      
      // Comprobar WebGPU si está disponible en el navegador
      const hasWebGPU = 'gpu' in navigator;
      
      this.capabilities.gpuAccelerationAvailable = hasWebGL2 || hasWebGPU;
      
      // Si hay aceleración GPU disponible, podemos aumentar un poco la resolución y FPS
      if (this.capabilities.gpuAccelerationAvailable && this.capabilities.isLowEndDevice) {
        // Incluso para dispositivos de gama baja, si tienen GPU podemos mejorar un poco
        this.capabilities.maxFPS += 3;
        this.capabilities.subsamplingFactor = Math.max(2, this.capabilities.subsamplingFactor - 1);
        this.capabilities.performanceScore += 10;
      }
      
    } catch (error) {
      console.error("Error verificando capacidades GPU:", error);
      this.capabilities.gpuAccelerationAvailable = false;
    }
  }

  /**
   * Finaliza la configuración basada en todos los datos recopilados
   */
  private finalizeCapabilities(): void {
    // Normalizar score de rendimiento entre 0-100
    this.capabilities.performanceScore = Math.max(0, Math.min(100, this.capabilities.performanceScore));
    
    // Asegurarse de que la resolución y FPS son coherentes con el score
    if (this.capabilities.performanceScore < 30) {
      this.capabilities.isLowEndDevice = true;
      this.capabilities.recommendedResolution = { width: 320, height: 240 };
      this.capabilities.maxFPS = 5;
    } else if (this.capabilities.performanceScore < 50) {
      this.capabilities.isLowEndDevice = true;
      this.capabilities.recommendedResolution = { width: 480, height: 320 };
      this.capabilities.maxFPS = 10;
    } else if (this.capabilities.performanceScore < 70) {
      this.capabilities.isMidRangeDevice = true;
      this.capabilities.recommendedResolution = { width: 640, height: 480 };
      this.capabilities.maxFPS = 15;
    } else {
      this.capabilities.isHighEndDevice = true;
      this.capabilities.recommendedResolution = { width: 1280, height: 720 };
      this.capabilities.maxFPS = 30;
    }
    
    // Ajuste final de submuestreo basado en performance
    if (this.capabilities.performanceScore < 40) {
      this.capabilities.shouldUsePixelSubsampling = true;
      this.capabilities.subsamplingFactor = 6;
    } else if (this.capabilities.performanceScore < 60) {
      this.capabilities.shouldUsePixelSubsampling = true;
      this.capabilities.subsamplingFactor = 4;
    } else if (this.capabilities.performanceScore < 80) {
      this.capabilities.shouldUsePixelSubsampling = true;
      this.capabilities.subsamplingFactor = 2;
    } else {
      this.capabilities.shouldUsePixelSubsampling = false;
      this.capabilities.subsamplingFactor = 1;
    }
  }

  /**
   * Obtiene las capacidades actuales
   */
  public getCapabilities(): DeviceCapabilities {
    return this.capabilities;
  }
}

export default DeviceCapabilityDetector;
