
export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  map?: number;
  confidence?: number;
}

export class BloodPressureAnalyzer {
  private readonly BP_BUFFER_SIZE = 15;
  private readonly MEDIAN_WEIGHT = 0.6;
  
  // Enhanced signal processing parameters
  private ppgBuffer: number[][] = []; // Buffer to store recent signals
  private readonly FEATURE_WEIGHT = {
    signalAmplitude: 0.25,
    peakDistribution: 0.3,
    valleyDepth: 0.2,
    waveformArea: 0.25
  };
  
  // Calibration parameters
  private lastBpEstimate: BloodPressureResult | null = null;
  private calibrationCounter: number = 0;
  private readonly CALIBRATION_INTERVAL = 50; // calibrate every 50 measurements
  private calibrationOffset: { systolic: number, diastolic: number } = { systolic: 0, diastolic: 0 };

  /**
   * Calculate blood pressure using ONLY real PPG signal data
   * Enhanced with detailed waveform analysis and adaptive calibration
   */
  public calculateBloodPressure(ppgSignal: number[]): BloodPressureResult {
    // Verificaciones de seguridad para señal insuficiente
    if (ppgSignal.length < 30) {
      return { systolic: 0, diastolic: 0, confidence: 0 };
    }

    // Store signal in buffer for trend analysis
    this.updateSignalBuffer(ppgSignal);
    
    // Extract comprehensive features from the waveform
    const features = this.extractSignalFeatures(ppgSignal);
    
    // Analysis of characteristics from the real signal
    const signalMin = features.minValue;
    const signalMax = features.maxValue;
    const signalRange = signalMax - signalMin;
    const signalMean = features.meanValue;

    // Advanced physiological factors calculation
    const signalAmplitude = signalRange;
    const signalVariability = this.calculateSignalVariability(ppgSignal);
    const waveformCharacteristics = this.analyzeWaveformMorphology(ppgSignal, features);

    // Enhanced bp calculation using multiple signal features
    const systolic = this.calculateSystolic(
      ppgSignal, 
      signalMean, 
      signalAmplitude, 
      features, 
      waveformCharacteristics
    );
    
    const diastolic = this.calculateDiastolic(
      ppgSignal, 
      signalMean, 
      signalVariability, 
      features, 
      waveformCharacteristics
    );

    // Apply adaptive calibration if needed
    const calibratedResult = this.applyCalibration({ systolic, diastolic });
    
    // Calculate confidence based on signal quality and physiological validity
    const confidence = this.calculateConfidence(ppgSignal, calibratedResult.systolic, calibratedResult.diastolic, features);
    
    // Calculate MAP (Mean Arterial Pressure)
    const map = Math.round((calibratedResult.systolic + 2 * calibratedResult.diastolic) / 3);

    // Store last estimate for trend analysis
    this.lastBpEstimate = { 
      systolic: calibratedResult.systolic, 
      diastolic: calibratedResult.diastolic,
      map,
      confidence
    };
    
    // Increment calibration counter
    this.calibrationCounter++;
    if (this.calibrationCounter >= this.CALIBRATION_INTERVAL) {
      this.updateCalibration();
      this.calibrationCounter = 0;
    }

    return { 
      systolic: Math.round(calibratedResult.systolic), 
      diastolic: Math.round(calibratedResult.diastolic), 
      map,
      confidence 
    };
  }
  
  /**
   * Store signal in buffer for trend analysis
   */
  private updateSignalBuffer(signal: number[]): void {
    this.ppgBuffer.push([...signal]);
    if (this.ppgBuffer.length > this.BP_BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }
  }
  
