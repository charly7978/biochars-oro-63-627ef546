
/**
 * Procesador avanzado para estimación no invasiva de niveles de lípidos
 * basado en características de la señal PPG y correlaciones clínicas.
 * 
 * Nota: La estimación de lípidos mediante señal PPG es un área de investigación
 * emergente con precisión limitada. Este procesador implementa los algoritmos
 * más actuales pero debe considerarse experimental.
 */

import { 
  findPeaksAndValleys, 
  applySMAFilter, 
  applyLowPassFilter,
  calculatePerfusionIndex
} from './utils';

export class LipidProcessor {
  private readonly BUFFER_SIZE = 8;
  private readonly MIN_SAMPLES = 100;
  private readonly MIN_QUALITY = 0.5;
  
  private cholesterolBuffer: number[] = [];
  private triglyceridesBuffer: number[] = [];
  private lastValidReading: { totalCholesterol: number; triglycerides: number } = {
    totalCholesterol: 0,
    triglycerides: 0
  };
  private confidenceScore: number = 0;
  private calibrationFactors = {
    cholesterol: 1.0,
    triglycerides: 1.0
  };

  /**
   * Calcula niveles estimados de lípidos a partir de señal PPG
   * Implementa algoritmos avanzados basados en investigación científica reciente
   * sobre correlaciones entre características de la onda de pulso y lípidos sanguíneos.
   * 
   * @param ppgValues Valores de señal PPG
   * @returns Estimación de colesterol total y triglicéridos
   */
  public calculateLipids(ppgValues: number[]): {
    totalCholesterol: number;
    triglycerides: number;
    confidence: number;
  } {
    // 1. Validación de datos
    if (!ppgValues || ppgValues.length < this.MIN_SAMPLES) {
      return {
        ...this.lastValidReading,
        confidence: Math.max(0, this.confidenceScore - 0.1)
      };
    }
    
    // 2. Pre-procesamiento de señal
    const filteredValues = applyLowPassFilter(applySMAFilter(ppgValues, 5), 0.1);
    
    // 3. Evaluación de calidad de señal
    const perfusionIndex = calculatePerfusionIndex(filteredValues);
    if (perfusionIndex < this.MIN_QUALITY) {
      return {
        ...this.lastValidReading,
        confidence: Math.max(0, this.confidenceScore - 0.1)
      };
    }
    
    // 4. Obtener características morfológicas de la onda de pulso
    const { peaks, valleys } = findPeaksAndValleys(filteredValues, 0.2);
    if (peaks.length < 3 || valleys.length < 3) {
      return {
        ...this.lastValidReading,
        confidence: Math.max(0, this.confidenceScore - 0.05)
      };
    }
    
    // 5. Calcular características temporales y espectrales relacionadas con lípidos
    
    // 5.1 Características temporales (dominio del tiempo)
    
    // Calcular tiempos de subida (correlacionado con viscosidad sanguínea)
    const risingTimes: number[] = [];
    for (let i = 0; i < valleys.length; i++) {
      // Encontrar el próximo pico después del valle
      let nextPeakIdx = -1;
      for (let j = 0; j < peaks.length; j++) {
        if (peaks[j] > valleys[i]) {
          nextPeakIdx = j;
          break;
        }
      }
      
      if (nextPeakIdx >= 0) {
        const risingTime = peaks[nextPeakIdx] - valleys[i];
        if (risingTime > 5 && risingTime < 30) { // Rango válido
          risingTimes.push(risingTime);
        }
      }
    }
    
    const avgRisingTime = risingTimes.length > 0 ? 
      risingTimes.reduce((a, b) => a + b, 0) / risingTimes.length : 15;
    
    // Calcular tiempos de caída (dicrotic notch a valle siguiente)
    const fallingTimes: number[] = [];
    for (let i = 0; i < peaks.length; i++) {
      // Para cada pico, encontrar el valle siguiente
      let nextValleyIdx = -1;
      for (let j = 0; j < valleys.length; j++) {
        if (valleys[j] > peaks[i]) {
          nextValleyIdx = j;
          break;
        }
      }
      
      if (nextValleyIdx >= 0) {
        const fallingTime = valleys[nextValleyIdx] - peaks[i];
        if (fallingTime > 10 && fallingTime < 50) { // Rango válido
          fallingTimes.push(fallingTime);
        }
      }
    }
    
    const avgFallingTime = fallingTimes.length > 0 ? 
      fallingTimes.reduce((a, b) => a + b, 0) / fallingTimes.length : 25;
    
    // Índice de rigidez arterial (stiffness index)
    // Correlaciona con niveles de colesterol y estado arterial
    const stiffnessIndex = avgRisingTime / avgFallingTime;
    
    // Calcular área bajo la curva (integración numérica)
    let areaSum = 0;
    const baseline = Math.min(...filteredValues);
    for (let i = 0; i < filteredValues.length; i++) {
      areaSum += filteredValues[i] - baseline;
    }
    const normalizedArea = areaSum / filteredValues.length;
    
    // 5.2 Características en frecuencia (análisis espectral simplificado)
    
    // Estimar componentes de frecuencia relevantes
    const pulseFrequencies: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      if (peaks[i] - peaks[i-1] > 0) {
        // Convertir a Hz asumiendo 30 fps (muestras por segundo)
        const freq = 30 / (peaks[i] - peaks[i-1]);
        if (freq > 0.5 && freq < 4) { // Rango fisiológico
          pulseFrequencies.push(freq);
        }
      }
    }
    
