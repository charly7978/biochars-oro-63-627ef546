
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
  // Define valid physiological values
  private readonly MIN_SYSTOLIC = 90;
  private readonly MAX_SYSTOLIC = 170;
  private readonly MIN_DIASTOLIC = 60;
  private readonly MAX_DIASTOLIC = 100;
  private readonly MIN_PULSE_PRESSURE = 30;
  private readonly MAX_PULSE_PRESSURE = 60;
  // Minimum thresholds to accept a measurement
  private readonly MIN_SIGNAL_AMPLITUDE = 0.03;
  private readonly MIN_PEAK_COUNT = 4;
  private readonly MIN_FPS = 20;

  /**
   * Calculates blood pressure using PPG signal features
   * Implements a median and weighted average approach for greater accuracy
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    // Signal quality validation
    if (values.length < 30 || Math.max(...values) - Math.min(...values) < this.MIN_SIGNAL_AMPLITUDE) {
      return { systolic: 0, diastolic: 0 };
    }

    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    if (peakIndices.length < this.MIN_PEAK_COUNT) {
      return { systolic: 0, diastolic: 0 };
    }

    // Sampling parameters
    const fps = this.MIN_FPS; // Conservative sampling rate
    const msPerSample = 1000 / fps;

    // Calculate PTT (Pulse Transit Time) values with greater precision
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      // Stricter physiologically valid range
      if (dt > 400 && dt < 1200) {
        pttValues.push(dt);
      }
    }
    
    // Filter outliers using statistical technique
    const sortedPTT = [...pttValues].sort((a, b) => a - b);
    const medianPTT = this.calculateMedian(sortedPTT);
    
    // Filter values outside 1.5 IQR (interquartile range)
    const filteredPTT = this.filterOutliers(pttValues, sortedPTT);
    
    // Calculate PTT using filtered values
    const calculatedPTT = this.calculateWeightedPTT(filteredPTT, medianPTT);
    
    // Normalize PTT to a physiologically relevant range
    const normalizedPTT = Math.max(500, Math.min(1100, calculatedPTT));
    
    // Calculate improved PPG signal amplitude
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    // Lower amplification factor to avoid overestimation
    const normalizedAmplitude = Math.min(80, Math.max(0, amplitude * 5.0));

    // More conservative coefficients based on validation studies
    const pttFactor = (800 - normalizedPTT) * 0.09; // Reduced from 0.11
    const ampFactor = normalizedAmplitude * 0.25;   // Reduced from 0.38
    
    // Use a more conservative estimation model
    let instantSystolic = 115 + pttFactor + ampFactor;
    let instantDiastolic = 75 + (pttFactor * 0.55) + (ampFactor * 0.25);

    // Apply physiological limits
    instantSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, instantSystolic));
    instantDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, instantDiastolic));
    
    // Maintain physiologically valid pressure differential
    const differential = instantSystolic - instantDiastolic;
    if (differential < this.MIN_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MIN_PULSE_PRESSURE;
    } else if (differential > this.MAX_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MAX_PULSE_PRESSURE;
    }
    
    // Check physiological limits again after differential adjustment
    instantDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, instantDiastolic));

    // Update pressure buffers with new values
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    // Mantener tamaño de buffer limitado
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    // Calculate final blood pressure values
    const { finalSystolic, finalDiastolic } = this.calculateFinalValues();

    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
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
   * Filter outliers using IQR method
   */
  private filterOutliers(values: number[], sortedValues: number[]): number[] {
    if (sortedValues.length < 4) return values;
    
    const q1Index = Math.floor(sortedValues.length / 4);
    const q3Index = Math.floor(3 * sortedValues.length / 4);
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return values.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Calculate weighted PTT value
   */
  private calculateWeightedPTT(filteredPTT: number[], medianPTT: number): number {
    if (filteredPTT.length < 3) return medianPTT;
    
    // Calculate weighted PTT with greater weight for more recent values
    let weightSum = 0;
    let weightedSum = 0;
    
    filteredPTT.forEach((val, idx) => {
      // Exponential weighting giving more weight to more recent samples
      const weight = Math.pow(1.2, idx) / filteredPTT.length;
      weightedSum += val * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : medianPTT;
  }
  
  /**
   * Calculate final blood pressure values using median and weighted average
   */
  private calculateFinalValues(): { finalSystolic: number, finalDiastolic: number } {
    if (this.systolicBuffer.length === 0) {
      return { finalSystolic: 0, finalDiastolic: 0 };
    }
    
    // 1. Calculate medians
    const sortedSystolic = [...this.systolicBuffer].sort((a, b) => a - b);
    const sortedDiastolic = [...this.diastolicBuffer].sort((a, b) => a - b);
    
    const systolicMedian = this.calculateMedian(sortedSystolic);
    const diastolicMedian = this.calculateMedian(sortedDiastolic);
    
    // 2. Calculate averages
    const systolicMean = this.systolicBuffer.reduce((sum, val) => sum + val, 0) / this.systolicBuffer.length;
    const diastolicMean = this.diastolicBuffer.reduce((sum, val) => sum + val, 0) / this.diastolicBuffer.length;
    
    // 3. Apply weighting between median and average
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
    finalDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, finalDiastolic));
    
    return { finalSystolic, finalDiastolic };
  }
  
  /**
   * Reset the blood pressure processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }
}
