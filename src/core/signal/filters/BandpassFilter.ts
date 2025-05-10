/**
 * Implementación de un filtro Pasa-Banda Butterworth (aproximado con IIR Biquad).
 * Diseñado para aislar frecuencias relevantes en señales PPG (ej. 0.5Hz - 4Hz).
 */
export class BandpassFilter {
  private b0a: number;
  private b1a: number;
  private b2a: number;
  private a1a: number;
  private a2a: number;

  private b0b: number;
  private b1b: number;
  private b2b: number;
  private a1b: number;
  private a2b: number;

  // Estado del filtro (retrasos)
  private x1a: number = 0;
  private x2a: number = 0;
  private y1a: number = 0;
  private y2a: number = 0;

  private x1b: number = 0;
  private x2b: number = 0;
  private y1b: number = 0;
  private y2b: number = 0;

  /**
   * @param lowCutoff Frecuencia de corte baja (Hz)
   * @param highCutoff Frecuencia de corte alta (Hz)
   * @param sampleRate Frecuencia de muestreo (Hz)
   * @param order Orden del filtro (2 para Butterworth de 2º orden)
   */
  constructor(lowCutoff: number = 0.5, highCutoff: number = 4, sampleRate: number = 30, order: number = 2) {
    // --- Coeficientes para el filtro Pasa-Altas (elimina bajas frecuencias) ---
    const omegaLow = 2 * Math.PI * lowCutoff / sampleRate;
    const alphaLow = Math.sin(omegaLow) / (2 * 0.707); // Q = 0.707 para Butterworth
    const cosOmegaLow = Math.cos(omegaLow);

    const a0Low = 1 + alphaLow;
    this.b0a = (1 + cosOmegaLow) / 2 / a0Low;
    this.b1a = -(1 + cosOmegaLow) / a0Low;
    this.b2a = (1 + cosOmegaLow) / 2 / a0Low;
    this.a1a = -2 * cosOmegaLow / a0Low;
    this.a2a = (1 - alphaLow) / a0Low;

    // --- Coeficientes para el filtro Pasa-Bajas (elimina altas frecuencias) ---
    const omegaHigh = 2 * Math.PI * highCutoff / sampleRate;
    const alphaHigh = Math.sin(omegaHigh) / (2 * 0.707); // Q = 0.707 para Butterworth
    const cosOmegaHigh = Math.cos(omegaHigh);

    const a0High = 1 + alphaHigh;
    this.b0b = (1 - cosOmegaHigh) / 2 / a0High;
    this.b1b = (1 - cosOmegaHigh) / a0High;
    this.b2b = (1 - cosOmegaHigh) / 2 / a0High;
    this.a1b = -2 * cosOmegaHigh / a0High;
    this.a2b = (1 - alphaHigh) / a0High;
  }

  /**
   * Aplica el filtro pasa-banda a una muestra de señal.
   * @param x La muestra de entrada.
   * @returns La muestra filtrada.
   */
  public filter(x: number): number {
    // Aplicar filtro Pasa-Altas
    let y_hpf = this.b0a * x + this.b1a * this.x1a + this.b2a * this.x2a - this.a1a * this.y1a - this.a2a * this.y2a;

    // Actualizar estado del filtro Pasa-Altas
    this.x2a = this.x1a;
    this.x1a = x;
    this.y2a = this.y1a;
    this.y1a = y_hpf;

    // Aplicar filtro Pasa-Bajas al resultado del Pasa-Altas
    let y_bpf = this.b0b * y_hpf + this.b1b * this.x1b + this.b2b * this.x2b - this.a1b * this.y1b - this.a2b * this.y2b;

    // Actualizar estado del filtro Pasa-Bajas
    this.x2b = this.x1b;
    this.x1b = y_hpf; // La entrada al LPF es la salida del HPF
    this.y2b = this.y1b;
    this.y1b = y_bpf;

    return y_bpf;
  }

  /**
   * Reinicia el estado interno del filtro.
   */
  public reset(): void {
    this.x1a = 0;
    this.x2a = 0;
    this.y1a = 0;
    this.y2a = 0;
    this.x1b = 0;
    this.x2b = 0;
    this.y1b = 0;
    this.y2b = 0;
  }
} 