import { EMDProcessor } from '../../types/signal';

/**
 * Implementación del algoritmo de Descomposición Modal Empírica (EMD)
 * para análisis de señales PPG
 */
export class EMDProcessorImpl implements EMDProcessor {
  private options: {
    maxIterations: number;
    threshold: number;
    maxImf: number;
  };

  constructor(options?: {
    maxIterations?: number;
    threshold?: number;
    maxImf?: number;
  }) {
    this.options = {
      maxIterations: options?.maxIterations || 10,
      threshold: options?.threshold || 0.05,
      maxImf: options?.maxImf || 5
    };
  }

  /**
   * Descompone una señal en sus funciones de modo intrínseco (IMF)
   * @param signal Señal a descomponer
   * @returns Objeto con IMFs y residuo
   */
  public decompose(signal: number[]): { imfs: number[][], residue: number[] } {
    if (!signal || signal.length < 3) {
      return { imfs: [], residue: [...signal] };
    }

    const imfs: number[][] = [];
    let residue = [...signal];

    console.log("Iniciando descomposición EMD para señal de longitud:", signal.length);

    // Extraer IMFs hasta que residuo sea monótono o alcancemos max IMFs
    while (imfs.length < this.options.maxImf && !this.isMonotonic(residue)) {
      const imf = this.extractIMF(residue);
      imfs.push(imf);
      
      // Actualizar residuo restando el IMF
      residue = residue.map((value, i) => value - imf[i]);
      
      console.log(`IMF ${imfs.length} extraído, energía:`, this.getEnergy(imf));
    }

    return { imfs, residue };
  }

  /**
   * Extrae una función de modo intrínseco de la señal dada
   * @param signal Señal de entrada
   * @returns IMF extraído
   */
  private extractIMF(signal: number[]): number[] {
    let h = [...signal];
    let iteration = 0;
    
    while (iteration < this.options.maxIterations) {
      const extrema = this.findExtrema(h);
      
      // Si no hay suficientes extremos, no podemos continuar
      if (extrema.maxima.indices.length < 2 || extrema.minima.indices.length < 2) {
        break;
      }
      
      // Interpolar máximos y mínimos para crear envolventes
      const upperEnvelope = this.interpolate(extrema.maxima.indices, extrema.maxima.values, h.length);
      const lowerEnvelope = this.interpolate(extrema.minima.indices, extrema.minima.values, h.length);
      
      // Calcular media de envolventes
      const mean = upperEnvelope.map((val, i) => (val + lowerEnvelope[i]) / 2);
      
      // Actualizar h restando la media
      const newH = h.map((val, i) => val - mean[i]);
      
      // Calcular criterio de parada
      const sd = this.calculateSD(h, newH);
      
      h = newH;
      
      // Si el SD es menor que el umbral, consideramos h como IMF
      if (sd < this.options.threshold) {
        break;
      }
      
      iteration++;
    }
    
    return h;
  }

  /**
   * Calcula desviación estándar entre dos señales
   */
  private calculateSD(original: number[], new_signal: number[]): number {
    let sum = 0;
    for (let i = 0; i < original.length; i++) {
      const diff = (original[i] - new_signal[i]) / Math.max(0.0001, Math.abs(original[i]));
      sum += diff * diff;
    }
    return Math.sqrt(sum / original.length);
  }

  /**
   * Interpola puntos utilizando spline cúbico simplificado
   */
  private interpolate(indices: number[], values: number[], length: number): number[] {
    // Versión simplificada usando interpolación lineal
    const result = new Array(length).fill(0);
    
    if (indices.length === 0) return result;
    
    // Asegurar que cubrimos todo el rango
    if (indices[0] > 0) {
      indices.unshift(0);
      values.unshift(values[0]);
    }
    
    if (indices[indices.length - 1] < length - 1) {
      indices.push(length - 1);
      values.push(values[values.length - 1]);
    }
    
    // Interpolación lineal
    for (let i = 0; i < indices.length - 1; i++) {
      const startIdx = indices[i];
      const endIdx = indices[i + 1];
      const startVal = values[i];
      const endVal = values[i + 1];
      
      for (let j = startIdx; j <= endIdx; j++) {
        const t = (j - startIdx) / (endIdx - startIdx);
        result[j] = startVal + t * (endVal - startVal);
      }
    }
    
    return result;
  }

