
/**
 * Estimador avanzado de presión arterial no invasiva basado en análisis PPG.
 * Utiliza características de la forma de onda y tiempo de tránsito del pulso.
 */

export interface BloodPressureEstimation {
  systolic: number;
  diastolic: number;
  map: number;  // Presión arterial media
  confidence: number;
}

export class BPEstimator {
  private calibratedSystolic: number = 120;
  private calibratedDiastolic: number = 80;
  private calibrationFactor: number = 1.0;
  private lastEstimation: BloodPressureEstimation = {
    systolic: 120,
    diastolic: 80,
    map: 93,
    confidence: 0
  };
  
  /**
   * Estima la presión arterial basada en la señal PPG y datos de picos
   */
  public estimate(
    ppgValues: number[], 
    peakInfo: { 
      peaks: number[], 
      intervals: number[] 
    }, 
    signalQuality: number
  ): BloodPressureEstimation {
    if (ppgValues.length < 30 || peakInfo.peaks.length < 2 || signalQuality < 0.3) {
      // Si los datos no son suficientes, devolver última estimación
      return this.lastEstimation;
    }
    
    try {
      // Estimar PTT (Pulse Transit Time) basado en picos consecutivos
      // y características de la forma de onda
      const avgInterval = peakInfo.intervals.reduce((sum, val) => sum + val, 0) / 
                          peakInfo.intervals.length;
      
      // Obtener amplitud de la señal PPG
      const min = Math.min(...ppgValues);
      const max = Math.max(...ppgValues);
      const amplitude = max - min;
      
      // En un sistema real, se usaría PTT entre ECG y PPG
      // Aquí simulamos la estimación basada en características PPG
      
      // Calcular pendiente de subida media (sistólica)
      let avgSlopeUp = 0;
      let countSlopes = 0;
      
      for (const peakIdx of peakInfo.peaks) {
        if (peakIdx > 5 && peakIdx < ppgValues.length) {
          // Calcular pendiente en ventana de 5 muestras antes del pico
          const startIdx = Math.max(0, peakIdx - 5);
          const slope = (ppgValues[peakIdx] - ppgValues[startIdx]) / (peakIdx - startIdx);
          avgSlopeUp += slope;
          countSlopes++;
        }
      }
      
      avgSlopeUp = countSlopes > 0 ? avgSlopeUp / countSlopes : 0;
      
      // Estimar presión basada en las características medidas
      // Ecuaciones simplificadas basadas en modelos publicados
      // (En implementación real se usarían ecuaciones de regresión calibradas)
      
      // Factor de corrección basado en calidad de señal
      const qualityFactor = 0.5 + (signalQuality * 0.5);
      
      // Estimar presión sistólica
      const rawSystolic = this.calibratedSystolic - 
                          (avgInterval - 800) * 0.1 * this.calibrationFactor + 
                          avgSlopeUp * 2 * this.calibrationFactor;
      
      // Estimar presión diastólica
      const rawDiastolic = this.calibratedDiastolic - 
                           (avgInterval - 800) * 0.05 * this.calibrationFactor;
      
      // Aplicar factores de corrección
      const systolic = Math.max(90, Math.min(180, rawSystolic)) * qualityFactor + 
                       this.lastEstimation.systolic * (1 - qualityFactor);
      
      const diastolic = Math.max(60, Math.min(110, rawDiastolic)) * qualityFactor + 
                        this.lastEstimation.diastolic * (1 - qualityFactor);
      
      // Calcular MAP (Mean Arterial Pressure)
      const map = diastolic + (systolic - diastolic) / 3;
      
      // Calcular confianza basada en calidad de señal y estabilidad
      const confidence = signalQuality * (1 - Math.abs(this.lastEstimation.systolic - systolic) / 20);
      
      this.lastEstimation = {
        systolic,
        diastolic,
        map,
        confidence: Math.max(0, Math.min(1, confidence))
      };
      
      return this.lastEstimation;
    } catch (error) {
      console.error('Error al estimar presión arterial:', error);
      return this.lastEstimation;
    }
  }
  
  /**
   * Calibra el estimador con los valores de referencia
   */
  public calibrate(ppgValues: number[]): void {
    // Simular calibración con valores base
    this.calibratedSystolic = 120;
    this.calibratedDiastolic = 80;
    
    if (ppgValues.length > 50) {
      // Ajustar factor de calibración basado en características de la señal
      const min = Math.min(...ppgValues);
      const max = Math.max(...ppgValues);
      const amplitude = max - min;
      
      // Calcular factor de calibración basado en amplitud
      // En un sistema real, se calibraría con lecturas de referencia
      this.calibrationFactor = Math.max(0.8, Math.min(1.2, amplitude / 100));
    }
    
    console.log(`Estimador BP calibrado: factor=${this.calibrationFactor.toFixed(2)}`);
  }
  
  /**
   * Reinicia a valores predeterminados
   */
  public resetToDefaults(): void {
    this.calibratedSystolic = 120;
    this.calibratedDiastolic = 80;
    this.calibrationFactor = 1.0;
    this.lastEstimation = {
      systolic: 120,
      diastolic: 80,
      map: 93,
      confidence: 0
    };
  }
}
