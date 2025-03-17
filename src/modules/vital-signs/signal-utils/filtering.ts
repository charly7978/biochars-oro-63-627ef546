
/**
 * Basic signal filtering utilities
 * Provides common filtering operations for signal processing
 */

import { SIGNAL_CONSTANTS } from './constants';

/**
 * Applies a simple moving average filter (SMA)
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number = SIGNAL_CONSTANTS.SMA_WINDOW): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  const updatedBuffer = [...buffer, value];
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  const filteredValue = updatedBuffer.reduce((a, b) => a + b, 0) / updatedBuffer.length;
  return { filteredValue, updatedBuffer };
}

/**
 * Normalize an array of values to the range [0,1]
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < SIGNAL_CONSTANTS.MIN_AMPLITUDE) return values.map(() => 0);
  return values.map(v => (v - min) / (max - min));
}

/**
 * Clase auxiliar para filtrado Kalman
 */
export class KalmanFilter {
  private R: number = 0.01;
  private Q: number = 0.1;
  private P: number = 1;
  private X: number = 0;
  private K: number = 0;

  /**
   * Aplica el filtro Kalman a una medición
   */
  filter(measurement: number): number {
    this.P = this.P + this.Q;
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    return this.X;
  }

  /**
   * Reinicia el filtro
   */
  reset(): void {
    this.X = 0;
    this.P = 1;
  }
}
