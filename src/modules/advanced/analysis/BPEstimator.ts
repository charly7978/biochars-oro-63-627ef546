
/**
 * Estimador de presión arterial basado en PPG
 * 
 * Este módulo implementa algoritmos para estimar la presión arterial
 * a partir del análisis de la forma de onda PPG y otras métricas
 */

/**
 * Resultado de la estimación de presión arterial
 */
export interface BloodPressureEstimation {
  systolic: number;  // Presión sistólica (mmHg)
  diastolic: number; // Presión diastólica (mmHg)
  map: number;       // Presión arterial media (mmHg)
  confidence: number; // Confianza en la estimación (0-1)
}

/**
 * Información de picos detectados
 */
interface PeakInfo {
  peaks: number[];
  valleys: number[];
  intervals: number[];
}

/**
 * Estimador de presión arterial a partir de señal PPG
 */
export class BPEstimator {
  // Parámetros de calibración
  private systolicBase: number = 120;
  private diastolicBase: number = 80;
  private calibrationFactor: number = 1.0;
  
  // Calibración personalizada
  private isCalibrated: boolean = false;
  private personalizedFactor: number = 1.0;
  
  /**
   * Estima la presión arterial a partir de la señal PPG
   */
  public estimate(
    ppgValues: number[], 
    peakInfo: PeakInfo,
    signalQuality: number
  ): BloodPressureEstimation {
    // Aplicar análisis de factores compuestos para estimación de BP
    
    // 1. Análisis de tiempo de tránsito del pulso (PTT)
    // En un sistema real, esto requeriría sincronización con ECG
    // Aquí simulamos usando las características de la onda PPG
    
    // Verificar si hay suficientes picos para análisis
    if (!peakInfo.peaks || peakInfo.peaks.length < 2) {
      return this.getDefaultEstimation();
    }
    
    // Calcular estimación de la presión arterial
    const {
      systolicOffset,
      diastolicOffset,
      confidence
    } = this.analyzeWaveformForPressure(ppgValues, peakInfo, signalQuality);
    
    // Aplicar calibración y offsets
    const systolic = this.systolicBase + systolicOffset;
    const diastolic = this.diastolicBase + diastolicOffset;
    
    // Calcular presión arterial media (MAP)
    // Fórmula: MAP ≈ Diastólica + 1/3(Sistólica - Diastólica)
    const map = diastolic + (systolic - diastolic) / 3;
    
    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      map: Math.round(map),
      confidence
    };
  }
  
  /**
   * Analiza la forma de onda para estimar componentes de presión
   */
  private analyzeWaveformForPressure(
    values: number[], 
    peakInfo: PeakInfo,
    signalQuality: number
  ): { systolicOffset: number, diastolicOffset: number, confidence: number } {
    // Calcular características de la onda relacionadas con la presión
    
    // 1. Variabilidad de amplitud de picos (relacionada con la presión de pulso)
    const amplitudes: number[] = [];
    for (let i = 0; i < peakInfo.peaks.length; i++) {
      if (i < peakInfo.valleys.length) {
        const peakIdx = peakInfo.peaks[i];
        const valleyIdx = peakInfo.valleys[i];
        if (peakIdx < values.length && valleyIdx < values.length) {
          amplitudes.push(values[peakIdx] - values[valleyIdx]);
        }
      }
    }
    
    if (amplitudes.length === 0) {
      return { systolicOffset: 0, diastolicOffset: 0, confidence: 0.5 };
    }
    
    // 2. Calcular el promedio de amplitudes
    const avgAmplitude = amplitudes.reduce((sum, amp) => sum + amp, 0) / amplitudes.length;
    
    // 3. Calcular tiempo de fase sistólica promedio (relacionado con la presión sistólica)
    const systolicTimes: number[] = [];
    for (let i = 0; i < peakInfo.peaks.length; i++) {
      if (i < peakInfo.valleys.length && peakInfo.peaks[i] > peakInfo.valleys[i]) {
        systolicTimes.push(peakInfo.peaks[i] - peakInfo.valleys[i]);
      }
    }
    
    const avgSystolicTime = systolicTimes.length > 0 
      ? systolicTimes.reduce((sum, time) => sum + time, 0) / systolicTimes.length
      : 5; // Valor por defecto
    
    // 4. Relación entre amplitud y tiempo sistólico (indicador de presión)
    const amplitudeTimeRatio = avgAmplitude / avgSystolicTime;
    
    // 5. Cálculo de offsets de presión basados en los análisis
    // Los factores multiplicativos están basados en correlaciones típicas
    // entre características de la onda PPG y valores de presión arterial
    
    // La calibración personalizada se aplica aquí
    const calibrationMultiplier = this.isCalibrated ? this.personalizedFactor : this.calibrationFactor;
    
    // Relaciones típicas de PPG-BP:
    // - Mayor amplitud suele correlacionar con mayor presión de pulso
    // - Menor tiempo sistólico suele correlacionar con mayor presión sistólica
    // - La forma de la onda diastólica afecta la presión diastólica
    
    const systolicOffset = (amplitudeTimeRatio * 20 - 10) * calibrationMultiplier;
    
    // La presión diastólica varía menos que la sistólica
    const diastolicOffset = (amplitudeTimeRatio * 8 - 5) * calibrationMultiplier;
    
    // La confianza se basa en la calidad de la señal y la consistencia de las mediciones
    const amplitudeVariability = this.calculateVariability(amplitudes);
    const confidence = Math.min(1, Math.max(0.3, 
      signalQuality * 0.7 + (1 - amplitudeVariability) * 0.3)
    );
    
    return {
      systolicOffset,
      diastolicOffset,
      confidence
    };
  }
  
  /**
   * Calcula la variabilidad de un conjunto de valores
   */
  private calculateVariability(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    // Coeficiente de variación normalizado a [0,1]
    return Math.min(1, Math.sqrt(variance) / mean);
  }
  
  /**
   * Calibra el estimador con valores de referencia
   */
  public calibrate(ppgValues: number[]): void {
    if (ppgValues.length < 60) {
      console.log('Datos insuficientes para calibración de BP');
      return;
    }
    
    // En un entorno real, aquí utilizaríamos mediciones de referencia
    // para calibrar los parámetros del modelo
    
    // Calibración simulada basada en características de la señal
    const min = Math.min(...ppgValues);
    const max = Math.max(...ppgValues);
    const range = max - min;
    
    if (range > 0) {
      // Calcular un factor de calibración basado en el rango dinámico
      this.personalizedFactor = 1.0 + (range - 50) / 200;
      this.personalizedFactor = Math.min(1.5, Math.max(0.7, this.personalizedFactor));
      
      this.isCalibrated = true;
      console.log(`BP Estimator calibrado: factor=${this.personalizedFactor.toFixed(2)}`);
    }
  }
  
  /**
   * Obtiene una estimación de presión arterial por defecto
   */
  private getDefaultEstimation(): BloodPressureEstimation {
    return {
      systolic: this.systolicBase,
      diastolic: this.diastolicBase,
      map: (this.systolicBase + 2 * this.diastolicBase) / 3,
      confidence: 0.5
    };
  }
  
  /**
   * Reinicia el estimador a valores por defecto
   */
  public resetToDefaults(): void {
    this.systolicBase = 120;
    this.diastolicBase = 80;
    this.calibrationFactor = 1.0;
    this.isCalibrated = false;
    this.personalizedFactor = 1.0;
    
    console.log('BP Estimator reiniciado a valores por defecto');
  }
}
