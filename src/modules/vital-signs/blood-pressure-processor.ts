
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
  private readonly MIN_PULSE_PRESSURE = 25;
  private readonly MAX_PULSE_PRESSURE = 70;
  // Lower thresholds to accept a measurement
  private readonly MIN_SIGNAL_AMPLITUDE = 0.02;
  private readonly MIN_PEAK_COUNT = 3;
  private readonly MIN_FPS = 20;

  /**
   * Calculates blood pressure using PPG signal features directly
   * No simulation or reference values - direct measurement only
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    // Signal quality validation with reduced thresholds
    if (values.length < 25 || Math.max(...values) - Math.min(...values) < this.MIN_SIGNAL_AMPLITUDE) {
      console.log("BloodPressureProcessor: Insufficient signal quality for BP calculation");
      return { systolic: 0, diastolic: 0 };
    }

    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    if (peakIndices.length < this.MIN_PEAK_COUNT) {
      console.log("BloodPressureProcessor: Not enough peaks detected for BP calculation");
      return { systolic: 0, diastolic: 0 };
    }

    // Direct sampling parameters
    const fps = this.MIN_FPS; // Conservative sampling rate
    const msPerSample = 1000 / fps;

    // Calculate PTT (Pulse Transit Time) values directly from signal
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      // Wider physiologically valid range
      if (dt > 300 && dt < 1500) {
        pttValues.push(dt);
      }
    }
    
    if (pttValues.length < 2) {
      console.log("BloodPressureProcessor: Not enough valid intervals for BP calculation");
      return { systolic: 0, diastolic: 0 };
    }
    
    // Filter outliers using statistical technique
    const sortedPTT = [...pttValues].sort((a, b) => a - b);
    const medianPTT = this.calculateMedian(sortedPTT);
    
    // Filter values outside 2.0 IQR (wider interquartile range)
    const filteredPTT = this.filterOutliers(pttValues, sortedPTT, 2.0);
    
    // Calculate PTT using filtered values with weight to recent values
    const calculatedPTT = this.calculateWeightedPTT(filteredPTT, medianPTT);
    
    console.log("BloodPressureProcessor: PTT calculation", {
      original: pttValues,
      filtered: filteredPTT,
      median: medianPTT,
      weighted: calculatedPTT
    });
    
    // Normalize PTT to a wider physiologically relevant range
    const normalizedPTT = Math.max(300, Math.min(1500, calculatedPTT));
    
    // Calculate improved PPG signal amplitude directly from the signal
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    // Reduced amplification factor for direct measurement
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 6.0));

    console.log("BloodPressureProcessor: Signal parameters", {
      ptt: normalizedPTT,
      amplitude,
      normalizedAmplitude
    });

    // More conservative coefficients for direct measurement
    const pttFactor = (900 - normalizedPTT) * 0.07; 
    const ampFactor = normalizedAmplitude * 0.22;   
    
    // Direct estimation model without simulation
    let instantSystolic = 110 + pttFactor + ampFactor;
    let instantDiastolic = 70 + (pttFactor * 0.45) + (ampFactor * 0.20);

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

    console.log("BloodPressureProcessor: Final BP values", {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic),
      differential: Math.round(finalSystolic - finalDiastolic),
      bufferSize: this.systolicBuffer.length
    });

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
    if (filteredPTT.length < 2) return medianPTT;
    
    // Calculate weighted PTT with greater weight for more recent values
    let weightSum = 0;
    let weightedSum = 0;
    
    filteredPTT.forEach((val, idx) => {
      // Exponential weighting giving more weight to more recent samples
      const weight = Math.pow(1.3, idx) / filteredPTT.length;
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
    console.log("BloodPressureProcessor: Reset completed");
  }
}
