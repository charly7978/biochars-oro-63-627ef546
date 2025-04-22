
import { ProcessedSignal } from '../../types/signal';

/**
 * Procesador optimizado de señales PPG con monitoreo de rendimiento
 */
export class OptimizedPPGProcessor {
  private frameCounter: number = 0;
  private lastPerformanceUpdate: number = 0;
  private frameRateHistory: number[] = [];
  private redValues: number[] = [];
  private greenValues: number[] = [];
  private blueValues: number[] = [];
  private intensityValues: number[] = [];
  private fingerDetected: boolean = false;
  private signalQuality: number = 0;
  private lastProcessedValue: number = 0;
  private baselineValue: number | null = null;
  
  // Constantes optimizadas
  private readonly FRAME_HISTORY_SIZE = 30;
  private readonly QUALITY_THRESHOLD = 35;
  private readonly FINGER_DETECTION_THRESHOLD = 0.18;
  private readonly GREEN_CHANNEL_WEIGHT = 0.85;
  private readonly BASELINE_ADAPTATION_RATE = 0.01;
  
  /**
   * Procesa un frame de video para extraer señales PPG
   * @param imageData Datos de imagen del frame de video
   * @returns Información procesada de la señal
   */
  public processFrame(imageData: ImageData): ProcessedSignal {
    const startTime = performance.now();
    
    this.frameCounter++;
    const timestamp = Date.now();
    
    // Extracción optimizada de valores RGB
    let sumRed = 0, sumGreen = 0, sumBlue = 0;
    let pixelCount = 0;
    
    // Análisis por región de interés (ROI) central
    const width = imageData.width;
    const height = imageData.height;
    const roiStartX = Math.floor(width * 0.4);
    const roiEndX = Math.floor(width * 0.6);
    const roiStartY = Math.floor(height * 0.4);
    const roiEndY = Math.floor(height * 0.6);
    
    for (let y = roiStartY; y < roiEndY; y += 2) {  // Saltar píxeles para optimizar
      for (let x = roiStartX; x < roiEndX; x += 2) {
        const idx = (y * width + x) * 4;
        
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const b = imageData.data[idx + 2];
        
        sumRed += r;
        sumGreen += g;
        sumBlue += b;
        
        pixelCount++;
      }
    }
    
    // Calcular promedios
    const avgRed = sumRed / pixelCount;
    const avgGreen = sumGreen / pixelCount;
    const avgBlue = sumBlue / pixelCount;
    
    // Enfoque en canal verde para PPG (mayor sensibilidad)
    const weightedValue = avgGreen * this.GREEN_CHANNEL_WEIGHT + 
                         avgRed * (1 - this.GREEN_CHANNEL_WEIGHT);
    
    // Detección de dedo basada en intensidad y relación rojo/verde
    const intensity = (avgRed + avgGreen + avgBlue) / 3;
    const redGreenRatio = avgRed / (avgGreen + 0.01);
    
    // Mantener historial de valores
    this.redValues.push(avgRed);
    this.greenValues.push(avgGreen);
    this.blueValues.push(avgBlue);
    this.intensityValues.push(intensity);
    
    if (this.redValues.length > this.FRAME_HISTORY_SIZE) {
      this.redValues.shift();
      this.greenValues.shift();
      this.blueValues.shift();
      this.intensityValues.shift();
    }
    
    // Detección mejorada de dedo
    this.fingerDetected = this.detectFinger(intensity, redGreenRatio);
    
    // Adaptación de línea base
    if (this.baselineValue === null) {
      this.baselineValue = weightedValue;
    } else if (this.fingerDetected) {
      this.baselineValue = this.baselineValue * (1 - this.BASELINE_ADAPTATION_RATE) + 
                          weightedValue * this.BASELINE_ADAPTATION_RATE;
    }
    
    // Normalización de señal respecto a línea base
    const normalizedValue = this.baselineValue !== null ? 
                          weightedValue - this.baselineValue : 0;
    
    // Actualizar valor procesado
    this.lastProcessedValue = normalizedValue;
    
    // Calcular calidad de señal
    this.signalQuality = this.calculateSignalQuality();
    
    // Monitoreo de rendimiento
    this.updatePerformanceMetrics(startTime);
    
    return {
      timestamp,
      rawRedValue: avgRed,
      rawGreenValue: avgGreen, 
      rawBlueValue: avgBlue,
      rawValue: intensity,
      filteredValue: normalizedValue,
      fingerDetected: this.fingerDetected,
      quality: this.signalQuality
    };
  }
  
