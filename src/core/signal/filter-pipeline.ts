
/**
 * Signal processing filter pipeline
 * Implements various filters for PPG signal processing
 */

export interface FilterSettings {
  useLowPass: boolean;
  useHighPass: boolean;
  lowPassCutoff: number;
  highPassCutoff: number;
}

export class FilterPipeline {
  private settings: FilterSettings;
  
  // Filter state variables
  private readonly bufferSize = 30;
  private inputBuffer: number[] = [];
  private outputBuffer: number[] = [];
  private lowPassState: number = 0;
  private highPassState: number = 0;
  
  // Moving average filter state
  private maState: number[] = [];
  private readonly maLength = 5;
  
  // Kalman filter state
  private kalmanX: number = 0;
  private kalmanP: number = 1;
  private readonly kalmanQ: number = 0.01;
  private readonly kalmanR: number = 0.1;
  
  constructor(settings: FilterSettings) {
    this.settings = settings;
  }
  
  /**
   * Update filter configuration
   */
  public updateConfig(settings: FilterSettings): void {
    this.settings = settings;
  }
  
  /**
   * Process a signal value through the filter pipeline
   */
  public process(value: number): number {
    // Add to input buffer
    this.inputBuffer.push(value);
    if (this.inputBuffer.length > this.bufferSize) {
      this.inputBuffer.shift();
    }
    
    // Apply filters in sequence
    let filtered = value;
    
    // Apply moving average filter for initial smoothing
    filtered = this.applyMovingAverage(filtered);
    
    // Apply low-pass filter if enabled
    if (this.settings.useLowPass) {
      filtered = this.applyLowPassFilter(filtered);
    }
    
    // Apply high-pass filter if enabled
    if (this.settings.useHighPass) {
      filtered = this.applyHighPassFilter(filtered);
    }
    
    // Apply Kalman filter for final smoothing
    filtered = this.applyKalmanFilter(filtered);
    
    // Add to output buffer
    this.outputBuffer.push(filtered);
    if (this.outputBuffer.length > this.bufferSize) {
      this.outputBuffer.shift();
    }
    
    return filtered;
  }
  
  /**
   * Apply moving average filter
   */
  private applyMovingAverage(value: number): number {
    this.maState.push(value);
    if (this.maState.length > this.maLength) {
      this.maState.shift();
    }
    
    const sum = this.maState.reduce((a, b) => a + b, 0);
    return sum / this.maState.length;
  }
  
  /**
   * Apply low-pass filter
   * Simple single-pole IIR filter
   */
  private applyLowPassFilter(value: number): number {
    const alpha = this.calculateAlpha(this.settings.lowPassCutoff);
    this.lowPassState = this.lowPassState + alpha * (value - this.lowPassState);
    return this.lowPassState;
  }
  
  /**
   * Apply high-pass filter
   * Simple single-pole IIR filter
   */
  private applyHighPassFilter(value: number): number {
    const alpha = this.calculateAlpha(this.settings.highPassCutoff);
    this.highPassState = alpha * (this.highPassState + value - this.inputBuffer[this.inputBuffer.length - 1]);
    return this.highPassState;
  }
  
  /**
   * Apply Kalman filter
   */
  private applyKalmanFilter(value: number): number {
    // Prediction
    this.kalmanP = this.kalmanP + this.kalmanQ;
    
    // Update
    const K = this.kalmanP / (this.kalmanP + this.kalmanR);
    this.kalmanX = this.kalmanX + K * (value - this.kalmanX);
    this.kalmanP = (1 - K) * this.kalmanP;
    
    return this.kalmanX;
  }
  
  /**
   * Calculate alpha coefficient for IIR filters
   */
  private calculateAlpha(cutoffFrequency: number): number {
    const dt = 1 / 30; // Assuming 30Hz sample rate
    const RC = 1 / (2 * Math.PI * cutoffFrequency);
    return dt / (RC + dt);
  }
  
  /**
   * Reset all filter states
   */
  public reset(): void {
    this.inputBuffer = [];
    this.outputBuffer = [];
    this.lowPassState = 0;
    this.highPassState = 0;
    this.maState = [];
    this.kalmanX = 0;
    this.kalmanP = 1;
  }
  
  /**
   * Get filtered output buffer
   */
  public getOutputBuffer(): number[] {
    return [...this.outputBuffer];
  }
}
