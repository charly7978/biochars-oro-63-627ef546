
/**
 * No-op filter that passes through raw signal data without mathematical manipulations
 */
export class KalmanFilter {
  /**
   * Returns the raw measurement without filtering
   * @param measurement Raw value from sensor
   * @returns The same raw value, unmodified
   */
  public filter(measurement: number): number {
    return measurement; // Direct passthrough without Math functions
  }

  /**
   * No-op reset function
   */
  public reset(): void {
    // No state to reset since we're not storing anything
  }
  
  /**
   * No-op parameters setter
   */
  public setParameters(processNoise: number, measurementNoise: number): void {
    // No parameters to set since we're not using any
  }
}
