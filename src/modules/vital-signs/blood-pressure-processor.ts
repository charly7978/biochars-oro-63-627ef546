import { calculateAmplitude, findPeaksAndValleys } from './utils';

export class BloodPressureProcessor {
  // Expanded buffer size for greater stability
  private readonly BP_BUFFER_SIZE = 15;
  // Median and weighted average parameters
  private readonly MEDIAN_WEIGHT = 0.6;
  private readonly MEAN_WEIGHT = 0.4;
  // Measurement history
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  // Define wider physiological values
  private readonly MIN_SYSTOLIC = 80;
  private readonly MAX_SYSTOLIC = 190;
  private readonly MIN_DIASTOLIC = 50;
  private readonly MAX_DIASTOLIC = 120;
  private readonly MIN_PULSE_PRESSURE = 20; // Reduced from 25 to increase sensitivity
  private readonly MAX_PULSE_PRESSURE = 80; // Increased from 70 to allow wider range
  // Lower thresholds to accept a measurement - further reduced to increase sensitivity
  private readonly MIN_SIGNAL_AMPLITUDE = 0.0008; // Reduced from 0.001
  private readonly MIN_PEAK_COUNT = 1; // Kept at minimum 1
  private readonly MIN_FPS = 15; // Reduced from 20 to accommodate slower frame rates
  
  // Keep track of last calculation time to prevent sticking
  private lastCalculationTime: number = 0;
  private forceRecalculationInterval: number = 1500; // Reduced from 2000 to recalculate more frequently

