
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
  
  constructor(maxBufferSize = 300, derivativeBufferSize = 10, emaAlpha = 0.4) {
    this.MAX_BUFFER_SIZE = maxBufferSize;
    this.DERIVATIVE_BUFFER_SIZE = derivativeBufferSize;
    this.EMA_ALPHA = emaAlpha;
  }
  
  public processSignal(value: number): {
    smoothedValue: number;
    derivative: number;
    signalBuffer: number[];
  } {
    // Add signal to buffer with EMA smoothing for noise reduction
    let smoothedValue: number;
    
    if (this.signalBuffer.length === 0) {
      smoothedValue = value;
      this.signalBuffer.push(value);
    } else {
      // Smooth signal using EMA
      smoothedValue = this.lastProcessedValue + 
        this.EMA_ALPHA * (value - this.lastProcessedValue);
      this.signalBuffer.push(smoothedValue);
      this.lastProcessedValue = smoothedValue;
    }
    
    // Calculate first derivative (slope) - important for peak detection
    if (this.signalBuffer.length >= 2) {
      const currentValue = this.signalBuffer[this.signalBuffer.length - 1];
      const prevValue = this.signalBuffer[this.signalBuffer.length - 2];
      const newDerivative = currentValue - prevValue;
      
      // Smooth derivative using EMA
      if (this.derivativeBuffer.length === 0) {
        this.valueDerivative = newDerivative;
      } else {
        this.valueDerivative = this.valueDerivative * 0.7 + newDerivative * 0.3;
      }
      
      // Store derivative for trend analysis
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
  
  public getRecentDerivatives(count: number = 3): number[] {
    return this.derivativeBuffer.slice(-count);
  }
  
  public reset(): void {
    this.signalBuffer = [];
    this.derivativeBuffer = [];
    this.lastProcessedValue = 0;
    this.valueDerivative = 0;
  }
  
  public get bufferLength(): number {
    return this.signalBuffer.length;
  }
  
  public getSignalBuffer(): number[] {
    return [...this.signalBuffer];
  }
}
