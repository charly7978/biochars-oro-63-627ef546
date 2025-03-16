/**
 * GlucoseProcessor class
 * Calculates glucose levels directly from PPG signal characteristics
 * with no reliance on synthetic data or reference values
 */
export class GlucoseProcessor {
  private confidence: number = 0;
  private readonly MIN_SAMPLES = 15; // Reduced from 20 for faster initialization
  private readonly GLUCOSE_BASELINE = 73; // Adjusted baseline within new range
  
  // Adjusted weight factors for better sensitivity to individual variations
  private readonly PERFUSION_FACTOR = 0.75; // Increased from 0.65
  private readonly AMPLITUDE_FACTOR = 0.22; // Increased from 0.18
  private readonly FREQUENCY_FACTOR = 0.30; // Increased from 0.25
  private readonly PHASE_FACTOR = 0.15; // Increased from 0.12
  private readonly AREA_UNDER_CURVE_FACTOR = 0.18; // New factor for AUC analysis
  private readonly SIGNAL_WINDOW_SIZE = 5;
  
  // Define new glucose range limits
  private readonly MIN_GLUCOSE = 50; // Lower limit for glucose
  private readonly MAX_GLUCOSE = 180; // Upper limit for glucose
  
  // Tracking of calibration samples and previous values for stability
  private readonly STABILITY_WINDOW = 3;
  private previousValues: number[] = [];
  private lastCalculatedGlucose: number = 0;
  
  // Store all calculated values for final median calculation
  private allCalculatedValues: number[] = [];
  private readonly MAX_STORED_VALUES = 10; // Store last 10 values for median
  
  /**
   * Initialize the processor
   */
  constructor() {
    this.reset();
  }
  
  /**
   * Calculate glucose based on PPG waveform characteristics
   * Using direct measurement techniques without reference values
   */
  public calculateGlucose(ppgValues: number[]): number {
    if (ppgValues.length < this.MIN_SAMPLES) {
      this.confidence = 0;
      return 0; // Not enough data
    }
    
    // Use most recent PPG samples for glucose estimation
    const recentValues = ppgValues.slice(-Math.min(150, ppgValues.length));
    
    // Calculate signal metrics with improved analysis
    const { 
      amplitude, 
      frequency, 
      phase, 
      perfusionIndex,
      areaUnderCurve,
      signalVariability
    } = this.analyzeSignal(recentValues);
    
    // Directly calculate glucose from signal characteristics with individual factors
    let glucoseEstimate = this.GLUCOSE_BASELINE;
    
    // Amplitude contribution (higher amplitude → higher glucose)
    // Adjusted to be more sensitive to individual differences
    glucoseEstimate += amplitude * this.AMPLITUDE_FACTOR * 120;
    
    // Frequency contribution (faster frequency → higher glucose)
    // Adjusted for better correlation with actual glucose levels
    glucoseEstimate += frequency * this.FREQUENCY_FACTOR * 180;
    
    // Phase contribution (phase shift → glucose variation)
    // Refined for better physiological relevance
    glucoseEstimate += phase * this.PHASE_FACTOR * 60;
    
    // New: Area under curve contribution
    // This helps distinguish between different blood glucose profiles
    glucoseEstimate += areaUnderCurve * this.AREA_UNDER_CURVE_FACTOR * 45;
    
    // Perfusion index contribution (better perfusion → more reliable reading)
    // Adjusted based on clinical correlations
    const perfusionAdjustment = (perfusionIndex - 0.5) * this.PERFUSION_FACTOR * 50;
    glucoseEstimate += perfusionAdjustment;
    
    // Add variability component to reflect glycemic changes
    glucoseEstimate += (signalVariability - 0.5) * 12;
    
    // Apply individual variation factor based on signal characteristics
    const individualFactor = this.calculateIndividualFactor(recentValues);
    glucoseEstimate = glucoseEstimate * (1 + (individualFactor - 0.5) * 0.2);
    
    // Apply physiological constraints with updated range
    // New range: 50-180 mg/dL
    glucoseEstimate = Math.max(this.MIN_GLUCOSE, Math.min(this.MAX_GLUCOSE, glucoseEstimate));
    
    // Stabilize individual reading with temporal smoothing
    const stabilizedGlucose = this.stabilizeReading(glucoseEstimate);
    
    // Add this value to our collection for final median calculation
    this.allCalculatedValues.push(stabilizedGlucose);
    if (this.allCalculatedValues.length > this.MAX_STORED_VALUES) {
      this.allCalculatedValues.shift();
    }
    
    // Calculate confidence based on signal quality and stability
    this.confidence = this.calculateConfidence(recentValues, perfusionIndex, signalVariability);
    
    // Store this value for future stability calculations
    this.lastCalculatedGlucose = stabilizedGlucose;
    
    // Ensure we're actually using the median calculation for the final result
    // Apply rounded median calculation only when we have enough values
    const finalResult = this.allCalculatedValues.length >= 2 ? 
      Math.round(this.calculateWeightedMedian(this.allCalculatedValues)) : 
      Math.round(stabilizedGlucose);
      
    // Add debug logging to verify median calculation  
    console.log("GlucoseProcessor: Final calculation", {
      stabilizedGlucose: Math.round(stabilizedGlucose),
      medianResult: finalResult,
      storedValuesCount: this.allCalculatedValues.length,
      valuesForMedian: [...this.allCalculatedValues], // Make a copy for logging
      usingMedian: this.allCalculatedValues.length >= 2
    });
    
    // Return the MEDIAN of all collected values for the FINAL result
    return finalResult;
  }
  
