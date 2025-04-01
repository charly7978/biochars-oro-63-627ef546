
/**
 * Analizador de presión arterial basado en señal PPG
 * Implementa técnicas avanzadas de estimación
 */
export class BloodPressureAnalyzer {
  private readonly config: {
    glucoseCalibrationFactor: number;
    lipidCalibrationFactor: number;
    hemoglobinCalibrationFactor: number;
    confidenceThreshold: number;
    bpCalibrationFactor: number; // Añadido el factor de calibración para BP
  };
  
  private lastSystolic: number = 0;
  private lastDiastolic: number = 0;
  private confidenceLevel: number = 0;
  private ppgFeatures: {
    amplitude: number;
    peakInterval: number;
    dicroticNotchTime: number;
  } | null = null;
  
  constructor() {
    this.config = {
      glucoseCalibrationFactor: 0.18,
      lipidCalibrationFactor: 0.12,
      hemoglobinCalibrationFactor: 0.15,
      confidenceThreshold: 0.65,
      bpCalibrationFactor: 0.2 // Inicializado con valor por defecto
    };
  }
  
  /**
   * Analiza características de la onda PPG para extraer características
   * relacionadas con la presión arterial
   */
  public analyzeWaveform(signal: number[], peakIndices: number[]): void {
    if (!signal || !peakIndices || peakIndices.length < 2) {
      this.confidenceLevel = 0;
      return;
    }
    
    // Extraer características de la forma de onda PPG
    const amplitudes: number[] = [];
    const intervals: number[] = [];
    const notchTimes: number[] = [];
    
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const peakIndex = peakIndices[i];
      const nextPeakIndex = peakIndices[i + 1];
      
      // Medir amplitud (altura del pico)
      if (peakIndex < signal.length) {
        const valley = Math.min(...signal.slice(peakIndex, nextPeakIndex));
        const amplitude = signal[peakIndex] - valley;
        amplitudes.push(amplitude);
      }
      
      // Calcular intervalo entre picos
      intervals.push(nextPeakIndex - peakIndex);
      
      // Intentar detectar muesca dicrotic
      const segmentLength = nextPeakIndex - peakIndex;
      if (segmentLength > 10) {
        // Buscar muesca en el primer tercio de la caída
        const searchStart = peakIndex + Math.floor(segmentLength * 0.3);
        const searchEnd = peakIndex + Math.floor(segmentLength * 0.6);
        
        if (searchStart < signal.length && searchEnd < signal.length) {
          const segment = signal.slice(searchStart, searchEnd);
          // Buscar punto de inflexión (aproximación simple)
          let notchIndex = -1;
          for (let j = 1; j < segment.length - 1; j++) {
            if (segment[j] < segment[j-1] && segment[j] <= segment[j+1]) {
              notchIndex = j;
              break;
            }
          }
          
          if (notchIndex !== -1) {
            notchTimes.push(notchIndex / segmentLength);
          }
        }
      }
    }
    
    // Calcular promedios si hay suficientes datos
    if (amplitudes.length > 0 && intervals.length > 0) {
      this.ppgFeatures = {
        amplitude: this.calculateMean(amplitudes),
        peakInterval: this.calculateMean(intervals),
        dicroticNotchTime: notchTimes.length > 0 ? this.calculateMean(notchTimes) : 0.45
      };
      
      // Confianza basada en la variabilidad de las características
      const ampStdDev = this.calculateStdDev(amplitudes);
      const intervalStdDev = this.calculateStdDev(intervals);
      
      // Menor variabilidad = mayor confianza
      this.confidenceLevel = Math.max(
        0, 
        1 - (ampStdDev / Math.max(1, this.ppgFeatures.amplitude) * 0.5 +
             intervalStdDev / Math.max(1, this.ppgFeatures.peakInterval) * 0.5)
      );
    } else {
      this.ppgFeatures = null;
      this.confidenceLevel = 0;
    }
  }
  
  /**
   * Estima la presión arterial basada en las características PPG y HR
   */
  public calculateBloodPressure(heartRate: number, age: number = 30): {
    systolic: number;
    diastolic: number;
    confidence: number;
  } {
    if (!this.ppgFeatures || this.confidenceLevel < this.config.confidenceThreshold) {
      // Si no hay confianza suficiente, devolver la última estimación o valores predeterminados
      return {
        systolic: this.lastSystolic || 120,
        diastolic: this.lastDiastolic || 80,
        confidence: this.confidenceLevel
      };
    }
    
    // Modelo basado en características PPG y frecuencia cardíaca
    // Esta es una aproximación basada en investigación de la relación PPG-BP
    
    // Factor de edad (presión aumenta con la edad)
    const ageFactor = 1 + Math.max(0, age - 30) / 100;
    
    // La amplitud PPG tiene correlación inversa con la presión sistólica
    // El intervalo de pico tiene correlación con la presión diastólica
    // La posición de la muesca dicrotic se relaciona con la elasticidad arterial
    
    // Estimación sistólica
    const baselineSystolic = 120;
    const systolicAmplitudeFactor = 30 * (1 - (this.ppgFeatures.amplitude / 2));
    const systolicHRFactor = 0.3 * (heartRate - 70);
    
    // Estimación diastólica
    const baselineDiastolic = 80;
    const diastolicIntervalFactor = -15 * (this.ppgFeatures.peakInterval / 30 - 1);
    const diastolicNotchFactor = -10 * (this.ppgFeatures.dicroticNotchTime - 0.45);
    const diastolicHRFactor = 0.2 * (heartRate - 70);
    
    // Calcular presiones finales con factor de calibración
    const systolic = Math.round(
      (baselineSystolic + systolicAmplitudeFactor + systolicHRFactor) * 
      ageFactor * this.config.bpCalibrationFactor
    );
    
    const diastolic = Math.round(
      (baselineDiastolic + diastolicIntervalFactor + diastolicNotchFactor + diastolicHRFactor) * 
      ageFactor * this.config.bpCalibrationFactor
    );
    
    // Guardar valores para próxima llamada
    this.lastSystolic = systolic;
    this.lastDiastolic = diastolic;
    
    return {
      systolic,
      diastolic,
      confidence: this.confidenceLevel
    };
  }
  
  /**
   * Calcula la media de un array de valores
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Calcula la desviación estándar
   */
  private calculateStdDev(values: number[]): number {
    if (values.length <= 1) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Restablece el analizador
   */
  public reset(): void {
    this.lastSystolic = 0;
    this.lastDiastolic = 0;
    this.confidenceLevel = 0;
    this.ppgFeatures = null;
  }
  
  /**
   * Establece factores de calibración personalizados
   */
  public setCalibrationFactors(factors: {
    bpCalibrationFactor?: number;
  }): void {
    if (factors.bpCalibrationFactor !== undefined) {
      this.config.bpCalibrationFactor = factors.bpCalibrationFactor;
    }
  }
}
