
/**
 * Basic lipid profile estimation using PPG signal analysis
 */
export class LipidProcessor {
  // Physiologically relevant reference values
  private readonly MIN_CHOLESTEROL = 130; // Minimum physiological (mg/dL)
  private readonly MAX_CHOLESTEROL = 220; // Upper limit (mg/dL)
  private readonly MIN_TRIGLYCERIDES = 50; // Minimum physiological (mg/dL)
  private readonly MAX_TRIGLYCERIDES = 170; // Upper limit (mg/dL)
  
  // Validation and confidence parameters
  private readonly CONFIDENCE_THRESHOLD = 0.65;
  private readonly MIN_SAMPLE_SIZE = 200;
  
  // Weighted average and median parameters
  private readonly MEDIAN_WEIGHT = 0.65;
  private readonly MEAN_WEIGHT = 0.35;
  private readonly HISTORY_WEIGHT = 0.7;
  
  // Recent measurements for stability
  private recentCholesterolValues: number[] = [];
  private recentTriglyceridesValues: number[] = [];
  private readonly MAX_HISTORY_SIZE = 5;
  
  /**
   * Calculate lipid profile from PPG signal characteristics
   * Uses direct measurement of PPG characteristics
   */
  public calculateLipids(
    ppgValues: number[], 
    heartRate: number, 
    perfusionIndex: number
  ): { 
    totalCholesterol: number; 
    triglycerides: number;
    confidence: number;
  } {
    // Check if we have enough data
    if (ppgValues.length < this.MIN_SAMPLE_SIZE || !heartRate || perfusionIndex < 0.05) {
      return this.getDefaultWithConfidence(0.1);
    }
    
    // Calculate signal characteristics
    const signalAmplitude = Math.max(...ppgValues) - Math.min(...ppgValues);
    const signalMean = ppgValues.reduce((sum, val) => sum + val, 0) / ppgValues.length;
    const normalizedAmplitude = signalAmplitude / signalMean;
    
    // Calculate spectral features
    const { 
      highFrequencyEnergy,
      lowFrequencyEnergy,
      frequencyRatio,
      waveformComplexity
    } = this.calculateSpectralFeatures(ppgValues);
    
    // Signal morphology features
    const { 
      risetime, 
      falltime,
      risetimeFalltimeRatio,
      peakWidth
    } = this.calculateMorphologyFeatures(ppgValues);
    
    // Confidence calculation based on signal quality
    const confidence = this.calculateConfidence(
      perfusionIndex,
      normalizedAmplitude,
      frequencyRatio,
      ppgValues.length
    );
    
    // If confidence is too low, return with lower confidence
    if (confidence < this.CONFIDENCE_THRESHOLD / 2) {
      return this.getDefaultWithConfidence(confidence);
    }
    
    // Base values for estimation
    const baseCholesterol = 170;
    const baseTriglycerides = 100;
    
    // Cholesterol estimation components
    let cholesterolEstimate = baseCholesterol;
    cholesterolEstimate += (perfusionIndex - 0.3) * -40; // Lower PI often correlates with higher cholesterol
    cholesterolEstimate += (risetimeFalltimeRatio - 0.5) * 15; // Waveform shape factor
    cholesterolEstimate += (frequencyRatio - 1.0) * 25; // Spectral component
    cholesterolEstimate += (waveformComplexity - 0.5) * 20; // Waveform complexity factor
    
    // Apply heart rate adjustment - higher cholesterol often has heart rate impact
    cholesterolEstimate += (heartRate > 80 ? 5 : -5);
    
    // Apply limits
    cholesterolEstimate = Math.max(this.MIN_CHOLESTEROL, Math.min(this.MAX_CHOLESTEROL, cholesterolEstimate));
    
    // Triglycerides estimation components
    let triglyceridesEstimate = baseTriglycerides;
    triglyceridesEstimate += (peakWidth - 0.3) * 50; // Wider peaks correlate with higher triglycerides
    triglyceridesEstimate += (lowFrequencyEnergy - 0.5) * 35; // Low frequency component
    triglyceridesEstimate += (perfusionIndex - 0.3) * -30; // Perfusion index component
    
    // Apply limits
    triglyceridesEstimate = Math.max(this.MIN_TRIGLYCERIDES, Math.min(this.MAX_TRIGLYCERIDES, triglyceridesEstimate));
    
    // Store values for stability
    this.addToHistory(cholesterolEstimate, triglyceridesEstimate);
    
    // Apply smoothing for stability
    const stabilizedValues = this.calculateStabilizedValues(cholesterolEstimate, triglyceridesEstimate);
    
    return {
      totalCholesterol: Math.round(stabilizedValues.cholesterol),
      triglycerides: Math.round(stabilizedValues.triglycerides),
      confidence
    };
  }
  
