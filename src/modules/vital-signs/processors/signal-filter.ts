
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Enhanced signal filtering utilities for processing real PPG signals
 * All methods work with real data only, no simulation
 */
export class SignalFilter {
  // Improved filter parameters for better signal quality
  private readonly SMA_WINDOW_SIZE = 8;          // Increased from 5 for smoother output
  private readonly MEDIAN_WINDOW_SIZE = 5;       // Increased from 3 for better outlier rejection
  private readonly LOW_PASS_ALPHA = 0.15;        // Reduced from 0.2 for more aggressive filtering
  private readonly HIGH_PASS_ALPHA = 0.85;       // Added high-pass filter parameter
  
  // Buffer for advanced filtering techniques
  private medianBuffer: number[] = [];
  private emaValue: number | null = null;
  private lastValues: number[] = [];
  
  // Bandpass filter state variables
  private readonly NOTCH_FREQUENCY = 50/60;      // Notch filter for power line interference (50/60Hz)
  private readonly Q_FACTOR = 2.0;               // Quality factor for notch filter
  private readonly SAMPLE_RATE = 30;             // Assumed sample rate in Hz
  private readonly BANDPASS_LOW_CUTOFF = 0.5;    // 0.5Hz (30 BPM) low cutoff
  private readonly BANDPASS_HIGH_CUTOFF = 5.0;   // 5Hz (300 BPM) high cutoff
  private prevInputs: number[] = [0, 0];
  private prevOutputs: number[] = [0, 0];
  private notchInputs: number[] = [0, 0];
  private notchOutputs: number[] = [0, 0];
  
  // Adaptive filter state 
  private adaptiveAlpha = this.LOW_PASS_ALPHA;
  private signalAmplitude = 0.1;
  private noiseEstimate = 0.01;
  
  /**
   * Apply Moving Average filter to real values with improved window size
   */
  public applySMAFilter(value: number, values: number[]): number {
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (values.length < windowSize) {
      return value;
    }
    
    const recentValues = values.slice(-windowSize);
    const sum = recentValues.reduce((acc, val) => acc + val, 0);
    return (sum + value) / (windowSize + 1);
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   * with improved alpha parameter for smoother output
   */
  public applyEMAFilter(value: number, values: number[], alpha: number = this.LOW_PASS_ALPHA): number {
    if (values.length === 0) {
      return value;
    }
    
    if (this.emaValue === null) {
      this.emaValue = value;
      return value;
    }
    
    // Update adaptive alpha based on signal characteristics
    if (values.length > 10) {
      const recentValues = values.slice(-10);
      const valMean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      const valVariance = recentValues.reduce((a, b) => a + Math.pow(b - valMean, 2), 0) / recentValues.length;
      
      // Estimate signal and noise
      this.signalAmplitude = Math.sqrt(valVariance);
      
      // Calculate absolute difference from previous value
      const diff = Math.abs(value - this.emaValue);
      
      // Update noise estimate with exponential forgetting
      this.noiseEstimate = 0.95 * this.noiseEstimate + 0.05 * diff;
      
      // Adaptive alpha - more smoothing for noisy signals, less for clean signals
      const signalToNoise = this.signalAmplitude / Math.max(0.001, this.noiseEstimate);
      this.adaptiveAlpha = Math.min(0.9, Math.max(0.1, alpha * Math.min(2, Math.max(0.5, signalToNoise))));
    }
    
    this.emaValue = this.adaptiveAlpha * value + (1 - this.adaptiveAlpha) * this.emaValue;
    return this.emaValue;
  }
  
  /**
   * Apply median filter to real data with improved window size
   * for better outlier rejection
   */
  public applyMedianFilter(value: number, values: number[]): number {
    // Update internal buffer for better continuity
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_WINDOW_SIZE) {
      this.medianBuffer.shift();
    }
    
    // If buffer is not full, use existing values plus current value
    if (this.medianBuffer.length < this.MEDIAN_WINDOW_SIZE) {
      const availableValues = [...values.slice(-this.MEDIAN_WINDOW_SIZE + 1), value];
      availableValues.sort((a, b) => a - b);
      return availableValues[Math.floor(availableValues.length / 2)];
    }
    
    // Create a copy for sorting to avoid mutating the buffer
    const valuesForMedian = [...this.medianBuffer];
    valuesForMedian.sort((a, b) => a - b);
    
    return valuesForMedian[Math.floor(valuesForMedian.length / 2)];
  }
  
  /**
   * Apply bandpass filter to real data - combines low and high pass filtering
   * to remove both high-frequency noise and baseline wander
   */
  public applyBandpassFilter(value: number, values: number[]): number {
    if (values.length === 0) {
      this.lastValues = [value];
      return value;
    }
    
    // First apply low-pass filter to remove high-frequency noise
    const lowPassFiltered = this.applyEMAFilter(value, values, this.LOW_PASS_ALPHA);
    
    // Then apply high-pass filter to remove baseline wander
    // Store the last few low-pass filtered values
    this.lastValues.push(lowPassFiltered);
    if (this.lastValues.length > 10) {
      this.lastValues.shift();
    }
    
    // Calculate baseline as moving average of low-pass filtered signal
    const baseline = this.lastValues.reduce((sum, val) => sum + val, 0) / this.lastValues.length;
    
    // Remove baseline to get high-pass filtered signal
    return lowPassFiltered - baseline * (1 - this.HIGH_PASS_ALPHA);
  }
  
