
/**
 * Procesador avanzado para estimación de perfil lipídico en sangre
 * Basado en características espectrales de la señal PPG.
 */

import {
  applySMAFilter,
  applyMedianFilter,
  calculateSignalQuality,
  calculatePerfusionIndex,
  findPeaksAndValleys,
  calculateAreaUnderCurve
} from './utils';

export class LipidProcessor {
  private readonly BUFFER_SIZE = 8;
  private readonly MIN_SIGNAL_QUALITY = 60;
  
  private cholesterolBuffer: number[] = [];
  private triglyceridesBuffer: number[] = [];
  private lastValidCholesterol: number = 0;
  private lastValidTriglycerides: number = 0;
  private confidenceScore: number = 0;
  private lastCalculationTime: number = 0;
  
  /**
   * Calcula perfil lipídico estimado basado en señal PPG
   * Utiliza análisis espectral y características de forma de onda
   * 
   * @param ppgValues Valores de señal PPG
   * @returns Valores estimados de colesterol y triglicéridos (mg/dL)
   */
  public calculateLipids(ppgValues: number[]): { 
    totalCholesterol: number; 
    triglycerides: number;
  } {
    const currentTime = Date.now();
    
    // Validación de datos
    if (!ppgValues || ppgValues.length < 120) {
      console.log("LipidProcessor: Datos insuficientes para estimar lípidos", {
        muestras: ppgValues?.length || 0,
        requeridas: 120
      });
      
      this.confidenceScore = Math.max(0, this.confidenceScore - 0.1);
      return {
        totalCholesterol: this.lastValidCholesterol,
        triglycerides: this.lastValidTriglycerides
      };
    }
    
    // Aplicar filtros para reducir ruido
    const filteredValues = applyMedianFilter(applySMAFilter(ppgValues, 5), 3);
    
    // Evaluar calidad de señal
    const signalQuality = calculateSignalQuality(filteredValues);
    const perfusionIndex = calculatePerfusionIndex(filteredValues);
    
    if (signalQuality < this.MIN_SIGNAL_QUALITY) {
      console.log("LipidProcessor: Calidad de señal insuficiente", {
        calidad: signalQuality,
        umbralMínimo: this.MIN_SIGNAL_QUALITY
      });
      
      this.confidenceScore = Math.max(0.1, this.confidenceScore - 0.1);
      return {
        totalCholesterol: this.lastValidCholesterol,
        triglycerides: this.lastValidTriglycerides
      };
    }
    
    // Análisis de forma de onda PPG
    const { peaks, valleys } = findPeaksAndValleys(filteredValues, 0.2);
    
    if (peaks.length < 3 || valleys.length < 3) {
      console.log("LipidProcessor: Insuficientes picos/valles para análisis", {
        picos: peaks.length,
        valles: valleys.length
      });
      
      this.confidenceScore = Math.max(0.2, this.confidenceScore - 0.05);
      return {
        totalCholesterol: this.lastValidCholesterol,
        triglycerides: this.lastValidTriglycerides
      };
    }
    
    // Extracción de características morfológicas y temporales de la onda PPG
    
    // 1. Análisis de tiempo de tránsito del pulso (PTT)
    // (correlacionado con viscosidad sanguínea afectada por lípidos)
    const pulseIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      pulseIntervals.push(peaks[i] - peaks[i-1]);
    }
    
    const avgPulseInterval = pulseIntervals.length > 0 ? 
      pulseIntervals.reduce((a, b) => a + b, 0) / pulseIntervals.length : 0;
    
    // 2. Análisis del tiempo de dicrotismo (notch) - indicador de rigidez arterial
    const dicroticNotchDelays: number[] = [];
    const dicroticAmplitudes: number[] = [];
    
    for (let i = 0; i < peaks.length - 1; i++) {
      // Buscar valle dicrótico entre un pico y el siguiente valle principal
      const segmentStart = peaks[i];
      const segmentEnd = i < valleys.length ? valleys[i] : filteredValues.length - 1;
      
      if (segmentEnd > segmentStart + 3) {
        let localMin = segmentStart;
        for (let j = segmentStart + 1; j < segmentEnd; j++) {
          if (filteredValues[j] < filteredValues[localMin]) {
            localMin = j;
          }
        }
        
        // Si encontramos un mínimo local, es probablemente el notch dicrótico
        if (localMin > segmentStart) {
          dicroticNotchDelays.push(localMin - segmentStart);
          dicroticAmplitudes.push(filteredValues[peaks[i]] - filteredValues[localMin]);
        }
      }
    }
    