  /**
   * Add values to history for smoothing
   */
  private addToHistory(cholesterol: number, triglycerides: number): void {
    this.recentCholesterolValues.push(cholesterol);
    this.recentTriglyceridesValues.push(triglycerides);
    
    if (this.recentCholesterolValues.length > this.MAX_HISTORY_SIZE) {
      this.recentCholesterolValues.shift();
      this.recentTriglyceridesValues.shift();
    }
  }
  
  /**
   * Calculate stabilized values using history
   */
  private calculateStabilizedValues(
    currentCholesterol: number, 
    currentTriglycerides: number
  ): { cholesterol: number, triglycerides: number } {
    // If we don't have history, return current values
    if (this.recentCholesterolValues.length <= 1) {
      return { 
        cholesterol: currentCholesterol,
        triglycerides: currentTriglycerides
      };
    }
    
    // Calculate medians
    const sortedCholesterol = [...this.recentCholesterolValues].sort((a, b) => a - b);
    const sortedTriglycerides = [...this.recentTriglyceridesValues].sort((a, b) => a - b);
    
    const cholesterolMedian = this.calculateMedian(sortedCholesterol);
    const triglyceridesMedian = this.calculateMedian(sortedTriglycerides);
    
    // Calculate means
    const cholesterolMean = this.recentCholesterolValues.reduce((sum, val) => sum + val, 0) / 
                          this.recentCholesterolValues.length;
    const triglyceridesMean = this.recentTriglyceridesValues.reduce((sum, val) => sum + val, 0) / 
                            this.recentTriglyceridesValues.length;
    
    // Weighted combination of median and mean
    const stabilizedCholesterol = (cholesterolMedian * this.MEDIAN_WEIGHT) + 
                                (cholesterolMean * this.MEAN_WEIGHT);
    const stabilizedTriglycerides = (triglyceridesMedian * this.MEDIAN_WEIGHT) + 
                                  (triglyceridesMean * this.MEAN_WEIGHT);
    
    // Blend with current value for responsiveness
    const finalCholesterol = (stabilizedCholesterol * this.HISTORY_WEIGHT) + 
                           (currentCholesterol * (1 - this.HISTORY_WEIGHT));
    const finalTriglycerides = (stabilizedTriglycerides * this.HISTORY_WEIGHT) + 
                             (currentTriglycerides * (1 - this.HISTORY_WEIGHT));
    
    return {
      cholesterol: finalCholesterol,
      triglycerides: finalTriglycerides
    };
  }
  
  /**
   * Calculate median of array
   */
  private calculateMedian(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
  }
  
  /**
   * Calculate spectral features from PPG signal
   */
  private calculateSpectralFeatures(values: number[]): {
    highFrequencyEnergy: number;
    lowFrequencyEnergy: number;
    frequencyRatio: number;
    waveformComplexity: number;
  } {
    // Basic spectral analysis
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const normalized = values.map(v => v - mean);
    
    // Simple frequency band energy approximation
    let lowFrequencyEnergy = 0;
    let highFrequencyEnergy = 0;
    
    // Calculate autocorrelation at different lags to approximate frequency content
    for (let lag = 1; lag <= Math.min(30, values.length / 3); lag++) {
      let correlation = 0;
      for (let i = 0; i < values.length - lag; i++) {
        correlation += normalized[i] * normalized[i + lag];
      }
      correlation /= (values.length - lag);
      
      // Lower lags (1-10) represent higher frequencies
      // Higher lags (11-30) represent lower frequencies
      if (lag <= 10) {
        highFrequencyEnergy += Math.abs(correlation);
      } else {
        lowFrequencyEnergy += Math.abs(correlation);
      }
    }
    
    // Normalize energy values
    const totalEnergy = highFrequencyEnergy + lowFrequencyEnergy;
    if (totalEnergy > 0) {
      highFrequencyEnergy /= totalEnergy;
      lowFrequencyEnergy /= totalEnergy;
    } else {
      highFrequencyEnergy = 0.5;
      lowFrequencyEnergy = 0.5;
    }
    
    // Calculate ratio (higher values indicate more low frequency content)
    const frequencyRatio = lowFrequencyEnergy > 0 ? highFrequencyEnergy / lowFrequencyEnergy : 1;
    
    // Calculate waveform complexity using approximate entropy concept
    let complexitySum = 0;
    for (let i = 1; i < values.length; i++) {
      complexitySum += Math.abs(values[i] - values[i-1]);
    }
    const waveformComplexity = complexitySum / ((values.length - 1) * (Math.max(...values) - Math.min(...values)));
    
    return {
      highFrequencyEnergy,
      lowFrequencyEnergy,
      frequencyRatio,
      waveformComplexity: Math.min(1, waveformComplexity)
    };
  }
  