  /**
   * Apply proper IIR bandpass filter with better frequency characteristics
   * Uses biquad filter design for more accurate cutoff slopes
   */
  public applyIIRBandpassFilter(value: number): number {
    // Normalized frequencies
    const w1 = 2 * Math.PI * this.BANDPASS_LOW_CUTOFF / this.SAMPLE_RATE;
    const w2 = 2 * Math.PI * this.BANDPASS_HIGH_CUTOFF / this.SAMPLE_RATE;
    
    // Filter coefficients - simplified biquad filter
    const alpha1 = Math.sin(w1) / (2 * 0.7071); // Q factor of 0.7071 for Butterworth response
    const alpha2 = Math.sin(w2) / (2 * 0.7071);
    
    const b0_hp = (1 + Math.cos(w1)) / 2;
    const b1_hp = -(1 + Math.cos(w1));
    const b2_hp = (1 + Math.cos(w1)) / 2;
    const a0_hp = 1 + alpha1;
    const a1_hp = -2 * Math.cos(w1);
    const a2_hp = 1 - alpha1;
    
    const b0_lp = (1 - Math.cos(w2)) / 2;
    const b1_lp = 1 - Math.cos(w2);
    const b2_lp = (1 - Math.cos(w2)) / 2;
    const a0_lp = 1 + alpha2;
    const a1_lp = -2 * Math.cos(w2);
    const a2_lp = 1 - alpha2;
    
    // High-pass stage
    const highpassOutput = (b0_hp * value + b1_hp * this.prevInputs[0] + b2_hp * this.prevInputs[1]
                          - a1_hp * this.prevOutputs[0] - a2_hp * this.prevOutputs[1]) / a0_hp;
    
    // Update high-pass state
    this.prevInputs[1] = this.prevInputs[0];
    this.prevInputs[0] = value;
    this.prevOutputs[1] = this.prevOutputs[0];
    this.prevOutputs[0] = highpassOutput;
    
    // Low-pass stage (using high-pass output as input)
    const bandpassOutput = (b0_lp * highpassOutput + b1_lp * this.notchInputs[0] + b2_lp * this.notchInputs[1]
                          - a1_lp * this.notchOutputs[0] - a2_lp * this.notchOutputs[1]) / a0_lp;
    
    // Update low-pass state
    this.notchInputs[1] = this.notchInputs[0];
    this.notchInputs[0] = highpassOutput;
    this.notchOutputs[1] = this.notchOutputs[0];
    this.notchOutputs[0] = bandpassOutput;
    
    return bandpassOutput;
  }
  
  /**
   * Apply notch filter to remove power line interference
   */
  public applyNotchFilter(value: number): number {
    // Normalized frequency
    const w0 = 2 * Math.PI * this.NOTCH_FREQUENCY / this.SAMPLE_RATE;
    
    // Filter coefficients
    const alpha = Math.sin(w0) / (2 * this.Q_FACTOR);
    const b0 = 1;
    const b1 = -2 * Math.cos(w0);
    const b2 = 1;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w0);
    const a2 = 1 - alpha;
    
    // Apply filter
    const output = (b0 * value + b1 * this.notchInputs[0] + b2 * this.notchInputs[1]
                   - a1 * this.notchOutputs[0] - a2 * this.notchOutputs[1]) / a0;
    
    // Update state
    this.notchInputs[1] = this.notchInputs[0];
    this.notchInputs[0] = value;
    this.notchOutputs[1] = this.notchOutputs[0];
    this.notchOutputs[0] = output;
    
    return output;
  }
  
  /**
   * Apply combined filtering approach for optimal PPG signal quality
   * This uses a pipeline of filters to progressively clean the signal
   */
  public applyOptimalFilter(value: number, values: number[]): number {
    // Step 1: Apply median filter to remove sudden spikes/outliers
    const medianFiltered = this.applyMedianFilter(value, values);
    
    // Step 2: Apply notch filter for power line interference
    const notchFiltered = this.applyNotchFilter(medianFiltered);
    
    // Step 3: Apply IIR bandpass filter for frequency-selective filtering
    const bandpassFiltered = this.applyIIRBandpassFilter(notchFiltered);
    
    // Step 4: Apply EMA with adaptive alpha for final smoothing
    const finalValue = this.applyEMAFilter(bandpassFiltered, values, this.adaptiveAlpha);
    
    return finalValue;
  }
  
  /**
   * Reset all internal filter states
   */
  public reset(): void {
    this.medianBuffer = [];
    this.emaValue = null;
    this.lastValues = [];
    this.prevInputs = [0, 0];
    this.prevOutputs = [0, 0];
    this.notchInputs = [0, 0];
    this.notchOutputs = [0, 0];
    this.adaptiveAlpha = this.LOW_PASS_ALPHA;
    this.signalAmplitude = 0.1;
    this.noiseEstimate = 0.01;
  }
  
  /**
   * Get current adaptive filter parameters for monitoring
   */
  public getFilterParameters(): {
    adaptiveAlpha: number,
    signalAmplitude: number,
    noiseEstimate: number,
    signalToNoise: number
  } {
    return {
      adaptiveAlpha: this.adaptiveAlpha,
      signalAmplitude: this.signalAmplitude,
      noiseEstimate: this.noiseEstimate,
      signalToNoise: this.signalAmplitude / Math.max(0.001, this.noiseEstimate)
    };
  }
}