  /**
   * Extract comprehensive features from PPG waveform
   */
  private extractSignalFeatures(signal: number[]): {
    minValue: number;
    maxValue: number;
    meanValue: number;
    peakIndices: number[];
    valleyIndices: number[];
    pulseInterval: number;
    riseTimes: number[];
    fallTimes: number[];
    areaUnderCurve: number;
  } {
    // Basic statistics
    const minValue = Math.min(...signal);
    const maxValue = Math.max(...signal);
    const meanValue = signal.reduce((a, b) => a + b, 0) / signal.length;
    
    // Peak and valley detection
    const peakIndices = this.findPeaks(signal);
    const valleyIndices = this.findValleys(signal);
    
    // Calculate pulse interval (time between peaks)
    let pulseInterval = 0;
    if (peakIndices.length >= 2) {
      const intervals = [];
      for (let i = 1; i < peakIndices.length; i++) {
        intervals.push(peakIndices[i] - peakIndices[i-1]);
      }
      pulseInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
    
    // Calculate rise and fall times
    const riseTimes: number[] = [];
    const fallTimes: number[] = [];
    
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIdx = peakIndices[i];
      
      // Find preceding valley
      let prevValleyIdx = -1;
      for (let j = valleyIndices.length - 1; j >= 0; j--) {
        if (valleyIndices[j] < peakIdx) {
          prevValleyIdx = valleyIndices[j];
          break;
        }
      }
      
      // Find following valley
      let nextValleyIdx = -1;
      for (let j = 0; j < valleyIndices.length; j++) {
        if (valleyIndices[j] > peakIdx) {
          nextValleyIdx = valleyIndices[j];
          break;
        }
      }
      
      // Calculate rise and fall times if valleys were found
      if (prevValleyIdx >= 0) {
        riseTimes.push(peakIdx - prevValleyIdx);
      }
      
      if (nextValleyIdx >= 0) {
        fallTimes.push(nextValleyIdx - peakIdx);
      }
    }
    
    // Calculate area under curve (simplified)
    const baseline = minValue;
    const areaUnderCurve = signal.reduce((sum, val) => sum + (val - baseline), 0);
    
    return {
      minValue,
      maxValue,
      meanValue,
      peakIndices,
      valleyIndices,
      pulseInterval,
      riseTimes,
      fallTimes,
      areaUnderCurve
    };
  }
  
  /**
   * Analyze waveform morphology for BP estimation
   */
  private analyzeWaveformMorphology(signal: number[], features: any): {
    dicroticNotchStrength: number;
    waveformSymmetry: number;
    peakSharpness: number;
  } {
    // Default values
    let dicroticNotchStrength = 0;
    let waveformSymmetry = 0.5;
    let peakSharpness = 0.5;
    
    // Calculate dicrotic notch strength
    if (features.peakIndices.length > 0 && features.valleyIndices.length > 0) {
      const peakValues = features.peakIndices.map((idx: number) => signal[idx]);
      const valleyValues = features.valleyIndices.map((idx: number) => signal[idx]);
      
      const avgPeakValue = peakValues.reduce((a: number, b: number) => a + b, 0) / peakValues.length;
      const avgValleyValue = valleyValues.reduce((a: number, b: number) => a + b, 0) / valleyValues.length;
      
      // Check for secondary peaks (dicrotic notch)
      for (let i = 0; i < features.peakIndices.length - 1; i++) {
        const currentPeakIdx = features.peakIndices[i];
        const nextPeakIdx = features.peakIndices[i + 1];
        
        // Look for a smaller peak between two main peaks
        for (let j = currentPeakIdx + 1; j < nextPeakIdx; j++) {
          // Calculate height ratio of potential dicrotic notch
          const heightRatio = (signal[j] - avgValleyValue) / (avgPeakValue - avgValleyValue);
          
          // If height is between 0.1 and 0.5 of the main peak, consider it a dicrotic notch
          if (heightRatio > 0.1 && heightRatio < 0.5) {
            dicroticNotchStrength = Math.max(dicroticNotchStrength, heightRatio);
          }
        }
      }
    }
    
    // Calculate waveform symmetry
    if (features.riseTimes.length > 0 && features.fallTimes.length > 0) {
      const avgRiseTime = features.riseTimes.reduce((a: number, b: number) => a + b, 0) / features.riseTimes.length;
      const avgFallTime = features.fallTimes.reduce((a: number, b: number) => a + b, 0) / features.fallTimes.length;
      
      // Symmetry: 0.5 means perfect symmetry
      // Higher values mean slower fall than rise
      waveformSymmetry = avgFallTime / (avgRiseTime + avgFallTime);
    }
    
    // Calculate peak sharpness
    if (features.peakIndices.length > 0) {
      let totalSharpness = 0;
      let count = 0;
      
      for (const peakIdx of features.peakIndices) {
        if (peakIdx > 0 && peakIdx < signal.length - 1) {
          // Use second derivative to estimate peak sharpness
          const secondDerivative = (signal[peakIdx+1] - 2*signal[peakIdx] + signal[peakIdx-1]);
          totalSharpness += Math.abs(secondDerivative);
          count++;
        }
      }
      
      if (count > 0) {
        // Normalize to 0-1 range (estimation)
        peakSharpness = Math.min(1, Math.max(0, totalSharpness / count / 2));
      }
    }
    
    return {
      dicroticNotchStrength,
      waveformSymmetry,
      peakSharpness
    };
  }