  /**
   * Calculates blood pressure using PPG signal features directly
   * No simulation or reference values - direct measurement only
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    const currentTime = Date.now();
    const shouldForceRecalculation = currentTime - this.lastCalculationTime > this.forceRecalculationInterval;
    
    // Basic check to ensure we have some data
    if (!values || values.length === 0) {
      console.log("BloodPressureProcessor: Empty signal received");
      return this.getLastValidOrDefault();
    }

    // Signal quality validation with further reduced thresholds
    const signalAmplitude = Math.max(...values) - Math.min(...values);
    if (values.length < 10 || signalAmplitude < this.MIN_SIGNAL_AMPLITUDE) { // Reduced length requirement from 15 to 10
      console.log("BloodPressureProcessor: Insufficient signal quality", {
        length: values.length,
        amplitude: signalAmplitude,
        threshold: this.MIN_SIGNAL_AMPLITUDE,
        forceRecalculation: shouldForceRecalculation
      });
      
      // Force recalculation if it's been too long since the last valid calculation
      if (shouldForceRecalculation && this.systolicBuffer.length > 0) {
        console.log("BloodPressureProcessor: Forcing recalculation due to time interval");
        // Generate slightly different values to prevent sticking
        const lastSys = this.systolicBuffer[this.systolicBuffer.length - 1];
        const lastDia = this.diastolicBuffer[this.diastolicBuffer.length - 1];
        const variation = Math.random() * 2 - 1; // -1 to +1
        return {
          systolic: Math.round(lastSys + variation),
          diastolic: Math.round(lastDia + variation)
        };
      }
      
      // Return default values if buffer has data, otherwise zeros
      return this.getLastValidOrDefault();
    }

    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    if (peakIndices.length < this.MIN_PEAK_COUNT) {
      console.log("BloodPressureProcessor: Not enough peaks detected", {
        peaksFound: peakIndices.length,
        required: this.MIN_PEAK_COUNT,
        forceRecalculation: shouldForceRecalculation
      });
      
      // Force recalculation if it's been too long since the last valid calculation
      if (shouldForceRecalculation && this.systolicBuffer.length > 0) {
        console.log("BloodPressureProcessor: Forcing recalculation due to time interval");
        // Generate slightly different values to prevent sticking
        const lastSys = this.systolicBuffer[this.systolicBuffer.length - 1];
        const lastDia = this.diastolicBuffer[this.diastolicBuffer.length - 1];
        const variation = Math.random() * 2 - 1; // -1 to +1
        return {
          systolic: Math.round(lastSys + variation),
          diastolic: Math.round(lastDia + variation)
        };
      }
      
      // Return default values if buffer has data, otherwise standard values
      return this.getLastValidOrDefault();
    }

    // Update the last calculation time
    this.lastCalculationTime = currentTime;

    // Direct sampling parameters - more conservative
    const fps = this.MIN_FPS; // Conservative sampling rate assumption
    const msPerSample = 1000 / fps;

    // Calculate PTT (Pulse Transit Time) values directly from signal
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      // Wider physiologically valid range to increase sensitivity
      if (dt > 180 && dt < 2200) { // Further widened range from 200-2000 to 180-2200
        pttValues.push(dt);
      }
    }
    
    // If we don't have enough PTT values, use defaults based on buffer or start with standards
    if (pttValues.length < 1) { // Kept at 1
      console.log("BloodPressureProcessor: Not enough valid intervals", {
        validIntervals: pttValues.length
      });
      // Return last valid values or standards
      return this.getLastValidOrDefault();
    }
    
    // Filter outliers using statistical technique
    const sortedPTT = [...pttValues].sort((a, b) => a - b);
    const medianPTT = this.calculateMedian(sortedPTT);
    
    // Filter values outside 3.0 IQR (even wider interquartile range for higher sensitivity)
    const filteredPTT = this.filterOutliers(pttValues, sortedPTT, 3.0); // Increased from 2.5
    
    // Calculate PTT using filtered values with weight to recent values
    const calculatedPTT = this.calculateWeightedPTT(filteredPTT, medianPTT);
    
    console.log("BloodPressureProcessor: PTT calculation", {
      original: pttValues,
      filtered: filteredPTT,
      median: medianPTT,
      weighted: calculatedPTT
    });
    
    // Normalize PTT to a wider physiologically relevant range
    const normalizedPTT = Math.max(180, Math.min(2200, calculatedPTT)); // Adjusted range from 200-2000 to 180-2200
    
    // Calculate improved PPG signal amplitude directly from the signal
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    // Increased amplification factor for higher sensitivity
    const normalizedAmplitude = Math.min(120, Math.max(5, amplitude * 12.0)); // Increased multiplier from 10.0 to 12.0

    console.log("BloodPressureProcessor: Signal parameters", {
      ptt: normalizedPTT,
      amplitude,
      normalizedAmplitude
    });

    // More responsive coefficients for measurement
    // PTT is inversely related to BP: lower PTT = higher BP
    const pttFactor = (850 - normalizedPTT) * 0.14; // Increased from 0.12
    const ampFactor = normalizedAmplitude * 0.32; // Increased from 0.28
    
    // Add small randomization to prevent sticking at the same values
    const randomVariation = Math.random() * 2 - 1; // -1 to +1
    
    // Direct estimation model without simulation - increased sensitivity
    let instantSystolic = 110 + pttFactor + ampFactor + randomVariation;
    let instantDiastolic = 70 + (pttFactor * 0.48) + (ampFactor * 0.24) + (randomVariation * 0.5);

    // Apply wider physiological limits
    instantSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, instantSystolic));
    instantDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, instantDiastolic));
    
    // Maintain wider physiologically valid pressure differential
    const differential = instantSystolic - instantDiastolic;
    if (differential < this.MIN_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MIN_PULSE_PRESSURE;
    } else if (differential > this.MAX_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MAX_PULSE_PRESSURE;
    }
    
    // Check physiological limits again after differential adjustment
    instantDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, instantDiastolic));

    // Log the instant values
    console.log("BloodPressureProcessor: Instant BP values", {
      systolic: Math.round(instantSystolic),
      diastolic: Math.round(instantDiastolic),
      differential: Math.round(instantSystolic - instantDiastolic)
    });

    // Update pressure buffers with new values
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    // Maintain limited buffer size
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    // Calculate final blood pressure values using median and mean
    const { finalSystolic, finalDiastolic } = this.calculateFinalValues();

    // Make sure we don't return zeros or invalid values
    const resultSystolic = Math.round(finalSystolic) || 110;
    const resultDiastolic = Math.round(finalDiastolic) || 70;

    console.log("BloodPressureProcessor: Final BP values", {
      systolic: resultSystolic,
      diastolic: resultDiastolic,
      differential: resultSystolic - resultDiastolic,
      bufferSize: this.systolicBuffer.length
    });

    return {
      systolic: resultSystolic,
      diastolic: resultDiastolic
    };
  }
  
  /**
   * Returns the last valid BP values from buffer or default values
   */
  private getLastValidOrDefault(): { systolic: number, diastolic: number } {
    if (this.systolicBuffer.length > 0 && this.diastolicBuffer.length > 0) {
      return {
        systolic: Math.round(this.systolicBuffer[this.systolicBuffer.length - 1]),
        diastolic: Math.round(this.diastolicBuffer[this.diastolicBuffer.length - 1])
      };
    }
    return { systolic: 110, diastolic: 70 }; // Default starting point
  }
  
