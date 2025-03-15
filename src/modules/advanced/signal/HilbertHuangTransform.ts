
/**
 * Implementación de la Transformada Hilbert-Huang para análisis
 * de señales no lineales y no estacionarias como el PPG.
 * 
 * NOTA IMPORTANTE: Este módulo implementa técnicas avanzadas manteniendo
 * compatibilidad con las interfaces principales en index.tsx y PPGSignalMeter.tsx.
 */

/**
 * Función de modo intrínseco (IMF) resultado de la descomposición
 */
export interface IMF {
  values: number[];
  frequency: number;
  amplitude: number;
  phase: number[];
}

export class HilbertHuangTransform {
  // Configuración
  private readonly MAX_IMF = 3;        // Número máximo de IMFs a extraer
  private readonly MAX_ITERATIONS = 5;  // Máximo de iteraciones para extracción de IMF
  private readonly SIFTING_THRESHOLD = 0.05; // Umbral para detener proceso de sifting
  
  // Estado
  private enabled: boolean = true;
  private lastImfs: IMF[] = [];
  
  constructor() {
    console.log('Transformada Hilbert-Huang inicializada');
  }
  
  /**
   * Analiza una señal PPG utilizando la transformada Hilbert-Huang
   * para extraer componentes no lineales y no estacionarios
   */
  public analyze(values: number[]): {
    imfs: IMF[],
    instantaneousFrequency: number[],
    dominantFrequency: number
  } | null {
    // Si está desactivado o no hay suficientes datos, no procesar
    if (!this.enabled || values.length < 30) {
      return null;
    }
    
    // Normalizar señal
    const normalizedValues = this.normalizeSignal(values);
    
    // Aplicar descomposición en modos empíricos (EMD)
    const imfs = this.performEMD(normalizedValues);
    this.lastImfs = imfs;
    
    // Aplicar transformada de Hilbert a cada IMF
    const hilbertResults = imfs.map(imf => this.applyHilbert(imf.values));
    
    // Calcular frecuencia instantánea para el primer IMF (más relevante)
    const instantaneousFrequency = this.calculateInstantaneousFrequency(
      hilbertResults[0]?.phase || []
    );
    
    // Estimar frecuencia dominante
    const dominantFrequency = this.estimateDominantFrequency(instantaneousFrequency);
    
    return {
      imfs,
      instantaneousFrequency,
      dominantFrequency
    };
  }
  
  /**
   * Normaliza la señal para el procesamiento
   */
  private normalizeSignal(values: number[]): number[] {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const centered = values.map(v => v - mean);
    
    const maxAbs = Math.max(...centered.map(Math.abs));
    return centered.map(v => v / (maxAbs || 1));
  }
  
  /**
   * Implementa la Descomposición en Modos Empíricos (EMD)
   * para extraer funciones de modo intrínseco (IMFs)
   */
  private performEMD(values: number[]): IMF[] {
    const imfs: IMF[] = [];
    let residual = [...values];
    
    // Extraer IMFs iterativamente
    for (let i = 0; i < this.MAX_IMF && residual.length > 3; i++) {
      // Proceso de sifting para extraer IMF
      const imf = this.extractIMF(residual);
      
      // Si no se pudo extraer un IMF válido, terminar
      if (!imf) break;
      
      // Almacenar IMF
      imfs.push(imf);
      
      // Actualizar residual
      residual = residual.map((v, idx) => v - imf.values[idx]);
      
      // Si el residual es monótono, terminar
      if (this.isMonotonic(residual)) break;
    }
    
    return imfs;
  }
  