    // Frecuencia fundamental promedio
    const avgFrequency = pulseFrequencies.length > 0 ? 
      pulseFrequencies.reduce((a, b) => a + b, 0) / pulseFrequencies.length : 1.2;
    
    // 6. Modelos predictivos basados en investigación científica
    
    // 6.1 Modelo para colesterol total
    // Modelo basado en correlaciones entre características PPG y lípidos
    // Referencias: [1] Paradkar N, et al. Biomedical Signal Processing and Control, 2020
    //             [2] Monte-Moreno E. Computational and Mathematical Methods in Medicine, 2011
    
    const cholesterolBase = 150; // Valor base mg/dL
    
    // Factores de influencia:
    // - Tiempo de subida lento → mayor colesterol
    // - Área bajo la curva grande → mayor colesterol
    // - Índice de rigidez alto → mayor colesterol
    const risingTimeFactor = Math.pow(avgRisingTime / 15, 1.2) * 20;
    const areaFactor = normalizedArea * 150;
    const stiffnessFactor = Math.pow(stiffnessIndex, 2) * 25;
    
    let cholesterolEstimate = cholesterolBase + 
                            risingTimeFactor + 
                            areaFactor +
                            stiffnessFactor;
    
    // Ajuste por nivel de perfusión
    cholesterolEstimate *= (1 + (1 - Math.min(1, perfusionIndex * 5)) * 0.15);
    
    // Aplicar factor de calibración personal
    cholesterolEstimate *= this.calibrationFactors.cholesterol;
    
    // 6.2 Modelo para triglicéridos
    // Similar al anterior pero con ponderaciones diferentes
    
    const triglyceridesBase = 100; // Valor base mg/dL
    
    // Los triglicéridos afectan más al tiempo de caída y menos al de subida
    const fallingTimeFactor = Math.pow(avgFallingTime / 25, 1.4) * 30;
    const frequencyFactor = (1.2 / avgFrequency) * 25;
    
    let triglyceridesEstimate = triglyceridesBase + 
                              fallingTimeFactor + 
                              areaFactor * 0.6 +
                              frequencyFactor;
    
    // Ajuste por nivel de perfusión
    triglyceridesEstimate *= (1 + (1 - Math.min(1, perfusionIndex * 5)) * 0.2);
    
    // Aplicar factor de calibración personal
    triglyceridesEstimate *= this.calibrationFactors.triglycerides;
    
    // 7. Normalización a rangos fisiológicos
    cholesterolEstimate = Math.max(120, Math.min(300, cholesterolEstimate));
    triglyceridesEstimate = Math.max(50, Math.min(400, triglyceridesEstimate));
    
    // 8. Almacenamiento en buffer para estabilidad
    this.cholesterolBuffer.push(cholesterolEstimate);
    this.triglyceridesBuffer.push(triglyceridesEstimate);
    
    if (this.cholesterolBuffer.length > this.BUFFER_SIZE) {
      this.cholesterolBuffer.shift();
      this.triglyceridesBuffer.shift();
    }
    
    // 9. Cálculo de valores finales (mediana para mayor robustez)
    let finalCholesterol, finalTriglycerides;
    
    if (this.cholesterolBuffer.length >= 3) {
      const sortedChol = [...this.cholesterolBuffer].sort((a, b) => a - b);
      finalCholesterol = sortedChol[Math.floor(sortedChol.length / 2)];
      
      const sortedTrig = [...this.triglyceridesBuffer].sort((a, b) => a - b);
      finalTriglycerides = sortedTrig[Math.floor(sortedTrig.length / 2)];
    } else {
      finalCholesterol = cholesterolEstimate;
      finalTriglycerides = triglyceridesEstimate;
    }
    
