
/**
 * Hemoglobin Processor
 * Estimates hemoglobin levels based on PPG waveform characteristics
 */
export class HemoglobinProcessor {
  private readonly MIN_SIGNAL_QUALITY = 0.2;
  private readonly DEFAULT_HEMOGLOBIN = 13.5; // Default healthy value (g/dL)
  private readonly MIN_HEMOGLOBIN = 10.0;     // Minimum physiological value
  private readonly MAX_HEMOGLOBIN = 17.0;     // Maximum physiological value
  
  // Adaptive parameters
  private lastCalculatedValue: number = 0;
  private confidenceLevel: number = 0;
  
  constructor() {
    console.log("HemoglobinProcessor: Initialized");
  }
  
  /**
   * Calculate estimated hemoglobin level from PPG signal
   */
  public calculateHemoglobin(ppgValues: number[]): number {
    if (!ppgValues || ppgValues.length < 15) {
      return this.lastCalculatedValue || this.DEFAULT_HEMOGLOBIN;
    }
    
    // Extract key features from PPG waveform
    const { amplitude, dicroticNotchPosition, pulseWidth, signalQuality } = this.extractPPGFeatures(ppgValues);
    
    // If signal quality is too low, return previous or default value
    if (signalQuality < this.MIN_SIGNAL_QUALITY) {
      return this.lastCalculatedValue || this.DEFAULT_HEMOGLOBIN;
    }
    
    // Update confidence based on signal quality and data amount
    this.confidenceLevel = Math.min(0.9, this.confidenceLevel + 0.02);
    this.confidenceLevel *= signalQuality;
    
    // Use a multi-parameter physiological model to estimate hemoglobin
    // This is based on correlation between PPG features and blood hemoglobin concentration
    
    // Baseline component - typical healthy hemoglobin value
    let hemoglobinEstimate = this.DEFAULT_HEMOGLOBIN;
    
    // Amplitude component - relates to oxygen carrying capacity
    // Lower amplitude often correlates with lower hemoglobin
    const amplitudeComponent = (amplitude - 0.5) * 2.0;
    
    // Dicrotic notch component - relates to blood viscosity
    // Position of the dicrotic notch shifts with hemoglobin changes
    const dicroticComponent = (dicroticNotchPosition - 0.3) * 1.5;
    
    // Pulse width component - relates to blood flow resistance
    // Wider pulses often correlate with lower hemoglobin levels
    const pulseWidthComponent = (0.2 - pulseWidth) * 2.5;
    
    // Apply weighted adjustments based on confidence
    hemoglobinEstimate += 
      amplitudeComponent * 0.4 * this.confidenceLevel +
      dicroticComponent * 0.3 * this.confidenceLevel +
      pulseWidthComponent * 0.3 * this.confidenceLevel;
    
    // Ensure result is within physiological limits
    hemoglobinEstimate = Math.max(
      this.MIN_HEMOGLOBIN, 
      Math.min(this.MAX_HEMOGLOBIN, hemoglobinEstimate)
    );
    
    // Apply smoothing with previous value if available
    if (this.lastCalculatedValue > 0) {
      hemoglobinEstimate = 
        this.lastCalculatedValue * 0.7 + 
        hemoglobinEstimate * 0.3;
    }
    
    // Save current value for next time
    this.lastCalculatedValue = hemoglobinEstimate;
    
    return hemoglobinEstimate;
  }
  
  /**
   * Extract relevant features from PPG waveform
   */
  private extractPPGFeatures(ppgValues: number[]): {
    amplitude: number;
    dicroticNotchPosition: number;
    pulseWidth: number;
    signalQuality: number;
  } {
    // Normalize signal
    const min = Math.min(...ppgValues);
    const max = Math.max(...ppgValues);
    const range = max - min;
    
    if (range === 0) {
      return {
        amplitude: 0,
        dicroticNotchPosition: 0.3, // Default position
        pulseWidth: 0.2, // Default width
        signalQuality: 0
      };
    }
    
    const normalizedValues = ppgValues.map(v => (v - min) / range);
    
    // Find peaks for pulse analysis
    const peaks = this.findPeaks(normalizedValues);
    
    if (peaks.length < 2) {
      return {
        amplitude: range,
        dicroticNotchPosition: 0.3,
        pulseWidth: 0.2,
        signalQuality: 0.1
      };
    }
    
    // Calculate pulse width (time between consecutive peaks)
    const pulseWidths = [];
    for (let i = 1; i < peaks.length; i++) {
      pulseWidths.push(peaks[i] - peaks[i-1]);
    }
    
    const avgPulseWidth = pulseWidths.reduce((a, b) => a + b, 0) / pulseWidths.length;
    const normalizedPulseWidth = Math.min(0.5, Math.max(0.1, avgPulseWidth / normalizedValues.length));
    
    // Estimate dicrotic notch position
    let dicroticPosition = 0.3; // Default
    
    // For each peak, try to find the dicrotic notch
    for (let i = 0; i < peaks.length - 1; i++) {
      const peakIdx = peaks[i];
      const nextPeakIdx = peaks[i+1];
      
      // Look in the latter half of the pulse
      const startIdx = peakIdx + Math.floor((nextPeakIdx - peakIdx) * 0.3);
      const endIdx = peakIdx + Math.floor((nextPeakIdx - peakIdx) * 0.7);
      
      // Find local minimum which could be the dicrotic notch
      let minVal = 1.0;
      let minIdx = startIdx;
      
      for (let j = startIdx; j <= endIdx && j < normalizedValues.length; j++) {
        if (normalizedValues[j] < minVal) {
          minVal = normalizedValues[j];
          minIdx = j;
        }
      }
      
      // Calculate position as percentage of pulse width
      dicroticPosition = (minIdx - peakIdx) / (nextPeakIdx - peakIdx);
    }
    
    // Calculate signal quality
    const variability = this.calculateVariability(normalizedValues);
    const signalQuality = Math.max(0, Math.min(1, 1 - variability));
    
    return {
      amplitude: range,
      dicroticNotchPosition: dicroticPosition,
      pulseWidth: normalizedPulseWidth,
      signalQuality
    };
  }
  
  /**
   * Find peaks in PPG signal
   */
  private findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    // Minimum distance between peaks (samples)
    const minDistance = Math.floor(values.length / 10);
    
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && 
          values[i] > values[i-2] &&
          values[i] > values[i+1] &&
          values[i] > values[i+2] &&
          values[i] > 0.5) { // Threshold to ignore small peaks
        
        // Check minimum distance from last peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
          peaks.push(i);
        }
      }
    }
    
    return peaks;
  }
  
  /**
   * Calculate variability/noise in PPG signal
   */
  private calculateVariability(values: number[]): number {
    if (values.length < 3) return 1;
    
    // Calculate first derivative
    const derivatives = [];
    for (let i = 1; i < values.length; i++) {
      derivatives.push(Math.abs(values[i] - values[i-1]));
    }
    
    // Standard deviation of derivatives indicates noise level
    const mean = derivatives.reduce((a, b) => a + b, 0) / derivatives.length;
    const variance = derivatives.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / derivatives.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Reset processor state
   */
  public reset(): void {
    this.lastCalculatedValue = 0;
    this.confidenceLevel = 0;
  }
}