  /**
   * Extrae una función de modo intrínseco (IMF) mediante el proceso de sifting
   */
  private extractIMF(signal: number[]): IMF | null {
    let currentSignal = [...signal];
    let previousMean = Infinity;
    
    // Proceso iterativo de sifting
    for (let iter = 0; iter < this.MAX_ITERATIONS; iter++) {
      // Encontrar extremos
      const { maxIndices, minIndices } = this.findExtrema(currentSignal);
      
      // Si no hay suficientes extremos, no es posible extraer IMF
      if (maxIndices.length < 2 || minIndices.length < 2) {
        return null;
      }
      
      // Interpolar envoltorias superior e inferior
      const upperEnvelope = this.interpolate(maxIndices, currentSignal);
      const lowerEnvelope = this.interpolate(minIndices, currentSignal);
      
      // Calcular media de envoltorias
      const mean = upperEnvelope.map((u, i) => (u + lowerEnvelope[i]) / 2);
      
      // Calcular desviación media
      const meanDeviation = mean.reduce((sum, m) => sum + Math.abs(m), 0) / mean.length;
      
      // Criterio de parada: mean deviation no cambia significativamente
      if (Math.abs(meanDeviation - previousMean) / previousMean < this.SIFTING_THRESHOLD) {
        break;
      }
      
      previousMean = meanDeviation;
      
      // Actualizar señal restando la media
      currentSignal = currentSignal.map((v, i) => v - mean[i]);
    }
    
    // Calcular características del IMF
    const amplitude = this.calculateAmplitude(currentSignal);
    const frequency = this.estimateFrequency(currentSignal);
    const phase = this.calculatePhase(currentSignal);
    
    return {
      values: currentSignal,
      amplitude,
      frequency,
      phase
    };
  }
  
