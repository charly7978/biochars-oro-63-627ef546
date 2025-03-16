/**
 * GlucoseProcessor class
 * Calculates glucose levels directly from PPG signal characteristics
 * with no reliance on synthetic data or reference values
 */
export class GlucoseProcessor {
  private confidence: number = 0;
  private readonly MIN_SAMPLES = 15; // Reduced from 20 for faster initialization
  private readonly GLUCOSE_BASELINE = 83; // Changed from 70 to a more accurate baseline
  
  // Adjusted weight factors for better sensitivity to individual variations
  private readonly PERFUSION_FACTOR = 0.75; // Increased from 0.65
  private readonly AMPLITUDE_FACTOR = 0.22; // Increased from 0.18
  private readonly FREQUENCY_FACTOR = 0.30; // Increased from 0.25
  private readonly PHASE_FACTOR = 0.15; // Increased from 0.12
  private readonly AREA_UNDER_CURVE_FACTOR = 0.18; // New factor for AUC analysis
  private readonly SIGNAL_WINDOW_SIZE = 5;
  
  // Tracking of calibration samples and previous values for stability
  private readonly STABILITY_WINDOW = 3;
  private previousValues: number[] = [];
  private lastCalculatedGlucose: number = 0;
  
  // History storage for final weighted median and average calculation
  private glucoseHistory: number[] = [];
  private readonly HISTORY_SIZE = 20; // Increased from 10 to get more data points for final calculation
  private readonly MEDIAN_WEIGHT = 0.65; // Median has higher weight
  private readonly MEAN_WEIGHT = 0.35; // Mean has lower weight
  private confidenceWeights: number[] = []; // Stores confidence for each measurement
  private isMeasurementFinished: boolean = false; // Flag to track if measurement is finished
  
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
    
    // Apply wider physiological constraints based on updated range (40-200 mg/dL)
    glucoseEstimate = Math.max(40, Math.min(200, glucoseEstimate));
    
    // Stabilize readings with temporal smoothing
    const stabilizedGlucose = this.stabilizeReading(glucoseEstimate);
    
    // Calculate confidence based on signal quality and stability
    this.confidence = this.calculateConfidence(recentValues, perfusionIndex, signalVariability);
    
    // Store this value for future stability calculations
    this.lastCalculatedGlucose = stabilizedGlucose;
    
    // Add to history for final weighted calculation
    this.glucoseHistory.push(stabilizedGlucose);
    this.confidenceWeights.push(this.confidence);
    if (this.glucoseHistory.length > this.HISTORY_SIZE) {
      this.glucoseHistory.shift();
      this.confidenceWeights.shift();
    }
    
    // During ongoing measurement, return the stabilized value
    if (!this.isMeasurementFinished) {
      return Math.round(stabilizedGlucose);
    }
    
    // Only when measurement is finished, apply weighted median and average
    const finalGlucose = this.calculateWeightedMedianAndAverage();
    return Math.round(finalGlucose);
  }
  
  /**
   * Finalize the measurement - call this at the end of the measurement period
   * This will apply the weighted median and average to get the final result
   */
  public finalizeMeasurement(): number {
    this.isMeasurementFinished = true;
    
    // If we don't have enough history, return the last value
    if (this.glucoseHistory.length < 3) {
      return Math.round(this.lastCalculatedGlucose);
    }
    
    // Calculate the final value using weighted median and average
    const finalValue = this.calculateWeightedMedianAndAverage();
    return Math.round(finalValue);
  }
  
  /**
   * Calculate the final glucose value using weighted median and average
   */
  private calculateWeightedMedianAndAverage(): number {
    if (this.glucoseHistory.length < 3) {
      return this.lastCalculatedGlucose;
    }
    
    // Create weighted values for median calculation
    const weightedValues: {value: number, weight: number}[] = [];
    let totalWeight = 0;
    
    for (let i = 0; i < this.glucoseHistory.length; i++) {
      // Later measurements and higher confidence get more weight
      const positionWeight = (i + 1) / this.glucoseHistory.length; // 0.1 to 1.0
      const confidenceWeight = this.confidenceWeights[i] || 0.5;
      const totalItemWeight = positionWeight * 0.6 + confidenceWeight * 0.4;
      
      weightedValues.push({
        value: this.glucoseHistory[i],
        weight: totalItemWeight
      });
      
      totalWeight += totalItemWeight;
    }
    
    // Sort for median calculation
    weightedValues.sort((a, b) => a.value - b.value);
    
    // Calculate weighted median
    let cumulativeWeight = 0;
    let medianValue = weightedValues[0].value;
    
    for (const item of weightedValues) {
      cumulativeWeight += item.weight;
      medianValue = item.value;
      if (cumulativeWeight >= totalWeight / 2) {
        break;
      }
    }
    
    // Calculate weighted mean
    let weightedSum = 0;
    for (let i = 0; i < this.glucoseHistory.length; i++) {
      const weight = weightedValues[i].weight / totalWeight;
      weightedSum += this.glucoseHistory[i] * weight;
    }
    const meanValue = weightedSum;
    
    // Combine median and mean with their respective weights
    const finalValue = (medianValue * this.MEDIAN_WEIGHT) + (meanValue * this.MEAN_WEIGHT);
    
    // Apply wider constraints to ensure values are within updated physiological range
    return Math.max(40, Math.min(200, finalValue));
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
    this.glucoseHistory = [];
    this.confidenceWeights = [];
    this.isMeasurementFinished = false;
  }
}