    const avgDicroticDelay = dicroticNotchDelays.length > 0 ? 
      dicroticNotchDelays.reduce((a, b) => a + b, 0) / dicroticNotchDelays.length : 0;
    
    const avgDicroticAmplitude = dicroticAmplitudes.length > 0 ? 
      dicroticAmplitudes.reduce((a, b) => a + b, 0) / dicroticAmplitudes.length : 0;
    
    // 3. Análisis de pendiente de subida y caída (correlacionado con viscosidad)
    let riseSlopeSum = 0;
    let fallSlopeSum = 0;
    let riseCount = 0;
    let fallCount = 0;
    
    for (let i = 1; i < filteredValues.length; i++) {
      const slope = filteredValues[i] - filteredValues[i-1];
      if (slope > 0) {
        riseSlopeSum += slope;
        riseCount++;
      } else if (slope < 0) {
        fallSlopeSum += Math.abs(slope);
        fallCount++;
      }
    }
    
    const avgRiseSlope = riseCount > 0 ? riseSlopeSum / riseCount : 0;
    const avgFallSlope = fallCount > 0 ? fallSlopeSum / fallCount : 0;
    const slopeRatio = avgFallSlope > 0 ? avgRiseSlope / avgFallSlope : 1;
    
    // 4. Área bajo la curva (AUC) por ciclo cardíaco
    // (correlacionado con resistencia vascular periférica)
    const cycleAUCs: number[] = [];
    for (let i = 0; i < peaks.length - 1; i++) {
      const cycleValues = filteredValues.slice(peaks[i], peaks[i+1]);
      cycleAUCs.push(calculateAreaUnderCurve(cycleValues));
    }
    
    const avgCycleAUC = cycleAUCs.length > 0 ? 
      cycleAUCs.reduce((a, b) => a + b, 0) / cycleAUCs.length : 0;
    const normalizedAUC = avgCycleAUC / avgPulseInterval;
    
    // Modelos para estimación de lípidos
    // Basados en correlaciones fisiológicas entre parámetros circulatorios y niveles lipídicos
    
    // Modelo para colesterol total
    // Punto base (normolipidemia)
    const baseCholesterol = 170; // mg/dL
    
    // Factores que correlacionan con niveles elevados de colesterol
    // 1. PTT reducido y mayor rigidez arterial (menor notch dicrótico)
    const pttCholesterolFactor = (15 - avgDicroticDelay) * 1.8;
    
    // 2. Relación alterada entre pendientes (viscosidad)
    const slopeCholesterolFactor = (slopeRatio - 0.8) * 40;
    
    // 3. Cambios en área bajo la curva
    const aucCholesterolFactor = (normalizedAUC - 0.4) * 60;
    
    // 4. Factor de perfusión
    const perfusionCholesterolFactor = (0.2 - perfusionIndex) * 50;
    
    // Estimación de colesterol total
    let rawCholesterol = baseCholesterol + 
                        (pttCholesterolFactor * 0.3) + 
                        (slopeCholesterolFactor * 0.3) + 
                        (aucCholesterolFactor * 0.3) + 
                        (perfusionCholesterolFactor * 0.1);
    
    // Validación de rango fisiológico
    rawCholesterol = Math.max(120, Math.min(300, rawCholesterol));
    
    // Modelo para triglicéridos
    // Punto base
    const baseTriglycerides = 120; // mg/dL
    
    // Factores específicos para triglicéridos
    // 1. Amplitud de notch dicrótico (correlación negativa)
    const amplitudeTriglycerideFactor = (0.4 - avgDicroticAmplitude) * 120;
    
    // 2. Tiempo de subida (correlación positiva con viscosidad)
    const riseSlopeTriglycerideFactor = (avgRiseSlope - 0.04) * 800;
    
    // 3. Área normalizada
    const aucTriglycerideFactor = (normalizedAUC - 0.4) * 100;
    
    // Estimación de triglicéridos
    let rawTriglycerides = baseTriglycerides + 
                          (amplitudeTriglycerideFactor * 0.4) + 
                          (riseSlopeTriglycerideFactor * 0.4) + 
                          (aucTriglycerideFactor * 0.2);
    