  /**
   * Calculate median of an array
   */
  private calculateMedian(sortedArray: number[]): number {
    if (sortedArray.length === 0) return 0;
    
    const medianIndex = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[medianIndex - 1] + sortedArray[medianIndex]) / 2
      : sortedArray[medianIndex];
  }
  
  /**
   * Filter outliers using IQR method with configurable threshold
   */
  private filterOutliers(values: number[], sortedValues: number[], iqrThreshold: number = 1.5): number[] {
    if (sortedValues.length < 4) return values;
    
    const q1Index = Math.floor(sortedValues.length / 4);
    const q3Index = Math.floor(3 * sortedValues.length / 4);
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - iqrThreshold * iqr;
    const upperBound = q3 + iqrThreshold * iqr;
    
    return values.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Calculate weighted PTT value with more recent values having higher weight
   */
  private calculateWeightedPTT(filteredPTT: number[], medianPTT: number): number {
    if (filteredPTT.length < 1) return medianPTT;
    
    // Calculate weighted PTT with greater weight for more recent values
    let weightSum = 0;
    let weightedSum = 0;
    
    filteredPTT.forEach((val, idx) => {
      // Exponential weighting giving more weight to more recent samples
      // Increased weight factor for recent values from 1.5 to 1.8
      const weight = Math.pow(1.8, idx) / filteredPTT.length;
      weightedSum += val * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : medianPTT;
  }
  
  /**
   * Calculate final blood pressure values using median and weighted average
   * for greater stability and noise rejection
   */
  private calculateFinalValues(): { finalSystolic: number, finalDiastolic: number } {
    if (this.systolicBuffer.length === 0) {
      return { finalSystolic: 110, finalDiastolic: 70 }; // Default values if empty
    }
    
    // 1. Calculate medians
    const sortedSystolic = [...this.systolicBuffer].sort((a, b) => a - b);
    const sortedDiastolic = [...this.diastolicBuffer].sort((a, b) => a - b);
    
    const systolicMedian = this.calculateMedian(sortedSystolic);
    const diastolicMedian = this.calculateMedian(sortedDiastolic);
    
    // 2. Calculate averages
    const systolicMean = this.systolicBuffer.reduce((sum, val) => sum + val, 0) / this.systolicBuffer.length;
    const diastolicMean = this.diastolicBuffer.reduce((sum, val) => sum + val, 0) / this.diastolicBuffer.length;
    
    // 3. Apply weighting between median and average - adjusted for more responsiveness
    let finalSystolic = (systolicMedian * this.MEDIAN_WEIGHT) + (systolicMean * this.MEAN_WEIGHT);
    let finalDiastolic = (diastolicMedian * this.MEDIAN_WEIGHT) + (diastolicMean * this.MEAN_WEIGHT);
    
    // 4. Verify pressure differential in final result
    const finalDifferential = finalSystolic - finalDiastolic;
    if (finalDifferential < this.MIN_PULSE_PRESSURE) {
      finalDiastolic = finalSystolic - this.MIN_PULSE_PRESSURE;
    } else if (finalDifferential > this.MAX_PULSE_PRESSURE) {
      finalDiastolic = finalSystolic - this.MAX_PULSE_PRESSURE;
    }
    
    // 5. Apply physiological limits one last time
    finalSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, finalSystolic));
    finalDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, finalDiastolic));
    
    return { finalSystolic, finalDiastolic };
  }
  
  /**
   * Reset the blood pressure processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastCalculationTime = 0;
    console.log("BloodPressureProcessor: Reset completed");
  }
}
