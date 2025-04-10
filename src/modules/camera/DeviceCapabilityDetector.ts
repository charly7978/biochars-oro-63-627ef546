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
  private batteryLevel: number = 1.0;
  private isCharging: boolean = true;
  private thermalState: string = 'nominal';
  private lastPerformanceCheck: number = 0;
  private performanceCheckInterval: number = 60000; // 1 minuto
  private devicePerformanceHistory: number[] = [];

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
    
    // Verificar estado de batería
    await this.checkBatteryStatus();
    
    // Verificar estado térmico si está disponible
    await this.checkThermalStatus();
    
    // Detección avanzada basada en benchmarks
    await this.runPerformanceBenchmarks();
    
    // Comprobar capacidades de GPU
    await this.checkGPUCapabilities();
    
    // Ajustes finales basados en todos los datos
    this.finalizeCapabilities();
    
    this.initialDetectionComplete = true;
    console.log("Capacidades del dispositivo detectadas:", this.capabilities);
    
    // Programar verificaciones periódicas
    this.schedulePeriodicChecks();
    
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
   * Comprueba el estado de la batería si está disponible
   */
  private async checkBatteryStatus(): Promise<void> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;
        
        // Configurar modo de bajo consumo si la batería está baja y no está cargando
        if (battery.level < 0.3 && !battery.charging) {
          this.capabilities.shouldUseLowPowerMode = true;
        }
        
        console.log("Estado de batería detectado:", {
          level: this.batteryLevel,
          charging: this.isCharging
        });
        
        // Establecer listeners para cambios futuros
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.updateBatteryBasedCapabilities();
        });
        
        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
          this.updateBatteryBasedCapabilities();
        });
      } else {
        console.log("API de batería no disponible en este dispositivo");
      }
    } catch (error) {
      console.error("Error al verificar estado de batería:", error);
    }
  }
  
  /**
   * Actualiza capacidades basadas en estado de batería
   */
  private updateBatteryBasedCapabilities(): void {
    // Si la batería está baja y no está cargando, activar modo de bajo consumo
    if (this.batteryLevel < 0.3 && !this.isCharging) {
      this.capabilities.shouldUseLowPowerMode = true;
      
      // Reducir FPS y resolución para ahorrar batería
      this.capabilities.maxFPS = Math.min(this.capabilities.maxFPS, 10);
      
      if (this.capabilities.recommendedResolution.width > 320) {
        this.capabilities.recommendedResolution = { width: 320, height: 240 };
      }
      
      // Incrementar submuestreo
      this.capabilities.shouldUsePixelSubsampling = true;
      this.capabilities.subsamplingFactor = Math.max(2, this.capabilities.subsamplingFactor);
      
      console.log("Activadas optimizaciones de bajo consumo por nivel de batería bajo:", {
        batteryLevel: this.batteryLevel,
        charging: this.isCharging
      });
    } 
    // Si está cargando o tiene suficiente batería, podemos usar configuración normal
    else if (this.batteryLevel > 0.5 || this.isCharging) {
      // Solo actualizar si estaba en modo de bajo consumo por batería
      if (this.capabilities.shouldUseLowPowerMode) {
        // Recalcular capacidades basadas en rendimiento
        this.finalizeCapabilities();
        
        console.log("Desactivadas optimizaciones de bajo consumo (batería ok):", {
          batteryLevel: this.batteryLevel,
          charging: this.isCharging
        });
      }
    }
  }
  
  /**
   * Comprueba el estado térmico del dispositivo si está disponible
   */
  private async checkThermalStatus(): Promise<void> {
    try {
      // API experimental, verificar disponibilidad
      if ('thermal' in navigator && (navigator as any).thermal) {
        const thermal = (navigator as any).thermal;
        
        // Obtener estado inicial
        this.thermalState = thermal.state;
        
        console.log("Estado térmico detectado:", this.thermalState);
        
        // Reducir rendimiento si el dispositivo está sobrecalentado
        if (this.thermalState === 'critical' || this.thermalState === 'serious') {
          this.capabilities.shouldUseLowPowerMode = true;
          this.capabilities.maxFPS = Math.min(this.capabilities.maxFPS, 5);
          this.capabilities.performanceScore = Math.max(20, this.capabilities.performanceScore - 30);
          
          console.log("Activadas optimizaciones de bajo consumo por estado térmico crítico");
        }
        
        // Escuchar cambios en el estado térmico
        thermal.addEventListener('change', () => {
          this.thermalState = thermal.state;
          
          console.log("Cambio en estado térmico detectado:", this.thermalState);
          
          if (this.thermalState === 'critical' || this.thermalState === 'serious') {
            this.capabilities.shouldUseLowPowerMode = true;
            this.capabilities.maxFPS = Math.min(this.capabilities.maxFPS, 5);
          } else if (this.thermalState === 'nominal') {
            // Recalcular capacidades si el dispositivo se ha enfriado
            this.finalizeCapabilities();
          }
        });
      }
    } catch (error) {
      console.log("API de estado térmico no disponible:", error);
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
    
    // Añadir ajustes adicionales basados en batería y temperatura
    if (this.batteryLevel < 0.3 && !this.isCharging) {
      this.capabilities.shouldUseLowPowerMode = true;
      this.capabilities.maxFPS = Math.min(this.capabilities.maxFPS, 10);
    }
    
    if (this.thermalState === 'critical' || this.thermalState === 'serious') {
      this.capabilities.shouldUseLowPowerMode = true;
      this.capabilities.maxFPS = Math.min(this.capabilities.maxFPS, 5);
    }
  }

  /**
   * Programa verificaciones periódicas de rendimiento y estado del dispositivo
   */
  private schedulePeriodicChecks(): void {
    // Verificar estado periódicamente
    setInterval(() => {
      const now = Date.now();
      
      // Verificar rendimiento cada cierto intervalo
      if (now - this.lastPerformanceCheck >= this.performanceCheckInterval) {
        this.lastPerformanceCheck = now;
        this.updateDevicePerformance();
      }
    }, 10000); // Cada 10 segundos
  }
  
  /**
   * Actualiza la evaluación de rendimiento del dispositivo
   */
  private async updateDevicePerformance(): Promise<void> {
    try {
      // Verificar batería
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;
        this.updateBatteryBasedCapabilities();
      }
      
      // Ejecutar mini-benchmark para verificar rendimiento actual
      const start = performance.now();
      
      // Operación sencilla para evaluar rendimiento
      const arr = new Array(10000).fill(0).map((_, i) => i);
      arr.filter(x => x % 2 === 0).map(x => x * 2).reduce((a, b) => a + b, 0);
      
      const duration = performance.now() - start;
      
      // Guardar en historial
      this.devicePerformanceHistory.push(duration);
      if (this.devicePerformanceHistory.length > 5) {
        this.devicePerformanceHistory.shift();
      }
      
      // Si el rendimiento ha bajado significativamente
      if (this.devicePerformanceHistory.length >= 3) {
        const avgRecent = this.devicePerformanceHistory.slice(-2).reduce((sum, val) => sum + val, 0) / 2;
        const avgPrevious = this.devicePerformanceHistory.slice(0, -2).reduce((sum, val) => sum + val, 0) /
                           (this.devicePerformanceHistory.length - 2);
        
        // Si el rendimiento ha bajado más de un 30%
        if (avgRecent > avgPrevious * 1.3) {
          console.log("Detectada degradación de rendimiento, ajustando capacidades", {
            previousAvg: avgPrevious,
            recentAvg: avgRecent
          });
          
          // Reducir puntuación de rendimiento
          this.capabilities.performanceScore = Math.max(
            20, 
            this.capabilities.performanceScore * 0.8
          );
          
          // Actualizar otras capacidades
          this.finalizeCapabilities();
        }
      }
    } catch (error) {
      console.error("Error al actualizar rendimiento del dispositivo:", error);
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