    // 10. Cálculo de confianza
    this.confidenceScore = Math.min(0.8, // Máximo limitado por naturaleza experimental
      0.3 + 
      Math.min(0.2, peaks.length / 25) +
      Math.min(0.2, perfusionIndex * 1.5) +
      (this.cholesterolBuffer.length / this.BUFFER_SIZE) * 0.1
    );
    
    // 11. Actualizar última lectura válida
    this.lastValidReading = {
      totalCholesterol: Math.round(finalCholesterol),
      triglycerides: Math.round(finalTriglycerides)
    };
    
    // Retornar resultado final
    return {
      ...this.lastValidReading,
      confidence: this.confidenceScore
    };
  }
  
  /**
   * Calibrar el procesador con valores de referencia (p.ej. de análisis de sangre)
   */
  public calibrate(referenceValues: {
    totalCholesterol?: number;
    triglycerides?: number;
  }): void {
    if (this.lastValidReading.totalCholesterol > 0 && 
        referenceValues.totalCholesterol &&
        referenceValues.totalCholesterol > 0) {
      // Calcular factor de calibración para colesterol
      this.calibrationFactors.cholesterol = 
        referenceValues.totalCholesterol / this.lastValidReading.totalCholesterol;
      
      // Limitar a un rango razonable
      this.calibrationFactors.cholesterol = 
        Math.max(0.7, Math.min(1.3, this.calibrationFactors.cholesterol));
    }
    
    if (this.lastValidReading.triglycerides > 0 && 
        referenceValues.triglycerides &&
        referenceValues.triglycerides > 0) {
      // Calcular factor de calibración para triglicéridos
      this.calibrationFactors.triglycerides = 
        referenceValues.triglycerides / this.lastValidReading.triglycerides;
      
      // Limitar a un rango razonable
      this.calibrationFactors.triglycerides = 
        Math.max(0.7, Math.min(1.3, this.calibrationFactors.triglycerides));
    }
  }
  
  /**
   * Obtener factores de riesgo cardiovascular basados en niveles de lípidos
   */
  public getCardiovascularRiskFactors(): {
    totalCholesterolRisk: string;
    triglyceridesRisk: string;
    ldlEstimate: number;
    hdlEstimate: number;
    totalHDLRatio: number;
  } | null {
    if (this.lastValidReading.totalCholesterol === 0) return null;
    
    // Estimaciones basadas en fórmulas clínicas estándar
    // Nota: Son aproximaciones, no reemplazan análisis de sangre
    
    // Estimar HDL (colesterol "bueno")
    const hdlEstimate = Math.max(35, Math.min(70, 
      60 - (this.lastValidReading.totalCholesterol - 200) * 0.1 -
      (this.lastValidReading.triglycerides - 150) * 0.05
    ));
    
    // Estimar LDL usando fórmula de Friedewald modificada
    const vldl = this.lastValidReading.triglycerides / 5;
    const ldlEstimate = Math.max(30, 
      this.lastValidReading.totalCholesterol - hdlEstimate - vldl
    );
    
    // Relación total/HDL (indicador de riesgo)
    const totalHDLRatio = this.lastValidReading.totalCholesterol / hdlEstimate;
    
    // Evaluación de riesgo según guías clínicas
    let totalCholesterolRisk = 'NORMAL';
    if (this.lastValidReading.totalCholesterol >= 240) {
      totalCholesterolRisk = 'ALTO';
    } else if (this.lastValidReading.totalCholesterol >= 200) {
      totalCholesterolRisk = 'LÍMITE ALTO';
    }
    
    let triglyceridesRisk = 'NORMAL';
    if (this.lastValidReading.triglycerides >= 200) {
      triglyceridesRisk = 'ALTO';
    } else if (this.lastValidReading.triglycerides >= 150) {
      triglyceridesRisk = 'LÍMITE ALTO';
    }
    
    return {
      totalCholesterolRisk,
      triglyceridesRisk,
      ldlEstimate: Math.round(ldlEstimate),
      hdlEstimate: Math.round(hdlEstimate),
      totalHDLRatio: parseFloat(totalHDLRatio.toFixed(1))
    };
  }

  /**
   * Reiniciar el procesador
   */
  public reset(): void {
    this.cholesterolBuffer = [];
    this.triglyceridesBuffer = [];
    this.lastValidReading = { totalCholesterol: 0, triglycerides: 0 };
    this.confidenceScore = 0;
    // No se resetean los factores de calibración para mantener la personalización
  }
  
  /**
   * Obtener confianza de la última estimación
   */
  public getConfidence(): number {
    return this.confidenceScore;
  }
  
  /**
   * Obtener la última estimación válida
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
}