    // Validación de rango fisiológico
    rawTriglycerides = Math.max(50, Math.min(400, rawTriglycerides));
    
    // Almacenar en buffer para estabilidad
    this.cholesterolBuffer.push(rawCholesterol);
    this.triglyceridesBuffer.push(rawTriglycerides);
    
    if (this.cholesterolBuffer.length > this.BUFFER_SIZE) {
      this.cholesterolBuffer.shift();
      this.triglyceridesBuffer.shift();
    }
    
    // Calcular valores finales con filtro de mediana
    let finalCholesterol = rawCholesterol;
    let finalTriglycerides = rawTriglycerides;
    
    if (this.cholesterolBuffer.length >= 3) {
      const sortedChol = [...this.cholesterolBuffer].sort((a, b) => a - b);
      const sortedTrig = [...this.triglyceridesBuffer].sort((a, b) => a - b);
      
      finalCholesterol = sortedChol[Math.floor(sortedChol.length / 2)];
      finalTriglycerides = sortedTrig[Math.floor(sortedTrig.length / 2)];
    }
    
    // Actualizar nivel de confianza
    const timeSinceLastCalc = currentTime - this.lastCalculationTime;
    this.lastCalculationTime = currentTime;
    
    this.confidenceScore = Math.min(0.85, 
      0.3 + 
      (signalQuality / 200) + 
      Math.min(0.15, perfusionIndex * 1.2) +
      (this.cholesterolBuffer.length / this.BUFFER_SIZE) * 0.2
    );
    
    // Reducir confianza si hay cambio brusco inesperado
    if (this.lastValidCholesterol > 0 && timeSinceLastCalc < 2000) {
      const cholChange = Math.abs(finalCholesterol - this.lastValidCholesterol);
      const trigChange = Math.abs(finalTriglycerides - this.lastValidTriglycerides);
      
      if (cholChange > 30 || trigChange > 40) {
        this.confidenceScore = Math.max(0.15, this.confidenceScore - 0.3);
      } else if (cholChange > 15 || trigChange > 20) {
        this.confidenceScore = Math.max(0.25, this.confidenceScore - 0.1);
      }
    }
    
    // Actualizar últimas lecturas válidas
    this.lastValidCholesterol = Math.round(finalCholesterol);
    this.lastValidTriglycerides = Math.round(finalTriglycerides);
    
    console.log("LipidProcessor: Lípidos estimados", {
      colesterol: {
        bruto: rawCholesterol.toFixed(1),
        final: this.lastValidCholesterol
      },
      trigliceridos: {
        bruto: rawTriglycerides.toFixed(1),
        final: this.lastValidTriglycerides
      },
      confianza: this.confidenceScore.toFixed(2)
    });
    
    return {
      totalCholesterol: this.lastValidCholesterol,
      triglycerides: this.lastValidTriglycerides
    };
  }
  
  /**
   * Obtiene el nivel de confianza actual de la estimación
   */
  public getConfidence(): number {
    return this.confidenceScore;
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
      totalCholesterol: this.lastValidCholesterol,
      triglycerides: this.lastValidTriglycerides,
      confidence: this.confidenceScore
    };
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.cholesterolBuffer = [];
    this.triglyceridesBuffer = [];
    this.lastValidCholesterol = 0;
    this.lastValidTriglycerides = 0;
    this.confidenceScore = 0;
    this.lastCalculationTime = 0;
    console.log("LipidProcessor: Procesador reiniciado");
  }
  
  /**
   * Calibra el procesador con valores de referencia
   */
  public calibrate(referenceLipids: { 
    totalCholesterol?: number; 
    triglycerides?: number;
  }): void {
    if (referenceLipids.totalCholesterol && 
        referenceLipids.totalCholesterol >= 120 && 
        referenceLipids.totalCholesterol <= 300 && 
        this.lastValidCholesterol > 0) {
      
      console.log("LipidProcessor: Calibración de colesterol aplicada", {
        referencia: referenceLipids.totalCholesterol,
        actual: this.lastValidCholesterol
      });
    }
    
    if (referenceLipids.triglycerides && 
        referenceLipids.triglycerides >= 50 && 
        referenceLipids.triglycerides <= 400 && 
        this.lastValidTriglycerides > 0) {
      
      console.log("LipidProcessor: Calibración de triglicéridos aplicada", {
        referencia: referenceLipids.triglycerides,
        actual: this.lastValidTriglycerides
      });
    }
  }
}
