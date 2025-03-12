
export class SignalProcessor {
  // Buffer and signal parameters
  private readonly MAX_BUFFER_SIZE: number;
  private readonly DERIVATIVE_BUFFER_SIZE: number;
  private readonly EMA_ALPHA: number;
  
  // State
  private signalBuffer: number[] = [];
  private derivativeBuffer: number[] = []; 
  private lastProcessedValue = 0;
  private valueDerivative = 0;
  
  // New: Enhanced stability tracking
  private readonly STABILITY_BUFFER_SIZE = 30;
  private stabilityBuffer: number[] = [];
  private baselineValue: number | null = null;
  private readonly BASELINE_ALPHA = 0.05;
  
  constructor(maxBufferSize = 300, derivativeBufferSize = 15, emaAlpha = 0.2) { // Even smoother signal processing
    this.MAX_BUFFER_SIZE = maxBufferSize;
    this.DERIVATIVE_BUFFER_SIZE = derivativeBufferSize;
    this.EMA_ALPHA = emaAlpha;
  }
  
  public processSignal(value: number): {
    smoothedValue: number;
    derivative: number;
    signalBuffer: number[];
  } {
    // Initialize baseline tracking for improved stability
    if (this.baselineValue === null) {
      this.baselineValue = value;
    } else {
      this.baselineValue = this.baselineValue * (1 - this.BASELINE_ALPHA) + value * this.BASELINE_ALPHA;
    }
    
    // Add signal to buffer with more aggressive smoothing to reduce noise
    let smoothedValue: number;
    
    if (this.signalBuffer.length === 0) {
      smoothedValue = value;
      this.signalBuffer.push(value);
    } else {
      // Multi-stage smoothing for better noise reduction
      const preSmoothed = this.lastProcessedValue + 
        this.EMA_ALPHA * (value - this.lastProcessedValue);
      
      // Second stage smoothing using stability buffer
      this.stabilityBuffer.push(preSmoothed);
      if (this.stabilityBuffer.length > this.STABILITY_BUFFER_SIZE) {
        this.stabilityBuffer.shift();
      }
      
      // Apply centered moving average for better peak preservation
      if (this.stabilityBuffer.length >= 5) {
        const recentValues = this.stabilityBuffer.slice(-5);
        // Weighted average with central value emphasized
        smoothedValue = (
          recentValues[0] * 0.1 + 
          recentValues[1] * 0.2 + 
          recentValues[2] * 0.4 + 
          recentValues[3] * 0.2 + 
          recentValues[4] * 0.1
        );
      } else {
        smoothedValue = preSmoothed;
      }
      
      this.signalBuffer.push(smoothedValue);
      this.lastProcessedValue = smoothedValue;
    }
    
    // Calculate derivative with improved sensitivity
    if (this.signalBuffer.length >= 3) {
      // More robust derivative calculation (3-point method)
      const i = this.signalBuffer.length - 1;
      const slope1 = this.signalBuffer[i] - this.signalBuffer[i-1];
      const slope2 = this.signalBuffer[i-1] - this.signalBuffer[i-2];
      const newDerivative = (slope1 + slope2) / 2;
      
      // Derivative smoothing with less aggressive parameters
      if (this.derivativeBuffer.length === 0) {
        this.valueDerivative = newDerivative;
      } else {
        this.valueDerivative = this.valueDerivative * 0.7 + newDerivative * 0.3;
      }
      
      this.derivativeBuffer.push(this.valueDerivative);
      if (this.derivativeBuffer.length > this.DERIVATIVE_BUFFER_SIZE) {
        this.derivativeBuffer.shift();
      }
    }
    
    // Limit buffer size
    if (this.signalBuffer.length > this.MAX_BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    return {
      smoothedValue,
      derivative: this.valueDerivative,
      signalBuffer: [...this.signalBuffer]
    };
  }
  
  public getRecentDerivatives(count: number = 5): number[] {
    return this.derivativeBuffer.slice(-count);
  }
  
  public reset(): void {
    this.signalBuffer = [];
    this.derivativeBuffer = [];
    this.stabilityBuffer = [];
    this.lastProcessedValue = 0;
    this.valueDerivative = 0;
    this.baselineValue = null;
  }
  
  public get bufferLength(): number {
    return this.signalBuffer.length;
  }
  
  public getSignalBuffer(): number[] {
    return [...this.signalBuffer];
  }
}
