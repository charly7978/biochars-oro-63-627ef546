
/**
 * Direct signal pass-through without any manipulation
 */
export class KalmanFilter {
  public filter(measurement: number): number {
    return measurement;
  }

  public reset(): void {}
  
  public setParameters(_processNoise: number, _measurementNoise: number): void {}
}