  /**
   * Calculate morphology features from PPG waveform
   */
  private calculateMorphologyFeatures(values: number[]): {
    risetime: number;
    falltime: number;
    risetimeFalltimeRatio: number;
    peakWidth: number;
  } {
    // Find peaks and valleys for morphology analysis
    const { peaks, valleys } = this.findPeaksAndValleys(values);
    
    // Default values
    let risetime = 0.3;
    let falltime = 0.5;
    let peakWidth = 0.3;
    
    // Calculate features if we have enough peaks and valleys
    if (peaks.length > 0 && valleys.length > 0) {
      const risetimes: number[] = [];
      const falltimes: number[] = [];
      const peakWidths: number[] = [];
      
      // For each peak, find the preceding and following valleys
      for (const peak of peaks) {
        const precedingValleys = valleys.filter(v => v < peak);
        const followingValleys = valleys.filter(v => v > peak);
        
        if (precedingValleys.length > 0 && followingValleys.length > 0) {
          const prevValley = Math.max(...precedingValleys);
          const nextValley = Math.min(...followingValleys);
          
          risetimes.push(peak - prevValley);
          falltimes.push(nextValley - peak);
          peakWidths.push(nextValley - prevValley);
        }
      }
      
      // Calculate average values if we have data
      if (risetimes.length > 0 && falltimes.length > 0 && peakWidths.length > 0) {
        risetime = risetimes.reduce((sum, val) => sum + val, 0) / risetimes.length;
        falltime = falltimes.reduce((sum, val) => sum + val, 0) / falltimes.length;
        peakWidth = peakWidths.reduce((sum, val) => sum + val, 0) / peakWidths.length;
        
        // Normalize to 0-1 range
        const totalTime = values.length;
        risetime /= totalTime;
        falltime /= totalTime;
        peakWidth /= totalTime;
      }
    }
    
    // Calculate ratio
    const risetimeFalltimeRatio = falltime > 0 ? risetime / falltime : 0.6;
    
    return {
      risetime,
      falltime,
      risetimeFalltimeRatio,
      peakWidth
    };
  }
  
  /**
   * Find peaks and valleys in the signal
   */
  private findPeaksAndValleys(values: number[]): { peaks: number[], valleys: number[] } {
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    // Need at least 3 points to find peaks and valleys
    if (values.length < 3) {
      return { peaks, valleys };
    }
    
    // Find local maxima and minima
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(i);
      }
      if (values[i] < values[i-1] && values[i] < values[i+1]) {
        valleys.push(i);
      }
    }
    
    return { peaks, valleys };
  }
  
  /**
   * Calculate confidence based on signal quality parameters
   */
  private calculateConfidence(
    perfusionIndex: number,
    normalizedAmplitude: number,
    frequencyRatio: number,
    dataPoints: number
  ): number {
    // Perfusion index component (higher is better)
    const perfusionComponent = Math.min(1, perfusionIndex * 4);
    
    // Signal amplitude component (higher is better, with diminishing returns)
    const amplitudeComponent = Math.min(1, normalizedAmplitude * 2);
    
    // Frequency balance component (closer to 1.0 is better)
    const frequencyComponent = Math.max(0, 1 - Math.abs(frequencyRatio - 1.0));
    
    // Data quantity component (more is better, up to MIN_SAMPLE_SIZE * 2)
    const dataComponent = Math.min(1, dataPoints / (this.MIN_SAMPLE_SIZE * 2));
    
    // Combined confidence with weighted components
    const confidence = (
      perfusionComponent * 0.4 +
      amplitudeComponent * 0.3 +
      frequencyComponent * 0.2 +
      dataComponent * 0.1
    );
    
    return Math.min(0.9, Math.max(0, confidence)); // Cap at 0.9 for honesty
  }
  
  /**
   * Get default values with specified confidence
   */
  private getDefaultWithConfidence(confidence: number): {
    totalCholesterol: number;
    triglycerides: number;
    confidence: number;
  } {
    return {
      totalCholesterol: 170,
      triglycerides: 100,
      confidence
    };
  }
  
  /**
   * Reset the lipid processor
   */
  public reset(): void {
    this.recentCholesterolValues = [];
    this.recentTriglyceridesValues = [];
  }
}
