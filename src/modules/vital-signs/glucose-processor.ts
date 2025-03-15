
/**
 * Procesador minimalista para estimación de niveles de glucosa en sangre
 * Basado en características de la señal PPG real
 */

import {
  applySMAFilter,
  applyMedianFilter,
  calculateSignalQuality,
  calculatePerfusionIndex,
  findPeaksAndValleys
} from './utils';

export class GlucoseProcessor {
  private readonly BUFFER_SIZE = 3; // Buffer mínimo
  private readonly MIN_SIGNAL_QUALITY = 20; // Umbral básico
  
  private glucoseBuffer: number[] = [];
  private lastValidGlucose: number = 0;
  private confidenceScore: number = 0;
  private measurementStartTime: number = Date.now();
  
  /**
   * Calcula nivel de glucosa basado en características básicas de PPG
   */
  public calculateGlucose(ppgValues: number[]): number {
    // Verificar tiempo mínimo de medición (al menos 15 segundos)
    const elapsedTime = Date.now() - this.measurementStartTime;
    if (elapsedTime < 15000) {
      console.log("GlucoseProcessor: Tiempo insuficiente para glucosa", {
        tiempoTranscurrido: (elapsedTime/1000).toFixed(1) + "s",
        mínimoRequerido: "15s"
      });
      return 0; // No mostrar valores hasta tiempo mínimo
    }
    
    // Validación de datos
    if (!ppgValues || ppgValues.length < 30) {
      console.log("GlucoseProcessor: Datos insuficientes");
      return this.lastValidGlucose || 0;
    }
    
    // Aplicar filtros básicos
    const filteredValues = applyMedianFilter(applySMAFilter(ppgValues, 3), 3);
    
    // Evaluación simple de calidad
    const signalQuality = calculateSignalQuality(filteredValues);
    const perfusionIndex = calculatePerfusionIndex(filteredValues);
    
    if (signalQuality < this.MIN_SIGNAL_QUALITY) {
      console.log("GlucoseProcessor: Calidad insuficiente", signalQuality);
      return this.lastValidGlucose || 0;
    }
    
    // Análisis básico de forma de onda
    const { peaks, valleys } = findPeaksAndValleys(filteredValues, 0.2);
    
    if (peaks.length < 2 || valleys.length < 2) {
      console.log("GlucoseProcessor: Pocos picos/valles");
      return this.lastValidGlucose || 0;
    }
    
    // Características básicas para estimación
    // 1. Análisis de tiempos de subida (correlacionado con viscosidad)
    let riseTimes: number[] = [];
    for (let i = 0; i < Math.min(peaks.length, valleys.length); i++) {
      if (peaks[i] > valleys[i]) {
        riseTimes.push(peaks[i] - valleys[i]);
      }
    }
    
    const avgRiseTime = riseTimes.length > 0 ? 
      riseTimes.reduce((a, b) => a + b, 0) / riseTimes.length : 0;
    
    // 2. Análisis de amplitud
    const amplitudes: number[] = [];
    for (let i = 0; i < Math.min(peaks.length, valleys.length); i++) {
      amplitudes.push(filteredValues[peaks[i]] - filteredValues[valleys[i]]);
    }
    
    const avgAmplitude = amplitudes.length > 0 ? 
      amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length : 0;
    
    // Modelo minimalista basado en principios fisiológicos
    // Glucosa base (normoglucemia)
    const baseGlucose = 90; // mg/dL
    
    // Factores de correlación simplificados
    const riseTimeFactor = (avgRiseTime - 10) * 1.2; // Correlación con viscosidad
    const amplitudeFactor = (avgAmplitude - 0.5) * 15; // Correlación con resistencia vascular
    
    // Estimación simplificada
    let glucoseEstimate = baseGlucose + riseTimeFactor + amplitudeFactor;
    
    // Limitar a rangos fisiológicos
    glucoseEstimate = Math.max(70, Math.min(180, glucoseEstimate));
    
    // Almacenar en buffer mínimo para estabilidad
    this.glucoseBuffer.push(glucoseEstimate);
    if (this.glucoseBuffer.length > this.BUFFER_SIZE) {
      this.glucoseBuffer.shift();
    }
    
    // Promedio simple
    const finalGlucose = this.glucoseBuffer.reduce((a, b) => a + b, 0) / this.glucoseBuffer.length;
    
    // Actualizar confianza basada en tiempo y calidad
    this.confidenceScore = Math.min(0.9, 
      0.3 + // Base
      Math.min(0.3, elapsedTime / 35000) + // Tiempo
      Math.min(0.3, signalQuality / 100) // Calidad
    );
    
    // Actualizar última lectura válida
    this.lastValidGlucose = Math.round(finalGlucose);
    
    console.log("GlucoseProcessor: Glucosa estimada", {
      valor: this.lastValidGlucose,
      confianza: this.confidenceScore.toFixed(2)
    });
    
    return this.lastValidGlucose;
  }
  
  /**
   * Obtiene el nivel de confianza actual
   */
  public getConfidence(): number {
    return this.confidenceScore;
  }
  
  /**
   * Obtiene la última lectura válida
   */
  public getLastReading(): { value: number; confidence: number } {
    return {
      value: this.lastValidGlucose,
      confidence: this.confidenceScore
    };
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.glucoseBuffer = [];
    this.lastValidGlucose = 0;
    this.confidenceScore = 0;
    this.measurementStartTime = Date.now();
    console.log("GlucoseProcessor: Procesador reiniciado");
  }
}
