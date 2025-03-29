
/**
 * Analizador de formas de onda cardíacas que proporciona interpretaciones
 * clínicamente relevantes basadas en la morfología, ritmo y otros parámetros.
 */
export class CardiacWaveformAnalyzer {
  // Patrones de ritmo cardíaco
  private readonly RHYTHM_TYPES = {
    REGULAR: 'Regular',
    IRREGULAR: 'Irregular',
    VARIABLE: 'Variable',
    BIGEMINY: 'Patrón de bigeminia',
    TRIGEMINY: 'Patrón de trigeminia'
  };

  // Calidad de la forma de onda
  private readonly WAVEFORM_QUALITY = {
    EXCELLENT: 'Excelente',
    GOOD: 'Buena',
    FAIR: 'Aceptable',
    POOR: 'Pobre'
  };

  // Interpretaciones clínicas simplificadas
  private readonly CLINICAL_INTERPRETATIONS = {
    NORMAL: 'Ritmo normal',
    BRADYCARDIA: 'Bradicardia',
    TACHYCARDIA: 'Taquicardia',
    IRREGULAR: 'Ritmo irregular',
    ARRHYTHMIA: 'Posible arritmia',
    PAC: 'Posibles contracciones auriculares prematuras',
    PVC: 'Posibles contracciones ventriculares prematuras',
    PALPITATION: 'Palpitaciones',
    AF_SUSPECTED: 'Posible fibrilación auricular'
  };

  /**
   * Analiza datos de forma de onda cardíaca para generar una interpretación clínica
   */
  public analyzeWaveform(
    waveformData: Array<{ time: number, value: number, isPeak?: boolean }>,
    rrIntervals: number[],
    bpm: number,
    arrhythmiaCount: number
  ): CardiacAnalysisResult {
    // Análisis del ritmo basado en intervalos RR
    const rhythmAnalysis = this.analyzeRhythm(rrIntervals);
    
    // Análisis de la morfología de la onda
    const morphologyAnalysis = this.analyzeMorphology(waveformData);
    
    // Análisis de la frecuencia cardíaca
    const rateAnalysis = this.analyzeHeartRate(bpm);
    
    // Evaluar calidad de la señal
    const signalQuality = this.evaluateSignalQuality(waveformData, rrIntervals);
    
    // Interpretación clínica combinada
    const clinicalInterpretation = this.generateInterpretation(
      rhythmAnalysis, 
      rateAnalysis, 
      morphologyAnalysis, 
      arrhythmiaCount
    );
    
    // Recomendaciones basadas en el análisis
    const recommendations = this.generateRecommendations(
      rhythmAnalysis,
      rateAnalysis,
      arrhythmiaCount,
      signalQuality
    );
    
    return {
      rhythmType: rhythmAnalysis.type,
      signalQuality: signalQuality.quality,
      heartRateCategory: rateAnalysis.category,
      variabilityIndex: rhythmAnalysis.variability,
      interpretation: clinicalInterpretation,
      recommendations: recommendations,
      reliability: signalQuality.reliability,
      waveformCharacteristics: morphologyAnalysis.characteristics
    };
  }
  
  /**
   * Analiza el ritmo cardíaco basado en intervalos RR
   */
  private analyzeRhythm(rrIntervals: number[]): {
    type: string,
    variability: number,
    patterns: string[]
  } {
    if (rrIntervals.length < 3) {
      return {
        type: this.RHYTHM_TYPES.REGULAR,
        variability: 0,
        patterns: []
      };
    }
    
    // Calcular la variabilidad de los intervalos RR (RMSSD)
    const differences = [];
    for (let i = 1; i < rrIntervals.length; i++) {
      differences.push(Math.abs(rrIntervals[i] - rrIntervals[i-1]));
    }
    
    const sumSquaredDiff = differences.reduce((sum, diff) => sum + Math.pow(diff, 2), 0);
    const rmssd = Math.sqrt(sumSquaredDiff / differences.length);
    
    // Normalizar la variabilidad (0-100)
    const variabilityIndex = Math.min(100, Math.round(rmssd / 5));
    
    // Detectar patrones específicos
    const patterns = [];
    
    // Patrón de bigeminia (alternancia de intervalos cortos y largos)
    let bigeminyCount = 0;
    for (let i = 2; i < rrIntervals.length; i += 2) {
      const ratio1 = rrIntervals[i-1] / rrIntervals[i-2];
      const ratio2 = rrIntervals[i] / rrIntervals[i-1];
      
      if ((ratio1 < 0.85 || ratio1 > 1.15) && (ratio2 < 0.85 || ratio2 > 1.15) && 
          (ratio1 < 0.9 || ratio1 > 1.1) !== (ratio2 < 0.9 || ratio2 > 1.1)) {
        bigeminyCount++;
      }
    }
    
    if (bigeminyCount >= Math.floor(rrIntervals.length / 4)) {
      patterns.push(this.RHYTHM_TYPES.BIGEMINY);
    }
    
    // Determinar tipo de ritmo
    let rhythmType;
    if (variabilityIndex < 15) {
      rhythmType = this.RHYTHM_TYPES.REGULAR;
    } else if (variabilityIndex < 30) {
      rhythmType = this.RHYTHM_TYPES.VARIABLE;
    } else {
      rhythmType = this.RHYTHM_TYPES.IRREGULAR;
    }
    
    return {
      type: rhythmType,
      variability: variabilityIndex,
      patterns
    };
  }
  
