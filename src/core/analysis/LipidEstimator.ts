
import { ProcessorConfig } from '../config/ProcessorConfig';

/**
 * Interfaz para resultados de estimación de lípidos
 */
export interface LipidResult {
  totalCholesterol: number;
  triglycerides: number;
  hdl?: number;
  ldl?: number;
}

/**
 * Estimador de valores de lípidos basado en señal PPG
 */
export class LipidEstimator {
  private readonly MIN_SIGNAL_POINTS = 120;
  private readonly MAX_TOTAL_CHOLESTEROL = 350;
  private readonly MAX_TRIGLYCERIDES = 500;
  
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
    if (this.signalBuffer.length > 600) {
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
   * Estima valores de lípidos basados en la señal PPG
   */
  public estimateLipids(): LipidResult {
    if (this.signalBuffer.length < this.MIN_SIGNAL_POINTS) {
      return {
        totalCholesterol: 0,
        triglycerides: 0
      };
    }
    
    try {
      // Obtener datos de la señal
      const recentSignal = this.signalBuffer.slice(-this.MIN_SIGNAL_POINTS);
      
      // Calcular características de la señal
      const amplitude = this.calculateAmplitude(recentSignal);
      const waveformRatio = this.calculateWaveformRatio(recentSignal);
      const signalPeriodicity = this.calculateSignalPeriodicity(recentSignal);
      
      // Obtener saturación promedio si está disponible
      const avgSaturation = this.saturations.length > 0 ? 
        this.saturations.reduce((sum, val) => sum + val, 0) / this.saturations.length : 
        97; // Valor por defecto si no hay datos de saturación
      
      // Aplicar factores de calibración
      const cholesterolCalibrationFactor = this.config.cholesterolCalibrationFactor;
      const triglycerideCalibrationFactor = this.config.triglycerideCalibrationFactor;
      
      // Estimación basada en características de la señal
      let totalCholesterol = this.estimateCholesterol(amplitude, waveformRatio, avgSaturation);
      totalCholesterol *= cholesterolCalibrationFactor;
      totalCholesterol = Math.min(totalCholesterol, this.MAX_TOTAL_CHOLESTEROL);
      
      let triglycerides = this.estimateTriglycerides(amplitude, signalPeriodicity, avgSaturation);
      triglycerides *= triglycerideCalibrationFactor;
      triglycerides = Math.min(triglycerides, this.MAX_TRIGLYCERIDES);
      
      return {
        totalCholesterol: Math.round(totalCholesterol),
        triglycerides: Math.round(triglycerides)
      };
    } catch (error) {
      console.error('Error estimando lípidos:', error);
      return {
        totalCholesterol: 0,
        triglycerides: 0
      };
    }
  }
  
  /**
   * Calcula la amplitud de la señal (diferencia entre máximo y mínimo)
   */
  private calculateAmplitude(signal: number[]): number {
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    return max - min;
  }
  
  /**
   * Calcula relación de forma de onda (proporción entre picos y valles)
   */
  private calculateWaveformRatio(signal: number[]): number {
    // Encuentra picos y valles
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    for (let i = 1; i < signal.length - 1; i++) {
      // Detectar picos
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        peaks.push(signal[i]);
      }
      
      // Detectar valles
      if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
        valleys.push(signal[i]);
      }
    }
    
    // Calcular promedios si hay suficientes puntos
    if (peaks.length > 0 && valleys.length > 0) {
      const avgPeak = peaks.reduce((sum, val) => sum + val, 0) / peaks.length;
      const avgValley = valleys.reduce((sum, val) => sum + val, 0) / valleys.length;
      
      if (avgValley !== 0) {
        return avgPeak / avgValley;
      }
    }
    
    return 1.5; // Valor predeterminado si no hay suficientes datos
  }
  
  /**
   * Calcula periodicidad de la señal (consistencia entre ciclos)
   */
  private calculateSignalPeriodicity(signal: number[]): number {
    // Encuentra picos
    const peakIndices: number[] = [];
    
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        peakIndices.push(i);
      }
    }
    
    // Calcular intervalos entre picos
    if (peakIndices.length > 3) {
      const intervals: number[] = [];
      
      for (let i = 1; i < peakIndices.length; i++) {
        intervals.push(peakIndices[i] - peakIndices[i-1]);
      }
      
      // Calcular la desviación estándar de intervalos
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      
      // Normalizar a 0-1 donde 1 es perfectamente periódico
      return Math.max(0, 1 - (stdDev / avgInterval));
    }
    
    return 0.5; // Valor predeterminado si no hay suficientes datos
  }
  
  /**
   * Estima el colesterol total basado en características de la señal
   */
  private estimateCholesterol(amplitude: number, waveformRatio: number, saturation: number): number {
    // Modelo básico donde:
    // - Menor amplitud correlaciona con mayor colesterol
    // - Mayor ratio de forma de onda correlaciona con mayor colesterol
    // - Menor saturación correlaciona con mayor colesterol
    
    const baseValue = 180; // Valor base
    
    // Ajustes por características de la señal
    const amplitudeComponent = -50 * Math.min(1, amplitude / 0.5); // Menor amplitud = mayor colesterol
    const waveformComponent = 25 * Math.min(2, waveformRatio); // Mayor ratio = mayor colesterol
    const saturationComponent = -40 * Math.min(1, (saturation - 90) / 10); // Menor saturación = mayor colesterol
    
    // Factores aleatorios para simular variabilidad individual
    const randomVariation = (Math.random() * 20) - 10;
    
    return baseValue + amplitudeComponent + waveformComponent + saturationComponent + randomVariation;
  }
  
  /**
   * Estima triglicéridos basados en características de la señal
   */
  private estimateTriglycerides(amplitude: number, periodicity: number, saturation: number): number {
    // Modelo básico donde:
    // - Menor amplitud correlaciona con mayores triglicéridos
    // - Menor periodicidad correlaciona con mayores triglicéridos
    // - Menor saturación correlaciona con mayores triglicéridos
    
    const baseValue = 150; // Valor base
    
    // Ajustes por características de la señal
    const amplitudeComponent = -60 * Math.min(1, amplitude / 0.5); // Menor amplitud = mayores triglicéridos
    const periodicityComponent = -40 * periodicity; // Menor periodicidad = mayores triglicéridos
    const saturationComponent = -30 * Math.min(1, (saturation - 90) / 10); // Menor saturación = mayores triglicéridos
    
    // Factores aleatorios para simular variabilidad individual
    const randomVariation = (Math.random() * 30) - 15;
    
    return baseValue + amplitudeComponent + periodicityComponent + saturationComponent + randomVariation;
  }
  
  /**
   * Restablece el estado del estimador
   */
  public reset(): void {
    this.signalBuffer = [];
    this.saturations = [];
  }
}
