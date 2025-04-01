
/**
 * Estimador de lípidos sanguíneos basado en señal PPG
 * Implementación experimental basada en investigaciones recientes
 */
export class LipidEstimator {
  private readonly config: {
    glucoseCalibrationFactor: number;
    lipidCalibrationFactor: number;
    hemoglobinCalibrationFactor: number;
    confidenceThreshold: number;
    cholesterolCalibrationFactor: number; // Factor específico para colesterol
    triglycerideCalibrationFactor: number; // Factor específico para triglicéridos
  };
  
  private lastTotalCholesterol: number = 0;
  private lastTriglycerides: number = 0;
  private confidenceLevel: number = 0;
  
  constructor() {
    this.config = {
      glucoseCalibrationFactor: 0.18,
      lipidCalibrationFactor: 0.12,
      hemoglobinCalibrationFactor: 0.15,
      confidenceThreshold: 0.65,
      cholesterolCalibrationFactor: 0.14, // Inicializado con valor por defecto
      triglycerideCalibrationFactor: 0.16 // Inicializado con valor por defecto
    };
  }
  
  /**
   * Estima niveles de lípidos basados en características PPG
   * @param signal Señal PPG
   * @param heartRate Frecuencia cardíaca en BPM
   * @param spo2 Saturación de oxígeno en sangre (%)
   * @returns Estimación de lípidos
   */
  public estimateLipids(signal: number[], heartRate: number, spo2: number): {
    totalCholesterol: number;
    triglycerides: number;
    confidence: number;
  } {
    if (!signal || signal.length < 100 || !heartRate || !spo2) {
      return {
        totalCholesterol: this.lastTotalCholesterol,
        triglycerides: this.lastTriglycerides,
        confidence: 0
      };
    }
    
    // Extraer características de la señal
    const { 
      amplitude, 
      riseTime, 
      fallTime, 
      width50, 
      areaUnderCurve 
    } = this.extractFeatures(signal);
    
    // Calcular nivel de confianza basado en la calidad de la señal
    this.confidenceLevel = this.calculateConfidence(signal, heartRate);
    
    if (this.confidenceLevel < this.config.confidenceThreshold) {
      return {
        totalCholesterol: this.lastTotalCholesterol,
        triglycerides: this.lastTriglycerides,
        confidence: this.confidenceLevel
      };
    }
    
    // Estimación del colesterol total
    // Basado en correlaciones con características de la onda PPG
    const baselineCholesterol = 180; // mg/dL
    const cholesterolRiseTimeFactor = 10 * (riseTime - 0.15);
    const cholesterolWidthFactor = 15 * (width50 - 0.3);
    const cholesterolSpo2Factor = -5 * (spo2 - 97) / 3;
    
    const totalCholesterol = Math.round(
      (baselineCholesterol + cholesterolRiseTimeFactor + cholesterolWidthFactor + cholesterolSpo2Factor) *
      this.config.cholesterolCalibrationFactor
    );
    
    // Estimación de triglicéridos
    // Basado en correlaciones con área bajo la curva y tiempo de caída
    const baselineTriglycerides = 120; // mg/dL
    const triglycerideFallTimeFactor = 20 * (fallTime - 0.4);
    const triglycerideAreaFactor = 15 * (areaUnderCurve - 0.5);
    const triglycerideHRFactor = 0.5 * (heartRate - 70);
    
    const triglycerides = Math.round(
      (baselineTriglycerides + triglycerideFallTimeFactor + triglycerideAreaFactor + triglycerideHRFactor) *
      this.config.triglycerideCalibrationFactor
    );
    
    // Guardar últimos valores calculados
    this.lastTotalCholesterol = totalCholesterol;
    this.lastTriglycerides = triglycerides;
    
    return {
      totalCholesterol,
      triglycerides,
      confidence: this.confidenceLevel
    };
  }
  
  /**
   * Extrae características relevantes de la forma de onda PPG
   */
  private extractFeatures(signal: number[]): {
    amplitude: number;
    riseTime: number;
    fallTime: number;
    width50: number;
    areaUnderCurve: number;
  } {
    // Simplificación para esta implementación
    // En una implementación completa, se haría un análisis detallado de la forma de onda
    
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const amplitude = max - min;
    
    // Normalizar señal para análisis
    const normalizedSignal = signal.map(v => (v - min) / amplitude);
    
    // Encontrar índices relevantes
    const peakIndex = normalizedSignal.indexOf(1); // Valor máximo normalizado
    const halfAmpRiseIndex = normalizedSignal.findIndex(v => v >= 0.5);
    
    // Buscar índice de caída del 50%
    let halfAmpFallIndex = -1;
    for (let i = peakIndex; i < normalizedSignal.length; i++) {
      if (normalizedSignal[i] <= 0.5) {
        halfAmpFallIndex = i;
        break;
      }
    }
    
    if (halfAmpFallIndex === -1) halfAmpFallIndex = normalizedSignal.length - 1;
    
    // Calcular características temporales como fracción de la longitud total
    const signalLength = normalizedSignal.length;
    const riseTime = halfAmpRiseIndex / signalLength;
    const fallTime = (halfAmpFallIndex - peakIndex) / signalLength;
    const width50 = (halfAmpFallIndex - halfAmpRiseIndex) / signalLength;
    
    // Calcular área bajo la curva (normalizada)
    const areaUnderCurve = normalizedSignal.reduce((sum, val) => sum + val, 0) / signalLength;
    
    return {
      amplitude,
      riseTime,
      fallTime,
      width50,
      areaUnderCurve
    };
  }
  
  /**
   * Calcula nivel de confianza basado en calidad de señal
   */
  private calculateConfidence(signal: number[], heartRate: number): number {
    if (!signal || signal.length < 100 || !heartRate) return 0;
    
    // Calcular variabilidad de la señal
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const squaredDiffs = signal.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / signal.length;
    const stdDev = Math.sqrt(variance);
    
    // Coeficiente de variación
    const cv = stdDev / mean;
    
    // Alta variabilidad = baja confianza
    let confidence = Math.max(0, 1 - cv * 2);
    
    // Ajustar por frecuencia cardíaca (frecuencias extremas reducen confianza)
    if (heartRate < 50 || heartRate > 100) {
      const hrFactor = 1 - Math.min(Math.abs(heartRate - 75) / 50, 0.5);
      confidence *= hrFactor;
    }
    
    return Math.min(1, confidence);
  }
  
  /**
   * Restablece el estimador
   */
  public reset(): void {
    this.lastTotalCholesterol = 0;
    this.lastTriglycerides = 0;
    this.confidenceLevel = 0;
  }
  
  /**
   * Establece factores de calibración personalizados
   */
  public setCalibrationFactors(factors: {
    cholesterolCalibrationFactor?: number;
    triglycerideCalibrationFactor?: number;
  }): void {
    if (factors.cholesterolCalibrationFactor !== undefined) {
      this.config.cholesterolCalibrationFactor = factors.cholesterolCalibrationFactor;
    }
    
    if (factors.triglycerideCalibrationFactor !== undefined) {
      this.config.triglycerideCalibrationFactor = factors.triglycerideCalibrationFactor;
    }
  }
}