  /**
   * Analiza la morfología de la forma de onda
   */
  private analyzeMorphology(waveformData: Array<{ time: number, value: number, isPeak?: boolean }>): {
    characteristics: string[]
  } {
    // Características identificadas
    const characteristics = [];
    
    // Buscar picos en la señal
    const peaks = waveformData.filter(point => point.isPeak);
    
    if (peaks.length < 2) {
      return { characteristics: ['Datos insuficientes'] };
    }
    
    // Extraer segmentos entre picos
    const segments = [];
    for (let i = 1; i < peaks.length; i++) {
      const startIdx = waveformData.findIndex(p => p.time === peaks[i-1].time);
      const endIdx = waveformData.findIndex(p => p.time === peaks[i].time);
      
      if (startIdx >= 0 && endIdx > startIdx) {
        segments.push(waveformData.slice(startIdx, endIdx));
      }
    }
    
    // Analizar características de los segmentos
    if (segments.length > 0) {
      // Calcular amplitud promedio
      const amplitudes = segments.map(seg => {
        const values = seg.map(p => p.value);
        return Math.max(...values) - Math.min(...values);
      });
      
      const avgAmplitude = amplitudes.reduce((sum, a) => sum + a, 0) / amplitudes.length;
      
      // Detectar dicróticos (ondas secundarias)
      let hasProminentDicroticWave = false;
      for (const segment of segments) {
        // Buscar una onda secundaria después del pico principal
        const peakIdx = segment.findIndex(p => p.isPeak);
        if (peakIdx > 0 && peakIdx < segment.length - 5) {
          // Buscar un valle seguido de una pequeña elevación
          const descendingPart = segment.slice(peakIdx, peakIdx + 5);
          const minIdx = descendingPart.indexOf(descendingPart.reduce((min, p) => 
            p.value < min.value ? p : min, descendingPart[0]));
            
          if (minIdx > 0 && minIdx < 4) {
            const postMin = descendingPart.slice(minIdx);
            const hasSecondaryRise = postMin.some((p, i) => 
              i > 0 && p.value > postMin[i-1].value);
              
            if (hasSecondaryRise) {
              hasProminentDicroticWave = true;
              break;
            }
          }
        }
      }
      
      // Añadir características identificadas
      if (hasProminentDicroticWave) {
        characteristics.push('Onda dicrótica prominente');
      }
      
      if (avgAmplitude > 0.5) {
        characteristics.push('Buena amplitud de pulso');
      } else if (avgAmplitude < 0.2) {
        characteristics.push('Amplitud de pulso reducida');
      }
    }
    
    return { characteristics };
  }
  
  /**
   * Analiza la frecuencia cardíaca
   */
  private analyzeHeartRate(bpm: number): {
    category: string,
    description: string
  } {
    if (bpm < 50) {
      return {
        category: 'Bradicardia',
        description: 'Frecuencia cardíaca baja (< 50 lpm)'
      };
    } else if (bpm < 60) {
      return {
        category: 'Bradicardia leve', 
        description: 'Frecuencia cardíaca ligeramente baja (50-59 lpm)'
      };
    } else if (bpm <= 100) {
      return {
        category: 'Normal',
        description: 'Frecuencia cardíaca normal (60-100 lpm)'
      };
    } else if (bpm <= 120) {
      return {
        category: 'Taquicardia leve',
        description: 'Frecuencia cardíaca ligeramente elevada (101-120 lpm)'
      };
    } else {
      return {
        category: 'Taquicardia',
        description: 'Frecuencia cardíaca elevada (> 120 lpm)'
      };
    }
  }
  