  /**
   * Algoritmo mejorado de detección de dedo
   */
  private detectFinger(intensity: number, redGreenRatio: number): boolean {
    // Criterios múltiples para detección robusta
    const intensityOk = intensity > this.FINGER_DETECTION_THRESHOLD;
    const ratioOk = redGreenRatio > 0.9 && redGreenRatio < 1.3;
    
    // Variación temporal (estabilidad)
    let variationOk = true;
    if (this.intensityValues.length > 10) {
      const recent = this.intensityValues.slice(-10);
      const max = Math.max(...recent);
      const min = Math.min(...recent);
      const variation = max - min;
      
      variationOk = variation < 0.3;
    }
    
    return intensityOk && ratioOk && variationOk;
  }
  
  /**
   * Cálculo ponderado de calidad de señal
   */
  private calculateSignalQuality(): number {
    if (!this.fingerDetected || this.greenValues.length < 10) {
      return 0;
    }
    
    // Extraer valores recientes
    const recentGreen = this.greenValues.slice(-10);
    
    // Calcular variabilidad (SNR aproximado)
    const mean = recentGreen.reduce((sum, val) => sum + val, 0) / recentGreen.length;
    const variance = recentGreen.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentGreen.length;
    const stdDev = Math.sqrt(variance);
    
    const signalToNoise = mean / (stdDev + 0.01);
    
    // Puntuación basada en múltiples factores
    let qualityScore = 0;
    
    // 1. Factor de estabilidad
    qualityScore += signalToNoise * 10;
    
    // 2. Factor de intensidad
    const avgIntensity = this.intensityValues.slice(-10).reduce((sum, val) => sum + val, 0) / 10;
    qualityScore += avgIntensity * 50;
    
    // 3. Factor de consistencia temporal
    const consistency = this.calculateConsistency();
    qualityScore += consistency * 30;
    
    // Limitar rango
    qualityScore = Math.max(0, Math.min(100, qualityScore));
    
    return qualityScore;
  }
  
  /**
   * Medición de consistencia temporal
   */
  private calculateConsistency(): number {
    if (this.greenValues.length < 15) return 0.5;
    
    const values = this.greenValues.slice(-15);
    let changes = 0;
    
    for (let i = 1; i < values.length; i++) {
      if ((values[i] > values[i-1] && values[i-1] <= (i >= 2 ? values[i-2] : values[i-1])) ||
          (values[i] < values[i-1] && values[i-1] >= (i >= 2 ? values[i-2] : values[i-1]))) {
        changes++;
      }
    }
    
    // Normalizar: demasiados o muy pocos cambios indican baja calidad
    const normalizedChanges = changes / (values.length - 1);
    const optimalChanges = 0.4; // Aproximadamente 40% de cambios es óptimo
    const consistencyScore = 1 - Math.abs(normalizedChanges - optimalChanges) * 2;
    
    return Math.max(0, Math.min(1, consistencyScore));
  }
  
  /**
   * Monitoreo de rendimiento del procesador
   */
  private updatePerformanceMetrics(startTime: number): void {
    const processingTime = performance.now() - startTime;
    
    const now = Date.now();
    if (now - this.lastPerformanceUpdate > 1000) {
      const fps = this.frameCounter;
      this.frameRateHistory.push(fps);
      if (this.frameRateHistory.length > 10) {
        this.frameRateHistory.shift();
      }
      
      this.frameCounter = 0;
      this.lastPerformanceUpdate = now;
      
      // Registro de métricas a consola solo cada 5 segundos
      if (this.frameRateHistory.length > 5 && now % 5000 < 1000) {
        const avgFps = this.frameRateHistory.reduce((sum, val) => sum + val, 0) / this.frameRateHistory.length;
        console.log(`PPG Processor: ${avgFps.toFixed(1)} FPS, Processing time: ${processingTime.toFixed(2)}ms`);
      }
    }
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.redValues = [];
    this.greenValues = [];
    this.blueValues = [];
    this.intensityValues = [];
    this.fingerDetected = false;
    this.signalQuality = 0;
    this.lastProcessedValue = 0;
    this.baselineValue = null;
    this.frameCounter = 0;
    this.lastPerformanceUpdate = 0;
    this.frameRateHistory = [];
  }
  
  /**
   * Obtiene el estado actual del procesador
   */
  public getState() {
    return {
      fingerDetected: this.fingerDetected,
      signalQuality: this.signalQuality,
      lastProcessedValue: this.lastProcessedValue,
      frameRate: this.frameRateHistory.length > 0 
        ? this.frameRateHistory[this.frameRateHistory.length - 1] 
        : 0
    };
  }
}
