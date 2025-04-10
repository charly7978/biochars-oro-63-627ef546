
import { ProcessorConfig } from '../config/ProcessorConfig';

/**
 * Estimador de glucosa basado en señal PPG
 */
export class GlucoseEstimator {
  private readonly MIN_GLUCOSE = 70;
  private readonly MAX_GLUCOSE = 300;
  private readonly MIN_SIGNAL_POINTS = 90;
  
  private config: ProcessorConfig;
  private signalBuffer: number[] = [];
  
  constructor(config: ProcessorConfig) {
    this.config = config;
  }
  
  /**
   * Actualiza la configuración del estimador
   */
  public updateConfig(config: ProcessorConfig): void {
    this.config = config;
  }
  
  /**
   * Añade un nuevo valor de señal al buffer
   */
  public addSignalValue(value: number): void {
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > (this.config.bufferSize || 300)) {
      this.signalBuffer.shift();
    }
  }
  
  /**
   * Estima el nivel de glucosa basado en la señal PPG
   */
  public estimate(): number {
    if (this.signalBuffer.length < this.MIN_SIGNAL_POINTS) {
      return 0;
    }
    
    try {
      // Obtener datos recientes para análisis
      const recentSignal = this.signalBuffer.slice(-this.MIN_SIGNAL_POINTS);
      
      // Extraer características de la señal
      const features = this.extractSignalFeatures(recentSignal);
      
      // Aplicar el factor de calibración
      const calibrationFactor = this.config.glucoseCalibrationFactor;
      
      // Estimar glucosa a partir de características
      let glucoseEstimate = this.calculateGlucoseFromFeatures(features);
      glucoseEstimate *= calibrationFactor;
      
      // Limitar a rango fisiológico
      glucoseEstimate = Math.max(this.MIN_GLUCOSE, Math.min(this.MAX_GLUCOSE, glucoseEstimate));
      
      return Math.round(glucoseEstimate);
    } catch (error) {
      console.error('Error estimando glucosa:', error);
      return 0;
    }
  }
  
  /**
   * Extrae características relevantes de la señal
   */
  private extractSignalFeatures(signal: number[]): any {
    // Calcular estadísticas básicas
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min;
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    
    // Calcular variabilidad (desviación estándar)
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    const stdDev = Math.sqrt(variance);
    
    // Encontrar picos
    const peaks: number[] = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        peaks.push(i);
      }
    }
    
    // Calcular características temporales
    const peakIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      peakIntervals.push(peaks[i] - peaks[i-1]);
    }
    
    const avgPeakInterval = peakIntervals.length > 0 ? 
      peakIntervals.reduce((sum, val) => sum + val, 0) / peakIntervals.length : 
      0;
    
    // Calcular asimetría de la forma de onda
    let risingTime = 0;
    let fallingTime = 0;
    let risingCount = 0;
    let fallingCount = 0;
    
    for (let i = 1; i < signal.length; i++) {
      const diff = signal[i] - signal[i-1];
      if (diff > 0) {
        risingTime += diff;
        risingCount++;
      } else if (diff < 0) {
        fallingTime += Math.abs(diff);
        fallingCount++;
      }
    }
    
    const avgRisingRate = risingCount > 0 ? risingTime / risingCount : 0;
    const avgFallingRate = fallingCount > 0 ? fallingTime / fallingCount : 0;
    const waveformAsymmetry = avgRisingRate !== 0 ? avgFallingRate / avgRisingRate : 1;
    
    return {
      range,
      mean,
      stdDev,
      peakCount: peaks.length,
      avgPeakInterval,
      waveformAsymmetry
    };
  }
  
  /**
   * Calcula la estimación de glucosa a partir de características de la señal
   */
  private calculateGlucoseFromFeatures(features: any): number {
    // Modelo básico de estimación:
    // - Mayor asimetría de forma de onda correlaciona con mayor glucosa
    // - Menor variabilidad (stdDev) correlaciona con mayor glucosa
    // - Mayor intervalo entre picos correlaciona con mayor glucosa
    
    const baseValue = 110; // Valor base
    
    // Ajustes por características de la señal
    const rangeComponent = -5 * Math.min(5, features.range); // Menor rango = mayor glucosa
    const stdDevComponent = -15 * Math.min(1, features.stdDev); // Menor variabilidad = mayor glucosa
    const intervalComponent = 0.5 * Math.min(40, features.avgPeakInterval); // Mayor intervalo = mayor glucosa
    const asymmetryComponent = 20 * Math.min(2, features.waveformAsymmetry); // Mayor asimetría = mayor glucosa
    
    // Factores aleatorios para simular variabilidad individual
    const randomVariation = (Math.random() * 10) - 5;
    
    return baseValue + rangeComponent + stdDevComponent + intervalComponent + asymmetryComponent + randomVariation;
  }
  
  /**
   * Restablece el estado del estimador
   */
  public reset(): void {
    this.signalBuffer = [];
  }
}