  /**
   * Evalúa la calidad de la señal
   */
  private evaluateSignalQuality(
    waveformData: Array<{ time: number, value: number, isPeak?: boolean }>,
    rrIntervals: number[]
  ): {
    quality: string,
    reliability: number
  } {
    if (waveformData.length < 10 || rrIntervals.length < 3) {
      return {
        quality: this.WAVEFORM_QUALITY.POOR,
        reliability: 0.2
      };
    }
    
    // Calcular la varianza de los valores
    const values = waveformData.map(p => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    // Calcular la consistencia de los intervalos RR
    const rrMean = rrIntervals.reduce((sum, rr) => sum + rr, 0) / rrIntervals.length;
    const rrVariance = rrIntervals.reduce((sum, rr) => sum + Math.pow(rr - rrMean, 2), 0) / rrIntervals.length;
    const rrConsistency = 1 - Math.min(1, Math.sqrt(rrVariance) / rrMean);
    
    // Calcular relación señal-ruido aproximada
    const signalRange = Math.max(...values) - Math.min(...values);
    const noiseEstimate = Math.sqrt(variance) / signalRange;
    const snr = 1 - Math.min(1, noiseEstimate);
    
    // Calcular confiabilidad general (0-1)
    const reliability = (snr * 0.5 + rrConsistency * 0.5) * 
                        Math.min(1, waveformData.length / 100) * 
                        Math.min(1, rrIntervals.length / 10);
    
    // Determinar calidad
    let quality;
    if (reliability > 0.8) {
      quality = this.WAVEFORM_QUALITY.EXCELLENT;
    } else if (reliability > 0.6) {
      quality = this.WAVEFORM_QUALITY.GOOD;
    } else if (reliability > 0.4) {
      quality = this.WAVEFORM_QUALITY.FAIR;
    } else {
      quality = this.WAVEFORM_QUALITY.POOR;
    }
    
    return {
      quality,
      reliability: Math.round(reliability * 100) / 100
    };
  }
  
  /**
   * Genera una interpretación clínica
   */
  private generateInterpretation(
    rhythmAnalysis: { type: string, variability: number, patterns: string[] },
    rateAnalysis: { category: string, description: string },
    morphologyAnalysis: { characteristics: string[] },
    arrhythmiaCount: number
  ): string {
    const interpretations = [];
    
    // Interpretación basada en la frecuencia
    if (rateAnalysis.category !== 'Normal') {
      interpretations.push(rateAnalysis.category);
    }
    
    // Interpretación basada en el ritmo
    if (rhythmAnalysis.type !== this.RHYTHM_TYPES.REGULAR) {
      if (rhythmAnalysis.variability > 40 && arrhythmiaCount > 2) {
        interpretations.push(this.CLINICAL_INTERPRETATIONS.AF_SUSPECTED);
      } else if (rhythmAnalysis.patterns.includes(this.RHYTHM_TYPES.BIGEMINY)) {
        interpretations.push(this.CLINICAL_INTERPRETATIONS.PVC);
      } else if (rhythmAnalysis.variability > 25) {
        interpretations.push(this.CLINICAL_INTERPRETATIONS.IRREGULAR);
      }
    }
    
    // Añadir información de arritmias
    if (arrhythmiaCount === 1) {
      interpretations.push('Se detectó 1 posible arritmia');
    } else if (arrhythmiaCount > 1) {
      interpretations.push(`Se detectaron ${arrhythmiaCount} posibles arritmias`);
    }
    
    // Si no hay interpretaciones anormales, es normal
    if (interpretations.length === 0) {
      return this.CLINICAL_INTERPRETATIONS.NORMAL;
    }
    
    return interpretations.join('. ');
  }
  
  /**
   * Genera recomendaciones basadas en el análisis
   */
  private generateRecommendations(
    rhythmAnalysis: { type: string, variability: number, patterns: string[] },
    rateAnalysis: { category: string, description: string },
    arrhythmiaCount: number,
    signalQuality: { quality: string, reliability: number }
  ): string[] {
    const recommendations = [];
    
    // Recomendaciones basadas en calidad de la señal
    if (signalQuality.quality === this.WAVEFORM_QUALITY.POOR) {
      recommendations.push('Mejorar la posición del dedo para obtener una señal más clara');
      return recommendations; // Si la calidad es pobre, solo recomendar mejorar la señal
    }
    
    // Recomendaciones basadas en frecuencia cardíaca
    if (rateAnalysis.category === 'Bradicardia') {
      recommendations.push('Controle su frecuencia cardíaca regularmente. Consulte si persiste el ritmo lento.');
    } else if (rateAnalysis.category === 'Taquicardia') {
      recommendations.push('Descanso recomendado. Controle su frecuencia cardíaca durante el siguiente día.');
    }
    
    // Recomendaciones basadas en irregularidades del ritmo
    if (rhythmAnalysis.variability > 40 || arrhythmiaCount > 2) {
      recommendations.push('Se recomienda monitoreo adicional de su ritmo cardíaco');
    }
    
    // Recomendaciones basadas en patrones específicos
    if (rhythmAnalysis.patterns.includes(this.RHYTHM_TYPES.BIGEMINY)) {
      recommendations.push('Se detectó un patrón inusual. Considere consultar a un especialista.');
    }
    
    // Si todo parece normal
    if (recommendations.length === 0) {
      if (signalQuality.reliability > 0.7) {
        recommendations.push('Su ritmo cardíaco parece normal. Continúe con mediciones periódicas.');
      } else {
        recommendations.push('Resultados preliminares normales. Repita la medición para mayor precisión.');
      }
    }
    
    return recommendations;
  }
}

/**
 * Resultado del análisis cardíaco
 */
export interface CardiacAnalysisResult {
  rhythmType: string;
  signalQuality: string;
  heartRateCategory: string;
  variabilityIndex: number;
  interpretation: string;
  recommendations: string[];
  reliability: number;
  waveformCharacteristics: string[];
}

/**
 * Instancia singleton para uso global
 */
export const cardiacAnalyzer = new CardiacWaveformAnalyzer();
