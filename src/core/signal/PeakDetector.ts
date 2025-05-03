
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { findMaximum, findMinimum } from '../../utils/signalUtils';

interface PeakDetectionResult {
  peakIndices: number[];
  valleyIndices: number[];
  signalQuality: number;
}

/**
 * Clase dedicada a detección de picos en señales PPG
 * Utiliza solo procesamiento de señales real, sin simulaciones
 */
export class PeakDetector {
  // Configuración para detección
  private readonly config = {
    minPeakHeight: 0.1,        // Altura mínima relativa de picos
    minPeakDistance: 10,       // Distancia mínima entre picos en muestras
    minPeakProminence: 0.05,   // Prominencia mínima relativa
    minSignalAmplitude: 0.02,  // Amplitud mínima para señal válida
  };

  /**
   * Constructor con configuración opcional
   */
  constructor(config?: Partial<typeof PeakDetector.prototype.config>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Detecta picos y valles en una señal PPG
   * Sin usar ninguna función Math
   */
  public detectPeaks(signal: number[]): PeakDetectionResult {
    // Necesitamos al menos 3 muestras para detectar picos
    if (signal.length < 3) {
      return { peakIndices: [], valleyIndices: [], signalQuality: 0 };
    }

    // Paso 1: Calcular min/max para normalizar y establecer umbrales adaptativos
    const min = findMinimum(signal);
    const max = findMaximum(signal);
    const range = max - min;
    
    // Calcular umbral adaptativo basado en el rango de la señal
    const peakThreshold = min + range * this.config.minPeakHeight;
    
    // Si la amplitud es muy pequeña, considerar que no hay picos válidos
    if (range < this.config.minSignalAmplitude) {
      return { peakIndices: [], valleyIndices: [], signalQuality: 0 };
    }

    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];

    // Paso 2: Detectar picos (máximos locales que superan el umbral)
    for (let i = 1; i < signal.length - 1; i++) {
      // Detectar picos
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1] && signal[i] > peakThreshold) {
        // Verificar distancia con el pico anterior
        const lastPeakIndex = peakIndices.length > 0 ? peakIndices[peakIndices.length - 1] : -100;
        if (i - lastPeakIndex >= this.config.minPeakDistance) {
          peakIndices.push(i);
        } else if (signal[i] > signal[lastPeakIndex]) {
          // Si el nuevo pico es más alto que el anterior y está muy cerca, reemplazar
          peakIndices[peakIndices.length - 1] = i;
        }
      }
      
      // Detectar valles (mínimos locales)
      if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
        // Verificar distancia con el valle anterior
        const lastValleyIndex = valleyIndices.length > 0 ? valleyIndices[valleyIndices.length - 1] : -100;
        if (i - lastValleyIndex >= this.config.minPeakDistance) {
          valleyIndices.push(i);
        } else if (signal[i] < signal[lastValleyIndex]) {
          // Si el nuevo valle es más bajo que el anterior y está muy cerca, reemplazar
          valleyIndices[valleyIndices.length - 1] = i;
        }
      }
    }

    // Paso 3: Validar picos por prominencia
    const validatedPeaks = this.validatePeaksByProminence(signal, peakIndices, valleyIndices);
    
    // Paso 4: Calcular calidad de señal basada en regularidad y amplitud
    const signalQuality = this.calculateSignalQuality(signal, validatedPeaks, range);

    return { 
      peakIndices: validatedPeaks, 
      valleyIndices, 
      signalQuality 
    };
  }

  /**
   * Valida los picos según su prominencia (altura relativa respecto a valles adyacentes)
   * Sin usar ninguna función Math
   */
  private validatePeaksByProminence(signal: number[], peakIndices: number[], valleyIndices: number[]): number[] {
    if (peakIndices.length === 0) return [];
    
    const validatedPeaks: number[] = [];
    
    // Para cada pico, calcular su prominencia
    for (const peakIndex of peakIndices) {
      // Encontrar valles adyacentes
      let leftValleyIndex = -1;
      let rightValleyIndex = -1;
      
      // Buscar valle a la izquierda
      for (let i = valleyIndices.length - 1; i >= 0; i--) {
        if (valleyIndices[i] < peakIndex) {
          leftValleyIndex = valleyIndices[i];
          break;
        }
      }
      
      // Buscar valle a la derecha
      for (let i = 0; i < valleyIndices.length; i++) {
        if (valleyIndices[i] > peakIndex) {
          rightValleyIndex = valleyIndices[i];
          break;
        }
      }
      
      // Si no se encuentran valles, usar los extremos o valores cercanos
      const leftValue = leftValleyIndex >= 0 ? signal[leftValleyIndex] : signal[0];
      const rightValue = rightValleyIndex >= 0 ? signal[rightValleyIndex] : signal[signal.length - 1];
      
      // Calcular prominencia - altura respecto al valle más alto
      const peakValue = signal[peakIndex];
      const higherValley = leftValue > rightValue ? leftValue : rightValue;
      const prominence = peakValue - higherValley;
      
      // Validar por prominencia mínima
      if (prominence >= this.config.minPeakProminence) {
        validatedPeaks.push(peakIndex);
      }
    }
    
    return validatedPeaks;
  }

  /**
   * Calcula la calidad de la señal basada en regularidad y amplitud
   * Sin usar ninguna función Math
   */
  private calculateSignalQuality(signal: number[], peaks: number[], range: number): number {
    // Si no hay picos o la amplitud es muy baja, la calidad es 0
    if (peaks.length < 2 || range < this.config.minSignalAmplitude * 3) {
      return 0;
    }
    
    // Calcular regularidad de los intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Calcular media de intervalos
    let sum = 0;
    for (const interval of intervals) {
      sum += interval;
    }
    const meanInterval = sum / intervals.length;
    
    // Calcular variabilidad (desviación respecto a la media)
    let varianceSum = 0;
    for (const interval of intervals) {
      const diff = interval > meanInterval ? interval - meanInterval : meanInterval - interval;
      varianceSum += diff * diff;
    }
    const variance = varianceSum / intervals.length;
    
    // Calcular calidad basada en varianza normalizada (menor varianza = mayor calidad)
    // y amplitud de la señal
    const regularityFactor = 1.0 / (1.0 + variance / (meanInterval * meanInterval));
    const amplitudeFactor = range < 0.2 ? range * 5 : 1.0;
    
    // La calidad es producto de regularidad, amplitud y cantidad de picos
    let quality = regularityFactor * amplitudeFactor * (peaks.length / 10);
    
    // Limitar a rango 0-100
    if (quality > 1.0) quality = 1.0;
    if (quality < 0.0) quality = 0.0;
    
    return quality * 100;
  }
}