  /**
   * Encuentra los índices de máximos y mínimos locales en la señal
   */
  private findExtrema(signal: number[]): { maxIndices: number[], minIndices: number[] } {
    const maxIndices: number[] = [];
    const minIndices: number[] = [];
    
    // Agregar puntos extremos para mejor interpolación
    minIndices.push(0);
    maxIndices.push(0);
    
    // Buscar extremos
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        maxIndices.push(i);
      } else if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
        minIndices.push(i);
      }
    }
    
    // Agregar puntos extremos para mejor interpolación
    minIndices.push(signal.length - 1);
    maxIndices.push(signal.length - 1);
    
    return { maxIndices, minIndices };
  }
  
  /**
   * Interpolación cúbica simplificada para envoltorias
   */
  private interpolate(indices: number[], signal: number[]): number[] {
    if (indices.length < 2) return Array(signal.length).fill(0);
    
    const result = Array(signal.length).fill(0);
    
    // Rellenar valores en índices conocidos
    indices.forEach(idx => {
      result[idx] = signal[idx];
    });
    
    // Interpolación lineal simplificada
    let currentIndex = 0;
    for (let i = 0; i < signal.length; i++) {
      if (i > indices[currentIndex + 1]) {
        currentIndex++;
      }
      
      if (currentIndex >= indices.length - 1) break;
      
      const x1 = indices[currentIndex];
      const x2 = indices[currentIndex + 1];
      const y1 = signal[x1];
      const y2 = signal[x2];
      
      if (i > x1 && i < x2) {
        // Interpolación lineal
        result[i] = y1 + (y2 - y1) * (i - x1) / (x2 - x1);
      }
    }
    
    return result;
  }
  
  /**
   * Verifica si una señal es monotónica (sin oscilaciones)
   */
  private isMonotonic(signal: number[]): boolean {
    let increasing = 0;
    let decreasing = 0;
    
    for (let i = 1; i < signal.length; i++) {
      if (signal[i] > signal[i-1]) {
        increasing++;
      } else if (signal[i] < signal[i-1]) {
        decreasing++;
      }
    }
    
    // Es monotónica si más del 90% de los cambios van en la misma dirección
    const total = increasing + decreasing;
    return total > 0 && (increasing / total > 0.9 || decreasing / total > 0.9);
  }
  
  /**
   * Aplica la transformada de Hilbert (simplificada) para obtener señal analítica
   */
  private applyHilbert(signal: number[]): { amplitude: number[], phase: number[] } {
    // Implementación simplificada de transformada de Hilbert
    // En una implementación completa se usaría FFT
    const hilbertSignal = this.simplifiedHilbert(signal);
    
    const amplitude: number[] = [];
    const phase: number[] = [];
    
    // Calcular amplitud y fase instantáneas
    for (let i = 0; i < signal.length; i++) {
      // Señal analítica = señal original + i * transformada Hilbert
      const real = signal[i];
      const imag = hilbertSignal[i];
      
      // Amplitud instantánea
      amplitude.push(Math.sqrt(real * real + imag * imag));
      
      // Fase instantánea
      phase.push(Math.atan2(imag, real));
    }
    
    return { amplitude, phase };
  }
  
  /**
   * Implementación simplificada de la transformada de Hilbert
   */
  private simplifiedHilbert(signal: number[]): number[] {
    // Una implementación real usaría FFT y desplazamiento de fase
    // Esta es una aproximación para dispositivos limitados
    const result = Array(signal.length).fill(0);
    
    // Kernel de Hilbert simplificado
    for (let i = 0; i < signal.length; i++) {
      for (let j = 0; j < signal.length; j++) {
        if (i !== j) {
          // Kernel de Hilbert: 1/(π(t-τ))
          result[i] += signal[j] / (Math.PI * (i - j));
        }
      }
    }
    
    return result;
  }
  
  /**
   * Calcula la frecuencia instantánea a partir de la fase
   */
  private calculateInstantaneousFrequency(phase: number[]): number[] {
    if (phase.length < 2) return [];
    
    const frequency: number[] = [];
    const samplingRate = 30; // Aproximado para PPG
    
    // Calcular derivada de la fase
    for (let i = 1; i < phase.length; i++) {
      let phaseDiff = phase[i] - phase[i-1];
      
      // Ajustar saltos de fase
      if (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
      if (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
      
      // Frecuencia = derivada de fase / (2π)
      frequency.push(phaseDiff * samplingRate / (2 * Math.PI));
    }
    
    return frequency;
  }
  
  /**
   * Estima la frecuencia dominante en un IMF
   */
  private estimateFrequency(signal: number[]): number {
    // Contar cruces por cero
    let zeroCrossings = 0;
    for (let i = 1; i < signal.length; i++) {
      if (signal[i] * signal[i-1] < 0) {
        zeroCrossings++;
      }
    }
    
    // Estimar frecuencia basada en cruces por cero
    const samplingRate = 30; // Aproximado para PPG
    return zeroCrossings * samplingRate / (2 * signal.length);
  }
  
  /**
   * Calcula la amplitud media de un IMF
   */
  private calculateAmplitude(signal: number[]): number {
    const absValues = signal.map(Math.abs);
    return absValues.reduce((sum, v) => sum + v, 0) / signal.length;
  }
  
  /**
   * Calcula la fase instantánea utilizando la señal analítica
   */
  private calculatePhase(signal: number[]): number[] {
    // Transformada de Hilbert simplificada
    const hilbertSignal = this.simplifiedHilbert(signal);
    
    // Calcular fase instantánea
    return signal.map((value, i) => 
      Math.atan2(hilbertSignal[i], value)
    );
  }
  
  /**
   * Estima la frecuencia dominante a partir de frecuencias instantáneas
   */
  private estimateDominantFrequency(instantFreq: number[]): number {
    if (instantFreq.length === 0) return 0;
    
    // Filtrar valores extremos
    const validFreq = instantFreq.filter(f => f >= 0.5 && f <= 3.0);
    
    if (validFreq.length === 0) return 0;
    
    // Calcular media de frecuencias válidas
    return validFreq.reduce((sum, f) => sum + f, 0) / validFreq.length;
  }
  
  /**
   * Activa o desactiva el procesamiento
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Reinicia el estado del procesador
   */
  public reset(): void {
    this.lastImfs = [];
  }
}
