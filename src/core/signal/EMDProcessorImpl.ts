import { EMDOptions } from '../../types/signal';

/**
 * Implementación de Empirical Mode Decomposition (EMD) para procesamiento de señales PPG
 * Esta clase implementa el algoritmo EMD para descomponer señales en componentes oscilatorios
 * (Intrinsic Mode Functions - IMFs) y un residuo
 */
export class EMDProcessorImpl {
  private maxIterations: number;
  private threshold: number;
  private maxImf: number;

  constructor(options?: EMDOptions) {
    this.maxIterations = options?.maxIterations || 10;
    this.threshold = options?.threshold || 0.05;
    this.maxImf = options?.maxImf || 5;
  }

  /**
   * Descompone una señal utilizando EMD
   * @param signal - Array de números que representan la señal a descomponer
   * @returns Un objeto con los IMFs y el residuo
   */
  public decompose(signal: number[]): { imfs: number[][], residue: number[] } {
    if (signal.length < 4) {
      return { imfs: [], residue: [...signal] };
    }

    let residue = [...signal];
    const imfs: number[][] = [];

    for (let i = 0; i < this.maxImf; i++) {
      // Si el residuo tiene poco contenido o es monótono, terminamos
      if (this.isMonotonic(residue) || this.getAmplitude(residue) < this.threshold) {
        break;
      }

      // Extraer un IMF
      const imf = this.extractIMF(residue);
      imfs.push(imf);

      // Actualizar el residuo
      residue = residue.map((val, idx) => val - imf[idx]);
    }

    return { imfs, residue };
  }

  /**
   * Extrae un IMF de la señal
   */
  private extractIMF(signal: number[]): number[] {
    let h = [...signal];
    let iteration = 0;

    while (iteration < this.maxIterations) {
      // Identificar extremos
      const { maxima, minima } = this.findExtrema(h);
      
      if (maxima.length <= 2 || minima.length <= 2) {
        // No hay suficientes extremos para continuar
        break;
      }

      // Interpolar envoltorios
      const upperEnvelope = this.interpolate(maxima, h.length);
      const lowerEnvelope = this.interpolate(minima, h.length);

      // Calcular media
      const mean = upperEnvelope.map((val, idx) => (val + lowerEnvelope[idx]) / 2);

      // Restar la media para obtener el próximo h
      const prevH = [...h];
      h = h.map((val, idx) => val - mean[idx]);

      // Calcular la desviación normalizada
      const sd = this.calculateSD(prevH, h);
      if (sd < this.threshold) {
        // Convergió, esto es un IMF
        break;
      }

      iteration++;
    }

    return h;
  }

  /**
   * Encuentra los máximos y mínimos locales de una señal
   */
  private findExtrema(signal: number[]): { maxima: [number, number][], minima: [number, number][] } {
    const maxima: [number, number][] = [];
    const minima: [number, number][] = [];

    // Agregar extremos en los bordes
    maxima.push([0, signal[0]]);
    minima.push([0, signal[0]]);

    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
        maxima.push([i, signal[i]]);
      }
      if (signal[i] < signal[i - 1] && signal[i] < signal[i + 1]) {
        minima.push([i, signal[i]]);
      }
    }

    // Agregar extremos en los bordes
    maxima.push([signal.length - 1, signal[signal.length - 1]]);
    minima.push([signal.length - 1, signal[signal.length - 1]]);

    return { maxima, minima };
  }

  /**
   * Interpolación lineal simple para crear envolturas
   */
  private interpolate(points: [number, number][], length: number): number[] {
    const result = new Array(length).fill(0);

    if (points.length < 2) {
      return result;
    }

    // Asegurarse de que los puntos estén ordenados por índice
    points.sort((a, b) => a[0] - b[0]);

    for (let i = 0; i < length; i++) {
      // Encontrar los puntos de interpolación
      let leftPoint: [number, number] = [0, 0];
      let rightPoint: [number, number] = [0, 0];

      for (let j = 0; j < points.length - 1; j++) {
        if (i >= points[j][0] && i <= points[j + 1][0]) {
          leftPoint = points[j];
          rightPoint = points[j + 1];
          break;
        }
      }

      // Interpolación lineal
      const dx = rightPoint[0] - leftPoint[0];
      if (dx === 0) {
        result[i] = leftPoint[1];
      } else {
        const dy = rightPoint[1] - leftPoint[1];
        const ratio = (i - leftPoint[0]) / dx;
        result[i] = leftPoint[1] + ratio * dy;
      }
    }

    return result;
  }

  /**
   * Calcula la desviación normalizada entre dos señales
   */
  private calculateSD(signal1: number[], signal2: number[]): number {
    let sumSquaredDiff = 0;
    let sumSquaredSignal = 0;

    for (let i = 0; i < signal1.length; i++) {
      const diff = signal1[i] - signal2[i];
      sumSquaredDiff += diff * diff;
      sumSquaredSignal += signal1[i] * signal1[i];
    }

    if (sumSquaredSignal === 0) {
      return 0;
    }

    return Math.sqrt(sumSquaredDiff / sumSquaredSignal);
  }

  /**
   * Verifica si una señal es monótona (sólo aumenta o sólo disminuye)
   */
  private isMonotonic(signal: number[]): boolean {
    if (signal.length <= 2) {
      return true;
    }

    let increasing = true;
    let decreasing = true;

    for (let i = 1; i < signal.length; i++) {
      if (signal[i] < signal[i - 1]) {
        increasing = false;
      }
      if (signal[i] > signal[i - 1]) {
        decreasing = false;
      }
    }

    return increasing || decreasing;
  }

  /**
   * Obtiene la amplitud (diferencia entre máximo y mínimo) de una señal
   */
  private getAmplitude(signal: number[]): number {
    if (signal.length === 0) {
      return 0;
    }

    let min = signal[0];
    let max = signal[0];

    for (let i = 1; i < signal.length; i++) {
      if (signal[i] < min) {
        min = signal[i];
      }
      if (signal[i] > max) {
        max = signal[i];
      }
    }

    return max - min;
  }
} 