  /**
   * Enhanced systolic calculation with multiple features
   */
  private calculateSystolic(
    signal: number[], 
    mean: number, 
    amplitude: number,
    features: any,
    morphology: any
  ): number {
    // Base calculation from amplitude ratio
    const amplitudeComponent = 90 + (amplitude / mean) * 40;
    
    // Morphology contribution to systolic
    // Higher peak sharpness and asymmetry (faster rise, slower fall) often correlate with higher systolic
    const morphologyComponent = 
      (morphology.peakSharpness * 15) + 
      ((morphology.waveformSymmetry - 0.5) * 30);
    
    // Temporal features
    // Faster pulse correlates with higher systolic
    let pulseComponent = 0;
    if (features.pulseInterval > 0) {
      // Convert to approximate BPM
      const approxBPM = 60 / (features.pulseInterval / 30);  // Assuming 30 Hz
      pulseComponent = (approxBPM - 70) * 0.3;  // 0.3 mmHg per BPM above 70
    }
    
    // Dicrotic notch contribution - stronger notch often indicates better arterial elasticity
    const dicroticComponent = morphology.dicroticNotchStrength * -10;  // Negative influence
    
    // Combine all components
    const weightedSystolic = 
      (amplitudeComponent * this.FEATURE_WEIGHT.signalAmplitude) +
      (morphologyComponent * this.FEATURE_WEIGHT.peakDistribution) +
      (pulseComponent * 0.1) +
      (dicroticComponent * 0.1);
    
    // Ensure physiological range
    return Math.min(180, Math.max(90, weightedSystolic));
  }

  /**
   * Enhanced diastolic calculation with multiple features
   */
  private calculateDiastolic(
    signal: number[], 
    mean: number, 
    variability: number,
    features: any,
    morphology: any
  ): number {
    // Base calculation from variability ratio
    const variabilityComponent = 60 + (1 - variability/mean) * 20;
    
    // Morphology contribution to diastolic
    // Dicrotic notch position and strength correlate with diastolic
    const morphologyComponent = morphology.dicroticNotchStrength * 15;
    
    // Temporal features
    let pulseComponent = 0;
    if (features.pulseInterval > 0) {
      // Convert to approximate BPM
      const approxBPM = 60 / (features.pulseInterval / 30);  // Assuming 30 Hz
      pulseComponent = (approxBPM - 70) * 0.2;  // 0.2 mmHg per BPM above 70
    }
    
    // Valley depth influence
    const valleyComponent = (features.meanValue - features.minValue) * 0.4;
    
    // Combine all components
    const weightedDiastolic = 
      (variabilityComponent * 0.4) +
      (morphologyComponent * 0.2) +
      (pulseComponent * 0.1) +
      (valleyComponent * this.FEATURE_WEIGHT.valleyDepth);
    
    // Ensure physiological range
    return Math.min(110, Math.max(50, weightedDiastolic));
  }

  /**
   * Apply adaptive calibration based on physiological feedback
   */
  private applyCalibration(result: { systolic: number, diastolic: number }): { systolic: number, diastolic: number } {
    return {
      systolic: result.systolic + this.calibrationOffset.systolic,
      diastolic: result.diastolic + this.calibrationOffset.diastolic
    };
  }
  
  /**
   * Update calibration based on trend analysis
   */
  private updateCalibration(): void {
    // Analyze trend from buffer 
    if (this.ppgBuffer.length < 5) return;
    
    // Simple detection of significant shifts in pattern
    const recentAmplitudes = this.ppgBuffer.slice(-5).map(signal => 
      Math.max(...signal) - Math.min(...signal)
    );
    const avgAmplitude = recentAmplitudes.reduce((a, b) => a + b, 0) / recentAmplitudes.length;
    
    // Adjust calibration based on amplitude trends
    // This is a simplified approach - a real calibration would be more complex
    if (avgAmplitude > 0) {
      const amplitudeRatio = avgAmplitude / recentAmplitudes[0];
      
      if (Math.abs(amplitudeRatio - 1) > 0.2) {
        // Signal characteristics have changed, adjust calibration
        this.calibrationOffset.systolic += (amplitudeRatio - 1) * 2;
        this.calibrationOffset.diastolic += (amplitudeRatio - 1) * 1;
        
        // Limit adjustments to reasonable ranges
        this.calibrationOffset.systolic = Math.max(-10, Math.min(10, this.calibrationOffset.systolic));
        this.calibrationOffset.diastolic = Math.max(-5, Math.min(5, this.calibrationOffset.diastolic));
        
        console.log("BloodPressureAnalyzer: Calibration adjusted", {
          amplitudeRatio,
          newOffset: this.calibrationOffset
        });
      }
    }
  }