  /**
   * Encuentra máximos y mínimos locales en la señal
   */
  public findExtrema(signal: number[]): {
    maxima: { indices: number[], values: number[] };
    minima: { indices: number[], values: number[] };
  } {
    const maxIndices: number[] = [];
    const maxValues: number[] = [];
    const minIndices: number[] = [];
    const minValues: number[] = [];
    
    // Primer y último punto son casos especiales
    // Los tratamos como extremos si son mayores/menores que su único vecino
    if (signal.length > 1) {
      if (signal[0] > signal[1]) {
        maxIndices.push(0);
        maxValues.push(signal[0]);
      } else if (signal[0] < signal[1]) {
        minIndices.push(0);
        minValues.push(signal[0]);
      }
      
      // Puntos intermedios
      for (let i = 1; i < signal.length - 1; i++) {
        if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
          maxIndices.push(i);
          maxValues.push(signal[i]);
        } else if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
          minIndices.push(i);
          minValues.push(signal[i]);
        }
      }
      
      // Último punto
      const last = signal.length - 1;
      if (signal[last] > signal[last-1]) {
        maxIndices.push(last);
        maxValues.push(signal[last]);
      } else if (signal[last] < signal[last-1]) {
        minIndices.push(last);
        minValues.push(signal[last]);
      }
    }
    
    return {
      maxima: { indices: maxIndices, values: maxValues },
      minima: { indices: minIndices, values: minValues }
    };
  }

  /**
   * Determina si una señal es monótona (siempre creciente o decreciente)
   */
  public isMonotonic(signal: number[]): boolean {
    if (signal.length <= 2) return true;
    
    let increasing = 0;
    let decreasing = 0;
    
    for (let i = 1; i < signal.length; i++) {
      if (signal[i] > signal[i-1]) {
        increasing++;
      } else if (signal[i] < signal[i-1]) {
        decreasing++;
      }
    }
    
    // Si más del 90% de los puntos siguen la misma tendencia, consideramos monótona
    const total = increasing + decreasing;
    return (increasing / total > 0.9 || decreasing / total > 0.9);
  }

  /**
   * Calcula la frecuencia instantánea de un IMF
   */
  public getInstantaneousFrequency(imf: number[]): number[] {
    if (imf.length < 3) return new Array(imf.length).fill(0);
    
    // Implementación básica usando cruces por cero
    const frequencies: number[] = new Array(imf.length).fill(0);
    const crossings: number[] = [];
    
    for (let i = 1; i < imf.length; i++) {
      if ((imf[i] >= 0 && imf[i-1] < 0) || (imf[i] <= 0 && imf[i-1] > 0)) {
        crossings.push(i);
      }
    }
    
    // Calcular periodos basados en distancias entre cruces por cero
    if (crossings.length >= 2) {
      const avgPeriod = (crossings[crossings.length-1] - crossings[0]) / (crossings.length - 1);
      // Frecuencia = 1/periodo normalizado por 2 (medio ciclo en cruces por cero)
      const frequency = 1 / (avgPeriod * 2);
      
      // Asignar la misma frecuencia a todos los puntos (simplificación)
      frequencies.fill(frequency);
    }
    
    return frequencies;
  }

  /**
   * Reconstruye una señal a partir de IMFs seleccionados
   */
  public reconstruct(imfs: number[][], selectedIndices: number[]): number[] {
    if (!imfs.length || !imfs[0].length) return [];
    
    // Inicializar señal reconstruida con ceros
    const result = new Array(imfs[0].length).fill(0);
    
    // Sumar los IMFs seleccionados
    for (const index of selectedIndices) {
      if (index >= 0 && index < imfs.length) {
        for (let i = 0; i < result.length; i++) {
          result[i] += imfs[index][i];
        }
      }
    }
    
    return result;
  }

  /**
   * Calcula la energía de un IMF
   */
  public getEnergy(imf: number[]): number {
    return imf.reduce((sum, val) => sum + val * val, 0) / imf.length;
  }
} 