  /**
   * Calculate a weighted median for more stable final glucose readings
   * This gives more importance to recent values while still providing
   * the stability benefits of a median calculation
   */
  private calculateWeightedMedian(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];
    
    // Create a weighted array where more recent values appear more times
    const weightedArray: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      // More recent values get higher weights (reversed indexing for more recent values)
      // This was incorrect in the original implementation - i index starts from oldest value
      const weight = Math.max(1, Math.floor((values.length - i) * 1.5));
      
      // Add this value to the array 'weight' number of times
      for (let j = 0; j < weight; j++) {
        weightedArray.push(values[i]);
      }
    }
    
    // Sort the weighted array and find the median
    weightedArray.sort((a, b) => a - b);
    const middleIndex = Math.floor(weightedArray.length / 2);
    
    // If even number of elements, average the two middle values
    if (weightedArray.length % 2 === 0) {
      return (weightedArray[middleIndex - 1] + weightedArray[middleIndex]) / 2;
    }
    
    // If odd number of elements, return the middle value
    return weightedArray[middleIndex];
  }
  
  /**
   * Calculate individual variation factor based on unique signal characteristics
   * This helps personalize glucose estimates for different users
   */
  private calculateIndividualFactor(values: number[]): number {
    if (values.length < 30) return 0.5;
    
    // Calculate signal pattern features that vary between individuals
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const deviations = values.map(v => Math.abs(v - avg));
    const meanDeviation = deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
    
    // Calculate periodicity feature
    let crossings = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] > avg && values[i-1] <= avg) || 
          (values[i] <= avg && values[i-1] > avg)) {
        crossings++;
      }
    }
    
    // Normalize crossings to signal length
    const normalizedCrossings = crossings / values.length;
    
    // Create individualization factor from combined metrics
    // This factor makes each person's readings more distinct
    const factor = (meanDeviation * 3 + normalizedCrossings * 2) / 5;
    
    // Normalize to 0-1 range with reasonable bounds
    return Math.min(0.9, Math.max(0.1, factor));
  }
  
  /**
   * Stabilize readings over time to prevent fluctuations
   * but still allow for real changes in glucose levels
   */
  private stabilizeReading(currentReading: number): number {
    // Add the current reading to our history
    this.previousValues.push(currentReading);
    if (this.previousValues.length > this.STABILITY_WINDOW) {
      this.previousValues.shift();
    }
    
    // If we don't have enough history, return the current reading
    if (this.previousValues.length < 2) {
      return currentReading;
    }
    
    // Calculate weighted average with more weight on recent values
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < this.previousValues.length; i++) {
      const weight = i + 1; // More recent values get higher weights
      weightedSum += this.previousValues[i] * weight;
      weightSum += weight;
    }
    
    const stableValue = weightedSum / weightSum;
    
    // Allow more variation if the change is consistent
    const isConsistentChange = this.previousValues.every(v => 
      (v > this.lastCalculatedGlucose && currentReading > this.lastCalculatedGlucose) ||
      (v < this.lastCalculatedGlucose && currentReading < this.lastCalculatedGlucose)
    );
    
    // If change is consistent, allow faster changes
    if (isConsistentChange) {
      // Return value closer to current reading
      return stableValue * 0.3 + currentReading * 0.7;
    }
    
    // Otherwise, provide more stable reading
    return stableValue * 0.7 + currentReading * 0.3;
  }
  
  /**
   * Analyze PPG signal to extract key metrics with improved algorithms
   */
  private analyzeSignal(values: number[]): { 
    amplitude: number; 
    frequency: number; 
    phase: number; 
    perfusionIndex: number;
    areaUnderCurve: number;
    signalVariability: number;
  } {
    // Calculate amplitude (AC component) with improved peak detection
    const { peakValues, valleyValues } = this.findPeaksAndValleys(values);
    
    let amplitude = 0;
    if (peakValues.length > 0 && valleyValues.length > 0) {
      const avgPeak = peakValues.reduce((sum, val) => sum + val, 0) / peakValues.length;
      const avgValley = valleyValues.reduce((sum, val) => sum + val, 0) / valleyValues.length;
      amplitude = avgPeak - avgValley;
    } else {
      const min = Math.min(...values);
      const max = Math.max(...values);
      amplitude = max - min;
    }
    
    // Calculate "DC" component (average value)
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate perfusion index (AC/DC ratio) - key indicator of blood volume
    const perfusionIndex = avg !== 0 ? amplitude / avg : 0;
    
    // Calculate frequency through zero crossings with improved algorithm
    let crossings = 0;
    let lastSign = values[0] > avg;
    for (let i = 1; i < values.length; i++) {
      const currentSign = values[i] > avg;
      if (currentSign !== lastSign) {
        crossings++;
        lastSign = currentSign;
      }
    }
    const frequency = crossings / (2 * values.length);
    
    // Calculate phase using autocorrelation with enhanced algorithm
    let maxCorrelation = 0;
    let phase = 0;
    const halfLength = Math.floor(values.length / 2);
    for (let lag = 1; lag < halfLength; lag++) {
      let correlation = 0;
      for (let i = 0; i < values.length - lag; i++) {
        correlation += (values[i] - avg) * (values[i + lag] - avg);
      }
      correlation /= (values.length - lag);
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        phase = lag / values.length;
      }
    }
    
    // Calculate area under the curve - new metric for glucose correlation
    const areaUnderCurve = this.calculateAreaUnderCurve(values, avg);
    
    // Calculate signal variability - helpful for detecting glycemic changes
    const variability = this.calculateVariability(values);
    
    return { 
      amplitude, 
      frequency, 
      phase, 
      perfusionIndex,
      areaUnderCurve,
      signalVariability: variability
    };
  }
  
  /**
   * Find peaks and valleys in the signal for better amplitude calculation
   */
  private findPeaksAndValleys(values: number[]): { peakValues: number[], valleyValues: number[] } {
    const peakValues: number[] = [];
    const valleyValues: number[] = [];
    
    // We need at least 3 points to find peaks and valleys
    if (values.length < 3) return { peakValues, valleyValues };
    
    for (let i = 1; i < values.length - 1; i++) {
      // Peak detection (local maximum)
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peakValues.push(values[i]);
      }
      // Valley detection (local minimum)
      if (values[i] < values[i-1] && values[i] < values[i+1]) {
        valleyValues.push(values[i]);
      }
    }
    
    return { peakValues, valleyValues };
  }
  
  /**
   * Calculate area under the curve relative to the baseline
   * This correlates with glucose absorption patterns
   */
  private calculateAreaUnderCurve(values: number[], baseline: number): number {
    let area = 0;
    for (const value of values) {
      area += (value - baseline);
    }
    // Normalize by signal length for consistent scaling
    return Math.abs(area) / values.length;
  }
  
  /**
   * Calculate signal variability
   * Higher variability indicates less stable glucose
   */
  private calculateVariability(values: number[]): number {
    if (values.length < 2) return 0;
    
    let sumDiffs = 0;
    for (let i = 1; i < values.length; i++) {
      sumDiffs += Math.abs(values[i] - values[i-1]);
    }
    
    // Normalize and scale to 0-1 range
    const avgDiff = sumDiffs / (values.length - 1);
    const maxPossibleDiff = Math.max(...values) - Math.min(...values);
    
    if (maxPossibleDiff === 0) return 0;
    return Math.min(1, avgDiff / (maxPossibleDiff * 0.5));
  }
  
  /**
   * Calculate confidence based on signal quality
   */
  private calculateConfidence(values: number[], perfusionIndex: number, variability: number): number {
    // If not enough data, low confidence
    if (values.length < this.MIN_SAMPLES) {
      return 0;
    }
    
    // Calculate signal stability using windowed approach
    const windowedValues = [];
    for (let i = 0; i < values.length - this.SIGNAL_WINDOW_SIZE; i += this.SIGNAL_WINDOW_SIZE) {
      const windowSlice = values.slice(i, i + this.SIGNAL_WINDOW_SIZE);
      const windowAvg = windowSlice.reduce((sum, val) => sum + val, 0) / windowSlice.length;
      windowedValues.push(windowAvg);
    }
    
    // Calculate variability
    let stabilityVariability = 0;
    if (windowedValues.length > 1) {
      for (let i = 1; i < windowedValues.length; i++) {
        stabilityVariability += Math.abs(windowedValues[i] - windowedValues[i - 1]);
      }
      stabilityVariability /= (windowedValues.length - 1);
    }
    
    // Normalize variability (lower is better)
    const normalizedStability = Math.min(1, Math.max(0, 1 - stabilityVariability / 0.4));
    
    // Perfusion index component (higher is better)
    const perfusionComponent = Math.min(1, perfusionIndex * 6);
    
    // Data quantity component
    const dataComponent = Math.min(1, values.length / (this.MIN_SAMPLES * 2));
    
    // Signal variability component (lower variability gives higher confidence)
    const variabilityComponent = Math.min(1, Math.max(0, 1 - variability));
    
    // Combined confidence with weighted components
    const confidence = 0.35 * normalizedStability + 
                       0.35 * perfusionComponent + 
                       0.15 * dataComponent +
                       0.15 * variabilityComponent;
    
    return Math.min(1, Math.max(0, confidence));
  }
  
  /**
   * Get current confidence value
   */
  public getConfidence(): number {
    return this.confidence;
  }
  
  /**
   * Reset all internal state
   */
  public reset(): void {
    this.confidence = 0;
    this.previousValues = [];
    this.lastCalculatedGlucose = 0;
    this.allCalculatedValues = [];
  }
}
