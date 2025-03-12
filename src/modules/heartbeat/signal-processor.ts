
export class SignalProcessor {
  // Buffer and signal parameters with balanced values
  private readonly MAX_BUFFER_SIZE: number;
  private readonly DERIVATIVE_BUFFER_SIZE: number;
  private readonly EMA_ALPHA: number;
  
  // State
  private signalBuffer: number[] = [];
  private derivativeBuffer: number[] = []; 
  private lastProcessedValue = 0;
  private valueDerivative = 0;
  
  // Stability tracking with balanced parameters
  private readonly STABILITY_BUFFER_SIZE = 20;
  private stabilityBuffer: number[] = [];
  private baselineValue: number | null = null;
  private readonly BASELINE_ALPHA = 0.08;
  
  constructor(maxBufferSize = 300, derivativeBufferSize = 8, emaAlpha = 0.3) {
    this.MAX_BUFFER_SIZE = maxBufferSize;
    this.DERIVATIVE_BUFFER_SIZE = derivativeBufferSize;
    this.EMA_ALPHA = emaAlpha;
    console.log(`SignalProcessor: Inicializado con parámetros - maxBufferSize: ${maxBufferSize}, derivativeBufferSize: ${derivativeBufferSize}, emaAlpha: ${emaAlpha}`);
  }
  
  public processSignal(value: number): {
    smoothedValue: number;
    derivative: number;
    signalBuffer: number[];
  } {
    // Initialize baseline tracking
    if (this.baselineValue === null) {
      this.baselineValue = value;
      console.log(`SignalProcessor: Inicialización de línea base con valor ${value}`);
    } else {
      this.baselineValue = this.baselineValue * (1 - this.BASELINE_ALPHA) + value * this.BASELINE_ALPHA;
    }
    
    // Add signal to buffer with balanced smoothing
    let smoothedValue: number;
    
    if (this.signalBuffer.length === 0) {
      smoothedValue = value;
      this.signalBuffer.push(value);
      console.log(`SignalProcessor: Primera muestra - valor bruto: ${value}`);
    } else {
      // First stage EMA smoothing
      const preSmoothed = this.lastProcessedValue + 
        this.EMA_ALPHA * (value - this.lastProcessedValue);
      
      // Second stage smoothing using stability buffer
      this.stabilityBuffer.push(preSmoothed);
      if (this.stabilityBuffer.length > this.STABILITY_BUFFER_SIZE) {
        this.stabilityBuffer.shift();
      }
      
      // Apply weighted moving average
      if (this.stabilityBuffer.length >= 5) {
        const recentValues = this.stabilityBuffer.slice(-5);
        // Balanced weighting
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
      
      // Log every 10th sample to avoid spam
      if (this.signalBuffer.length % 10 === 0) {
        console.log(`SignalProcessor: Muestra #${this.signalBuffer.length} - valor bruto: ${value.toFixed(2)}, pre-suavizado: ${preSmoothed.toFixed(2)}, suavizado final: ${smoothedValue.toFixed(2)}`);
      }
    }
    
    // Calculate derivative with balanced sensitivity
    if (this.signalBuffer.length >= 3) {
      // Standard 3-point derivative calculation
      const i = this.signalBuffer.length - 1;
      const slope1 = this.signalBuffer[i] - this.signalBuffer[i-1];
      const slope2 = this.signalBuffer[i-1] - this.signalBuffer[i-2];
      const newDerivative = (slope1 + slope2) / 2;
      
      // Balanced derivative smoothing
      if (this.derivativeBuffer.length === 0) {
        this.valueDerivative = newDerivative;
      } else {
        this.valueDerivative = this.valueDerivative * 0.6 + newDerivative * 0.4;
      }
      
      this.derivativeBuffer.push(this.valueDerivative);
      if (this.derivativeBuffer.length > this.DERIVATIVE_BUFFER_SIZE) {
        this.derivativeBuffer.shift();
      }
      
      // Log significant derivative changes
      if (Math.abs(this.valueDerivative) > 0.3 || this.signalBuffer.length % 30 === 0) {
        console.log(`SignalProcessor: Derivada calculada: ${this.valueDerivative.toFixed(3)}, pendiente1: ${slope1.toFixed(3)}, pendiente2: ${slope2.toFixed(3)}`);
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
    console.log(`SignalProcessor: Reseteo - bufferLength: ${this.signalBuffer.length}, derivativeBufferLength: ${this.derivativeBuffer.length}`);
    this.signalBuffer = [];
    this.derivativeBuffer = [];
    this.stabilityBuffer = [];
    this.lastProcessedValue = 0;
    this.valueDerivative = 0;
    this.baselineValue = null;
    console.log("SignalProcessor: Reseteo completado");
  }
  
  public get bufferLength(): number {
    return this.signalBuffer.length;
  }
  
  public getSignalBuffer(): number[] {
    return [...this.signalBuffer];
  }
}