  private calculateSignalVariability(signal: number[]): number {
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    return Math.sqrt(variance);
  }

  private findPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  private findValleys(signal: number[]): number[] {
    const valleys: number[] = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] < signal[i - 1] && signal[i] < signal[i + 1]) {
        valleys.push(i);
      }
    }
    return valleys;
  }

  /**
   * Enhanced confidence calculation with multiple quality metrics
   */
  private calculateConfidence(signal: number[], systolic: number, diastolic: number, features: any): number {
    // Signal quality metrics
    const signalStability = this.calculateSignalVariability(signal);
    const rangeFactor = Math.abs(systolic - diastolic) / 30;
    
    // Calculate peak regularity
    let peakRegularity = 0.5;
    if (features.peakIndices.length >= 3) {
      const intervals = [];
      for (let i = 1; i < features.peakIndices.length; i++) {
        intervals.push(features.peakIndices[i] - features.peakIndices[i-1]);
      }
      
      // Calculate coefficient of variation of intervals
      const mean = intervals.reduce((a: number, b: number) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / intervals.length;
      const cv = Math.sqrt(variance) / mean;
      
      // Lower CV means more regular peaks, which indicates higher quality
      peakRegularity = Math.max(0, 1 - cv);
    }
    
    // Calculate waveform consistency
    let waveformConsistency = 0.5;
    if (this.ppgBuffer.length >= 3) {
      // Compare current signal with previous ones
      const currentSignal = signal;
      const previousSignals = this.ppgBuffer.slice(-3, -1);
      
      let totalCorrelation = 0;
      for (const prevSignal of previousSignals) {
        // Use a simplified correlation measure
        const minLength = Math.min(currentSignal.length, prevSignal.length);
        let correlation = 0;
        
        if (minLength > 10) {
          // Use only the first portion that matches
          const current = currentSignal.slice(0, minLength);
          const previous = prevSignal.slice(0, minLength);
          
          // Normalize signals
          const currentMean = current.reduce((a, b) => a + b, 0) / minLength;
          const previousMean = previous.reduce((a, b) => a + b, 0) / minLength;
          
          const currentNorm = current.map(v => v - currentMean);
          const previousNorm = previous.map(v => v - previousMean);
          
          // Calculate correlation
          let numerator = 0;
          let denomCurrent = 0;
          let denomPrevious = 0;
          
          for (let i = 0; i < minLength; i++) {
            numerator += currentNorm[i] * previousNorm[i];
            denomCurrent += currentNorm[i] * currentNorm[i];
            denomPrevious += previousNorm[i] * previousNorm[i];
          }
          
          if (denomCurrent > 0 && denomPrevious > 0) {
            correlation = numerator / Math.sqrt(denomCurrent * denomPrevious);
            correlation = Math.abs(correlation); // We care about the magnitude of correlation
          }
        }
        
        totalCorrelation += correlation;
      }
      
      // Average correlation across previous signals
      waveformConsistency = previousSignals.length > 0 ? 
        totalCorrelation / previousSignals.length : 0.5;
    }
    
    // Physiological validity check
    const pulsePress = systolic - diastolic;
    const isPhysiologicallyValid = 
      systolic >= 90 && systolic <= 180 &&
      diastolic >= 50 && diastolic <= 110 &&
      pulsePress >= 20 && pulsePress <= 60;
    
    const physiologicalFactor = isPhysiologicallyValid ? 1.0 : 0.5;
    
    // Calculate combined confidence
    // Weight factors add up to 1.0
    const confidence = (
      (1 - (signalStability / (systolic + diastolic)) * rangeFactor) * 0.3 + // Signal stability
      peakRegularity * 0.3 + // Peak regularity
      waveformConsistency * 0.2 + // Waveform consistency
      physiologicalFactor * 0.2 // Physiological validity
    );
    
    return Math.max(0, Math.min(1, confidence));
  }

  public reset(): void {
    this.ppgBuffer = [];
    this.lastBpEstimate = null;
    this.calibrationCounter = 0;
    this.calibrationOffset = { systolic: 0, diastolic: 0 };
    console.log("BloodPressureAnalyzer: Reset - preparado para nuevas mediciones");
  }
}
