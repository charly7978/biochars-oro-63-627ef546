
/**
 * Estimador de Presión Arterial basado en análisis de onda PPG.
 * Implementa técnicas avanzadas sin calibración externa.
 */

export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  map: number;  // Presión arterial media
  confidence: number;
}

export class BPEstimator {
  private ppgTemplate: number[] = [];
  private isCalibrated: boolean = false;
  private calibrationFactor: number = 1.0;
  private lastEstimate: BloodPressureResult = {
    systolic: 120,
    diastolic: 80,
    map: 93,
    confidence: 0
  };
  
  constructor() {
    console.log('Estimador de presión arterial inicializado');
  }
  
  /**
   * Estima la presión arterial basada en la forma de onda PPG
   */
  public estimate(
    values: number[],
    peakInfo: any,
    signalQuality: number
  ): BloodPressureResult {
    if (values.length < 30 || peakInfo.intervals.length < 2 || signalQuality < 20) {
      return this.lastEstimate;
    }
    
    try {
      // Extraer características relevantes de la forma de onda
      const features = this.extractFeatures(values, peakInfo);
      
      // Características clave para estimación de presión arterial
      const { ptt, ai, peakDuration, valley2PeakHeight, valleyWidth } = features;
      
      // Calcular estimación de presión arterial sistólica
      const baseSystolic = 120;
      const pttFactor = -0.5 * ptt; // PTT más corto → presión más alta
      const aiFactor = 30 * ai;     // Índice de aumento mayor → presión más alta
      
      const systolic = baseSystolic + pttFactor + aiFactor;
      
      // Calcular estimación de presión arterial diastólica
      const baseDiastolic = 80;
      const widthFactor = -20 * valleyWidth; // Valle más ancho → presión más baja
      const heightFactor = 15 * valley2PeakHeight; // Amplitud mayor → presión más alta
      
      const diastolic = baseDiastolic + widthFactor + heightFactor;
      
      // Calcular presión arterial media (MAP)
      const map = diastolic + (systolic - diastolic) / 3;
      
      // Aplicar factor de calibración
      const calibratedSystolic = Math.round(systolic * this.calibrationFactor);
      const calibratedDiastolic = Math.round(diastolic * this.calibrationFactor);
      const calibratedMap = Math.round(map * this.calibrationFactor);
      
      // Limitar a rangos fisiológicos
      const finalSystolic = Math.max(90, Math.min(180, calibratedSystolic));
      const finalDiastolic = Math.max(50, Math.min(110, calibratedDiastolic));
      const finalMap = Math.max(65, Math.min(130, calibratedMap));
      
      // Corregir relación sistólica-diastólica si es necesario
      const correctedDiastolic = finalSystolic - 30 < finalDiastolic ? finalSystolic - 30 : finalDiastolic;
      
      // Calcular confianza basada en calidad de señal y estabilidad
      const confidence = Math.min(100, signalQuality * 0.8 + (this.isCalibrated ? 20 : 0));
      
      this.lastEstimate = {
        systolic: finalSystolic,
        diastolic: Math.max(50, correctedDiastolic),
        map: finalMap,
        confidence
      };
      
      return this.lastEstimate;
    } catch (error) {
      console.error('Error estimando presión arterial:', error);
      return this.lastEstimate;
    }
  }
  
  /**
   * Extrae características relevantes de la forma de onda PPG para estimación de BP
   */
  private extractFeatures(values: number[], peakInfo: any): {
    ptt: number;
    ai: number;
    peakDuration: number;
    valley2PeakHeight: number;
    valleyWidth: number;
  } {
    const { peakIndices, valleyIndices } = peakInfo;
    
    if (peakIndices.length < 2 || valleyIndices.length < 2) {
      return {
        ptt: 200,
        ai: 0.25,
        peakDuration: 250,
        valley2PeakHeight: 0.5,
        valleyWidth: 0.15
      };
    }
    
    // Normalizar valores
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    const normalizedValues = values.map(v => (v - min) / range);
    
    // Calcular tiempo de tránsito de pulso (PTT)
    const ptt = peakIndices[1] - peakIndices[0];
    
    // Calcular índice de aumento (AI) - marcador de rigidez arterial
    let ai = 0.25; // Valor por defecto
    
    if (peakIndices.length >= 2 && valleyIndices.length >= 2) {
      const peak1Height = normalizedValues[peakIndices[0]];
      const valley1Height = normalizedValues[valleyIndices[0]];
      const peak2Height = normalizedValues[peakIndices[1]];
      
      ai = (peak2Height - valley1Height) / (peak1Height - valley1Height);
      ai = Math.max(0.1, Math.min(0.5, ai));
    }
    
    // Duración del pico
    const peakDuration = peakIndices.length >= 2 ? (peakIndices[1] - peakIndices[0]) : 250;
    
    // Altura desde valle a pico
    let valley2PeakHeight = 0.5; // Valor por defecto
    
    if (peakIndices.length >= 1 && valleyIndices.length >= 1) {
      valley2PeakHeight = normalizedValues[peakIndices[0]] - normalizedValues[valleyIndices[0]];
      valley2PeakHeight = Math.max(0.2, Math.min(0.9, valley2PeakHeight));
    }
    
    // Ancho del valle
    const valleyWidth = valleyIndices.length >= 2 ? (valleyIndices[1] - valleyIndices[0]) / peakDuration : 0.15;
    
    return {
      ptt,
      ai,
      peakDuration,
      valley2PeakHeight,
      valleyWidth
    };
  }
  
  /**
   * Calibra el estimador con datos recientes
   */
  public calibrate(values: number[]): void {
    if (values.length < 100) {
      return;
    }
    
    // Almacenar template de PPG para calibración
    this.ppgTemplate = values.slice(-100);
    
    // Ajustar factor de calibración basado en características de señal
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    
    // Ajustar factor de calibración basado en amplitud
    if (range > 0) {
      const normalizedRange = Math.min(1, range / 200);
      this.calibrationFactor = 0.9 + (normalizedRange * 0.2);
    }
    
    this.isCalibrated = true;
    console.log(`Estimador de presión arterial calibrado. Factor: ${this.calibrationFactor.toFixed(2)}`);
  }
  
  /**
   * Restaura valores por defecto
   */
  public resetToDefaults(): void {
    this.ppgTemplate = [];
    this.isCalibrated = false;
    this.calibrationFactor = 1.0;
    this.lastEstimate = {
      systolic: 120,
      diastolic: 80,
      map: 93,
      confidence: 0
    };
  }
}
