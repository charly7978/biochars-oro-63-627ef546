
/**
 * Kalman filter implementation for smoothing signals
 * Extracted from SignalProcessor for better maintainability
 */
export class KalmanFilter {
  private R: number = 0.01;  // Measurement noise
  private Q: number = 0.1;   // Process noise
  private P: number = 1;     // Error estimation
  private X: number = 0;     // Estimated value
  private K: number = 0;     // Kalman gain

  /**
   * Filter a measurement value
   */
  filter(measurement: number): number {
    // Prediction
    this.P = this.P + this.Q;
    
    // Update
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }

  /**
   * Reset filter state
   */
  reset(): void {
    this.X = 0;
    this.P = 1;
  }
}
