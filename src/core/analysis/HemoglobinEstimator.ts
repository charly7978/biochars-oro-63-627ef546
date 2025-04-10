
import { ProcessorConfig } from '../config/ProcessorConfig';

/**
 * Estimador de hemoglobina basado en señal PPG
 */
export class HemoglobinEstimator {
  private readonly MIN_HEMOGLOBIN = 8;
  private readonly MAX_HEMOGLOBIN = 18;
  private readonly MIN_SIGNAL_POINTS = 120;
  
  private config: ProcessorConfig;
  private signalBuffer: number[] = [];
  private saturations: number[] = [];
  
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
   * Añade saturación de oxígeno estimada
   */
  public addSaturationValue(spo2: number): void {
    if (spo2 > 0) {
      this.saturations.push(spo2);
      if (this.saturations.length > 10) {
        this.saturations.shift();
      }
    }
  }
  
  /**
   * Estima el nivel de hemoglobina basado en la señal PPG
   */
  public estimate(): number {
    if (this.signalBuffer.length < this.MIN_SIGNAL_POINTS) {
      return 0;
    }
    
    try {
      // Obtener datos recientes para análisis
      const recentSignal = this.signalBuffer.slice(-this.MIN_SIGNAL_POINTS);
      
      // Obtener saturación promedio si está disponible
      const avgSaturation = this.saturations.length > 0 ? 
        this.saturations.reduce((sum, val) => sum + val, 0) / this.saturations.length : 
        97; // Valor por defecto si no hay datos de saturación
      
      // Extraer características de la señal
      const features = this.extractSignalFeatures(recentSignal);
      
      // Aplicar el factor de calibración
      const calibrationFactor = this.config.hemoglobinCalibrationFactor;
      
      // Estimar hemoglobina a partir de características
      let hemoglobinEstimate = this.calculateHemoglobinFromFeatures(features, avgSaturation);
      hemoglobinEstimate *= calibrationFactor;
      
      // Limitar a rango fisiológico
      hemoglobinEstimate = Math.max(this.MIN_HEMOGLOBIN, Math.min(this.MAX_HEMOGLOBIN, hemoglobinEstimate));
      
      return hemoglobinEstimate;
    } catch (error) {
      console.error('Error estimando hemoglobina:', error);
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
    const amplitude = max - min;
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    
    // Calcular área bajo la curva (AUC)
    let auc = 0;
    for (let i = 0; i < signal.length; i++) {
      auc += Math.max(0, signal[i] - min); // Área sobre el mínimo
    }
    auc /= signal.length; // Normalizar por longitud
    
    // Encontrar picos y calcular características
    const peaks: {index: number, value: number}[] = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        peaks.push({index: i, value: signal[i]});
      }
    }
    
    // Calcular altura promedio de picos
    const avgPeakHeight = peaks.length > 0 ? 
      peaks.reduce((sum, peak) => sum + peak.value, 0) / peaks.length : 
      0;
    
    // Calcular pendiente de ascenso
    let avgRisingSlope = 0;
    if (peaks.length > 0) {
      let totalSlope = 0;
      let slopeCount = 0;
      
      for (const peak of peaks) {
        // Buscar mínimo anterior al pico
        let minIndex = peak.index;
        for (let i = peak.index - 1; i >= Math.max(0, peak.index - 20); i--) {
          if (signal[i] < signal[minIndex]) {
            minIndex = i;
          }
        }
        
        if (minIndex < peak.index) {
          const slope = (signal[peak.index] - signal[minIndex]) / (peak.index - minIndex);
          totalSlope += slope;
          slopeCount++;
        }
      }
      
      avgRisingSlope = slopeCount > 0 ? totalSlope / slopeCount : 0;
    }
    
    return {
      amplitude,
      mean,
      auc,
      peakCount: peaks.length,
      avgPeakHeight,
      avgRisingSlope
    };
  }
  
  /**
   * Calcula la estimación de hemoglobina a partir de características de la señal
   */
  private calculateHemoglobinFromFeatures(features: any, saturation: number): number {
    // Modelo básico de estimación:
    // - Mayor amplitud correlaciona con mayor hemoglobina
    // - Mayor pendiente de ascenso correlaciona con mayor hemoglobina
    // - Mayor saturación correlaciona con mayor hemoglobina
    
    const baseValue = 12; // Valor base (g/dL)
    
    // Ajustes por características de la señal
    const amplitudeComponent = 2 * Math.min(1, features.amplitude); // Mayor amplitud = mayor hemoglobina
    const slopeComponent = 1 * Math.min(2, features.avgRisingSlope * 10); // Mayor pendiente = mayor hemoglobina
    const saturationComponent = 0.1 * Math.min(10, Math.max(0, saturation - 90)); // Mayor saturación = mayor hemoglobina
    const aucComponent = 0.5 * Math.min(3, features.auc * 5); // Mayor área bajo la curva = mayor hemoglobina
    
    // Factores aleatorios para simular variabilidad individual
    const randomVariation = (Math.random() * 0.8) - 0.4;
    
    return baseValue + amplitudeComponent + slopeComponent + saturationComponent + aucComponent + randomVariation;
  }
  
  /**
   * Restablece el estado del estimador
   */
  public reset(): void {
    this.signalBuffer = [];
    this.saturations = [];
  }
}
