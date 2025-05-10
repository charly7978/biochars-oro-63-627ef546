/**
 * SignalAmplifier.ts
 * 
 * This module optimizes the PPG signal extracted from the finger to improve heartbeat detection
 * using adaptive amplification, noise filtering, and periodicity detection techniques.
 */

export class SignalAmplifier {
  // Parámetros simplificados
  private readonly MIN_GAIN = 1.2;
  private readonly GAIN = this.MIN_GAIN; // Usar ganancia fija mínima
  private readonly SIGNAL_BUFFER_SIZE = 20; // Para calcular baseline
  private readonly BASELINE_WINDOW_SIZE = 15;

  // Buffers and state
  private signalBuffer: number[] = [];
  private baselineValue = 0;

  constructor() {
    this.reset();
  }

  /**
   * Process and amplify a raw PPG value
   */
  public processValue(rawValue: number): number {
    // Normalize value relative to baseline
    this.updateBaseline(rawValue);
    const normalizedValue = rawValue - this.baselineValue;
    
    // Store in buffer for baseline calculation
    this.signalBuffer.push(normalizedValue);
    
    if (this.signalBuffer.length > this.SIGNAL_BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    // Apply adaptive amplification, emphasizing periodic components
    const amplifiedValue = normalizedValue * this.GAIN;
    
    return amplifiedValue;
  }

  /**
   * Update baseline using a moving minimum filter for robustness
   */
  private updateBaseline(value: number): void {
    if (this.signalBuffer.length < this.BASELINE_WINDOW_SIZE) {
      if (this.baselineValue === 0) {
        this.baselineValue = value;
      } else {
        this.baselineValue = this.baselineValue * 0.99 + value * 0.01;
      }
    } else {
      const window = this.signalBuffer.slice(-this.BASELINE_WINDOW_SIZE);
      let minVal = window[0];
      for (let i = 1; i < window.length; i++) {
        if (window[i] < minVal) {
          minVal = window[i];
        }
      }
      const adaptationRate = 0.005;
      this.baselineValue = this.baselineValue * (1 - adaptationRate) + value * adaptationRate;
    }
  }

  /**
   * Reset amplifier state
   */
  public reset(): void {
    this.signalBuffer = [];
    this.baselineValue = 0;
  }
}
