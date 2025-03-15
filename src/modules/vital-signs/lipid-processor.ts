
/**
 * Procesador minimalista para estimación de perfil lipídico
 * Versión simplificada pero basada en señal real
 */

import {
  applySMAFilter,
  calculateSignalQuality,
  calculatePerfusionIndex,
  findPeaksAndValleys
} from './utils';

export class LipidProcessor {
  private readonly MIN_SIGNAL_QUALITY = 20;
  private readonly BUFFER_SIZE = 3;
  
  private cholesterolBuffer: number[] = [];
  private triglyceridesBuffer: number[] = [];
  private lastValidReading: { totalCholesterol: number; triglycerides: number } = {
    totalCholesterol: 0,
    triglycerides: 0
  };
  private confidenceScore: number = 0;
  private measurementStartTime: number = Date.now();
  
  /**
   * Calcula perfil lipídico básico basado en características de señal PPG
   */
  public calculateLipids(ppgValues: number[]): { 
    totalCholesterol: number; 
    triglycerides: number;
    confidence: number;
  } {
    // Verificar tiempo mínimo de medición (al menos 15 segundos)
    const elapsedTime = Date.now() - this.measurementStartTime;
    if (elapsedTime < 15000) {
      console.log("LipidProcessor: Tiempo insuficiente para lípidos", {
        tiempoTranscurrido: (elapsedTime/1000).toFixed(1) + "s",
        mínimoRequerido: "15s"
      });
      return {
        ...this.lastValidReading,
        confidence: 0
      }; // No mostrar valores hasta tiempo mínimo
    }
    
    // Validación de datos
    if (!ppgValues || ppgValues.length < 30) {
      console.log("LipidProcessor: Datos insuficientes");
      return {
        ...this.lastValidReading,
        confidence: Math.max(0, this.confidenceScore - 0.1)
      };
    }
    
    // Filtrado básico
    const filteredValues = applySMAFilter(ppgValues, 3);
    
    // Evaluación simple de calidad
    const signalQuality = calculateSignalQuality(filteredValues);
    const perfusionIndex = calculatePerfusionIndex(filteredValues);
    
    if (signalQuality < this.MIN_SIGNAL_QUALITY) {
      console.log("LipidProcessor: Calidad insuficiente", signalQuality);
      return {
        ...this.lastValidReading,
        confidence: Math.max(0, this.confidenceScore - 0.1)
      };
    }
    
    // Análisis básico de forma de onda
    const { peaks, valleys } = findPeaksAndValleys(filteredValues, 0.2);
    
    if (peaks.length < 2) {
      console.log("LipidProcessor: Pocos picos detectados");
      return {
        ...this.lastValidReading,
        confidence: Math.max(0, this.confidenceScore - 0.05)
      };
    }
    
    // Características básicas para estimación
    // 1. Cálculo de pendientes (relacionado con viscosidad sanguínea)
    let slopes: number[] = [];
    for (let i = 1; i < filteredValues.length; i++) {
      slopes.push(filteredValues[i] - filteredValues[i-1]);
    }
    
    // Separar pendientes positivas y negativas
    const posSlopes = slopes.filter(s => s > 0);
    const negSlopes = slopes.filter(s => s < 0);
    
    const avgPosSlope = posSlopes.length > 0 ? 
      posSlopes.reduce((a, b) => a + b, 0) / posSlopes.length : 0;
    
    const avgNegSlope = negSlopes.length > 0 ? 
      Math.abs(negSlopes.reduce((a, b) => a + b, 0) / negSlopes.length) : 0;
    
    // 2. Análisis de amplitud y frecuencia
    const peakValues = peaks.map(p => filteredValues[p]);
    const valleyValues = valleys.map(v => filteredValues[v]);
    
    const avgPeakValue = peakValues.length > 0 ? 
      peakValues.reduce((a, b) => a + b, 0) / peakValues.length : 0;
    
    const avgValleyValue = valleyValues.length > 0 ? 
      valleyValues.reduce((a, b) => a + b, 0) / valleyValues.length : 0;
    
    const avgAmplitude = avgPeakValue - avgValleyValue;
    
    // Modelo minimalista basado en correlaciones fisiológicas
    // Valores base normales
    const baseCholesterol = 170; // mg/dL
    const baseTriglycerides = 110; // mg/dL
    
    // Factores de correlación simplificados
    // Colesterol: correlacionado con propiedades de cambio de fase
    const cholesterolSlopeFactor = (avgPosSlope / avgNegSlope - 1) * 20;
    const cholesterolAmplitudeFactor = (1 - avgAmplitude) * 30;
    
    // Triglicéridos: correlacionados principalmente con viscosidad
    const triglycerideSlopeFactor = (avgNegSlope - avgPosSlope) * 25;
    const triglycerideAmplitudeFactor = (1 - avgAmplitude) * 40;
    
    // Estimaciones simplificadas
    let cholesterolEstimate = baseCholesterol + cholesterolSlopeFactor + cholesterolAmplitudeFactor;
    let triglyceridesEstimate = baseTriglycerides + triglycerideSlopeFactor + triglycerideAmplitudeFactor;
    
    // Limitar a rangos fisiológicos
    cholesterolEstimate = Math.max(130, Math.min(260, cholesterolEstimate));
    triglyceridesEstimate = Math.max(70, Math.min(220, triglyceridesEstimate));
    
    // Almacenar en buffer mínimo para estabilidad
    this.cholesterolBuffer.push(cholesterolEstimate);
    this.triglyceridesBuffer.push(triglyceridesEstimate);
    
    if (this.cholesterolBuffer.length > this.BUFFER_SIZE) {
      this.cholesterolBuffer.shift();
      this.triglyceridesBuffer.shift();
    }
    
    // Promedios simples
    const finalCholesterol = this.cholesterolBuffer.reduce((a, b) => a + b, 0) / this.cholesterolBuffer.length;
    const finalTriglycerides = this.triglyceridesBuffer.reduce((a, b) => a + b, 0) / this.triglyceridesBuffer.length;
    
    // Actualizar confianza basada en tiempo y calidad
    this.confidenceScore = Math.min(0.9, 
      0.3 + // Base
      Math.min(0.3, elapsedTime / 35000) + // Tiempo
      Math.min(0.3, signalQuality / 100) // Calidad
    );
    
    // Actualizar última lectura válida
    this.lastValidReading = {
      totalCholesterol: Math.round(finalCholesterol),
      triglycerides: Math.round(finalTriglycerides)
    };
    
    console.log("LipidProcessor: Lípidos estimados", {
      colesterol: this.lastValidReading.totalCholesterol,
      triglicéridos: this.lastValidReading.triglycerides,
      confianza: this.confidenceScore.toFixed(2)
    });
    
    return {
      ...this.lastValidReading,
      confidence: this.confidenceScore
    };
  }
  
  /**
   * Obtiene la última lectura válida
   */
  public getLastReading(): { 
    totalCholesterol: number; 
    triglycerides: number; 
    confidence: number;
  } {
    return {
      ...this.lastValidReading,
      confidence: this.confidenceScore
    };
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.cholesterolBuffer = [];
    this.triglyceridesBuffer = [];
    this.lastValidReading = { totalCholesterol: 0, triglycerides: 0 };
    this.confidenceScore = 0;
    this.measurementStartTime = Date.now();
    console.log("LipidProcessor: Procesador reiniciado");
  }
}
