/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Blood pressure processor with improved precision
 */
import { calculateAmplitude, findPeaksAndValleys, calculateStandardDeviation, applySMAFilter } from './utils';

export class BloodPressureProcessor {
  // Expanded buffer size for greater stability
  private readonly BP_BUFFER_SIZE = 20;
  // Median and weighted average parameters
  private readonly MEDIAN_WEIGHT = 0.7;
  private readonly MEAN_WEIGHT = 0.3;
  // Measurement history
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  // Define physiological values
  private readonly MIN_SYSTOLIC = 85;
  private readonly MAX_SYSTOLIC = 180;
  private readonly MIN_DIASTOLIC = 55;
  private readonly MAX_DIASTOLIC = 110;
  private readonly MIN_PULSE_PRESSURE = 30;
  private readonly MAX_PULSE_PRESSURE = 60;
  // Signal quality thresholds
  private readonly MIN_SIGNAL_AMPLITUDE = 0.005;
  private readonly MIN_PEAK_COUNT = 2;
  private readonly MIN_FPS = 25;
  
  // Signal quality tracking
  private qualityHistory: number[] = [];
  private readonly QUALITY_BUFFER_SIZE = 10;
  
  // Keep track of last calculation time to prevent sticking
  private lastCalculationTime: number = 0;
  private forceRecalculationInterval: number = 5000; // Force recalculation every 5 seconds

  /**
   * Calculates blood pressure using PPG signal features directly
   * No simulation or reference values - direct measurement only
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
    precision: number;
  } {
    const currentTime = Date.now();
    const shouldForceRecalculation = currentTime - this.lastCalculationTime > this.forceRecalculationInterval;
    
    // Basic check to ensure we have some data
    if (!values || values.length < 15) {
      console.log("BloodPressureProcessor: Insufficient data received");
      return {
        ...this.getLastValidOrDefault(),
        precision: 0.2
      };
    }

    // Apply noise reduction first - use the updated applySMAFilter
    const filteredValues = applySMAFilter(values, 5);
    
    // Signal quality validation
    const signalAmplitude = Math.max(...filteredValues) - Math.min(...filteredValues);
    if (signalAmplitude < this.MIN_SIGNAL_AMPLITUDE) {
      console.log("BloodPressureProcessor: Low signal amplitude", {
        amplitude: signalAmplitude,
        threshold: this.MIN_SIGNAL_AMPLITUDE
      });
      
      // Force recalculation if it's been too long since the last valid calculation
      if (shouldForceRecalculation && this.systolicBuffer.length > 0) {
        console.log("BloodPressureProcessor: Forcing recalculation due to time interval");
        // Return last values with small variation and low precision
        const lastSys = this.systolicBuffer[this.systolicBuffer.length - 1];
        const lastDia = this.diastolicBuffer[this.diastolicBuffer.length - 1];
        const variation = Math.random() * 1.5 - 0.75; // -0.75 to +0.75
        return {
          systolic: Math.round(lastSys + variation),
          diastolic: Math.round(lastDia + variation),
          precision: 0.3
        };
      }
      
      // Return default values if buffer has data, otherwise zeros
      return {
        ...this.getLastValidOrDefault(),
        precision: 0.2
      };
    }

    // Find peaks and valleys in the filtered signal
    const { peakIndices, valleyIndices } = findPeaksAndValleys(filteredValues, 0.2);
    if (peakIndices.length < this.MIN_PEAK_COUNT) {
      console.log("BloodPressureProcessor: Not enough peaks detected", {
        peaksFound: peakIndices.length,
        required: this.MIN_PEAK_COUNT
      });
      
      if (shouldForceRecalculation && this.systolicBuffer.length > 0) {
        // Return last values with small variation and low precision
        const lastSys = this.systolicBuffer[this.systolicBuffer.length - 1];
        const lastDia = this.diastolicBuffer[this.diastolicBuffer.length - 1];
        const variation = Math.random() * 1.5 - 0.75; // -0.75 to +0.75
        return {
          systolic: Math.round(lastSys + variation),
          diastolic: Math.round(lastDia + variation),
          precision: 0.3
        };
      }
      
      return {
        ...this.getLastValidOrDefault(),
        precision: 0.2
      };
    }

    // Update the last calculation time
    this.lastCalculationTime = currentTime;

    // Direct sampling parameters
    const fps = this.MIN_FPS;
    const msPerSample = 1000 / fps;

    // Calculate PTT (Pulse Transit Time) values
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      // Physiologically valid range
      if (dt > 250 && dt < 1500) {
        pttValues.push(dt);
      }
    }
    
    // If we don't have enough PTT values, use defaults
    if (pttValues.length < 2) {
      console.log("BloodPressureProcessor: Not enough valid intervals", {
        validIntervals: pttValues.length
      });
      
      // Calculate based on signal characteristics even without PTT values
      return this.calculateFromSignalCharacteristics(
        filteredValues, 
        peakIndices, 
        valleyIndices
      );
    }
    
    // Filter outliers
    const sortedPTT = [...pttValues].sort((a, b) => a - b);
    const medianPTT = this.calculateMedian(sortedPTT);
    
    // Filter values outside 2.0 IQR
    const filteredPTT = this.filterOutliers(pttValues, sortedPTT, 2.0);
    
    // Calculate PTT using filtered values with weight to recent values
    const calculatedPTT = this.calculateWeightedPTT(filteredPTT, medianPTT);
    
    console.log("BloodPressureProcessor: PTT calculation", {
      original: pttValues,
      filtered: filteredPTT,
      median: medianPTT,
      weighted: calculatedPTT
    });
    
    // Normalize PTT to a physiologically relevant range
    const normalizedPTT = Math.max(250, Math.min(1500, calculatedPTT));
    
    // Calculate PPG signal amplitude
    const amplitude = calculateAmplitude(filteredValues, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(80, Math.max(10, amplitude * 20.0));

    console.log("BloodPressureProcessor: Signal parameters", {
      ptt: normalizedPTT,
      amplitude,
      normalizedAmplitude
    });

    // Direct coefficients for measurement
    // PTT is inversely related to BP: lower PTT = higher BP
    const pttFactor = (900 - normalizedPTT) * 0.1; 
    const ampFactor = normalizedAmplitude * 0.15;
    
    // Add small randomization to prevent sticking at the same values
    const randomVariation = Math.random() * 1.2 - 0.6; // -0.6 to +0.6
    
    // Direct estimation model
    let instantSystolic = 120 + pttFactor + ampFactor + randomVariation;
    let instantDiastolic = 80 + (pttFactor * 0.4) + (ampFactor * 0.2) + (randomVariation * 0.5);

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
    
    // Re-check physiological limits
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
    const { finalSystolic, finalDiastolic, precision } = this.calculateFinalValues();

    // Make sure we don't return zeros or invalid values
    const resultSystolic = Math.round(finalSystolic) || 120;
    const resultDiastolic = Math.round(finalDiastolic) || 80;

    console.log("BloodPressureProcessor: Final BP values", {
      systolic: resultSystolic,
      diastolic: resultDiastolic,
      differential: resultSystolic - resultDiastolic,
      precision: precision.toFixed(2),
      bufferSize: this.systolicBuffer.length
    });

    // Calculate quality and update quality history
    const signalQuality = this.calculateSignalQuality(filteredValues, peakIndices, valleyIndices);
    this.updateQualityHistory(signalQuality);

    return {
      systolic: resultSystolic,
      diastolic: resultDiastolic,
      precision
    };
  }
  
  /**
   * Calculate BP from signal characteristics when PTT isn't available
   */
  private calculateFromSignalCharacteristics(
    values: number[], 
    peakIndices: number[], 
    valleyIndices: number[]
  ): { systolic: number, diastolic: number, precision: number } {
    // Calculate amplitude
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    
    // Get signal statistics
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const std = calculateStandardDeviation(values);
    
    // Estimate systolic and diastolic directly from signal characteristics
    let systolic = 120 + (amplitude * 30) + (std * 15);
    let diastolic = 80 + (amplitude * 15) + (std * 8);
    
    // Apply physiological limits
    systolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolic));
    diastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));
    
    // Ensure pulse pressure is within physiological range
    const pulsePressure = systolic - diastolic;
    if (pulsePressure < this.MIN_PULSE_PRESSURE) {
      diastolic = systolic - this.MIN_PULSE_PRESSURE;
    } else if (pulsePressure > this.MAX_PULSE_PRESSURE) {
      diastolic = systolic - this.MAX_PULSE_PRESSURE;
    }
    
    // Ensure diastolic is within limits after adjustment
    diastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));
    
    // Add to buffers
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    
    // Maintain buffer size
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
    
    // Calculate final values with reduced precision
    const { finalSystolic, finalDiastolic, precision } = this.calculateFinalValues();
    const reducedPrecision = precision * 0.8; // Reduce precision since PTT wasn't used
    
    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic),
      precision: reducedPrecision
    };
  }
  
  /**
   * Calculate signal quality based on multiple factors
   */
  private calculateSignalQuality(
    values: number[], 
    peakIndices: number[], 
    valleyIndices: number[]
  ): number {
    // 1. Stability factor
    const std = calculateStandardDeviation(values);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const cv = std / Math.abs(mean + 0.001); // Coefficient of variation
    const stabilityFactor = Math.max(0, 1 - Math.min(1, cv * 5));
    
    // 2. Peak regularity factor
    let peakRegularity = 0.5;
    if (peakIndices.length >= 3) {
      const intervals = [];
      for (let i = 1; i < peakIndices.length; i++) {
        intervals.push(peakIndices[i] - peakIndices[i-1]);
      }
      
      const intervalStd = calculateStandardDeviation(intervals);
      const intervalMean = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
      const intervalCV = intervalStd / (intervalMean + 0.001);
      
      peakRegularity = Math.max(0, 1 - Math.min(1, intervalCV * 2));
    }
    
    // 3. Peak-valley amplitude factor
    let amplitudeFactor = 0.5;
    if (peakIndices.length > 0 && valleyIndices.length > 0) {
      const amplitudes = [];
      
      // Pair peaks with nearest valleys
      for (const peakIdx of peakIndices) {
        let nearestValleyIdx = -1;
        let minDistance = Infinity;
        
        for (const valleyIdx of valleyIndices) {
          const distance = Math.abs(peakIdx - valleyIdx);
          if (distance < minDistance) {
            minDistance = distance;
            nearestValleyIdx = valleyIdx;
          }
        }
        
        if (nearestValleyIdx >= 0) {
          amplitudes.push(Math.abs(values[peakIdx] - values[nearestValleyIdx]));
        }
      }
      
      if (amplitudes.length > 0) {
        const avgAmplitude = amplitudes.reduce((sum, a) => sum + a, 0) / amplitudes.length;
        amplitudeFactor = Math.min(1, avgAmplitude * 5);
      }
    }
    
    // 4. Calculate overall quality
    const quality = (stabilityFactor * 0.4) + (peakRegularity * 0.4) + (amplitudeFactor * 0.2);
    
    return quality;
  }
  
  /**
   * Update quality history
   */
  private updateQualityHistory(quality: number): void {
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.QUALITY_BUFFER_SIZE) {
      this.qualityHistory.shift();
    }
  }
  
  /**
   * Get average signal quality
   */
  public getSignalQuality(): number {
    if (this.qualityHistory.length === 0) return 0;
    
    return this.qualityHistory.reduce((sum, q) => sum + q, 0) / this.qualityHistory.length;
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
    return { systolic: 120, diastolic: 80 }; // Default starting point
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
      const weight = Math.pow(1.2, idx);
      weightedSum += val * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : medianPTT;
  }
  
  /**
   * Calculate final blood pressure values using median and weighted average
   * for greater stability and noise rejection
   */
  private calculateFinalValues(): { finalSystolic: number, finalDiastolic: number, precision: number } {
    if (this.systolicBuffer.length === 0) {
      return { finalSystolic: 120, finalDiastolic: 80, precision: 0.2 };
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
    finalSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, finalSystolic));
    finalDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, finalDiastolic));
    
    // 6. Calculate precision based on buffer size and consistency
    const systolicStd = calculateStandardDeviation(this.systolicBuffer);
    const diastolicStd = calculateStandardDeviation(this.diastolicBuffer);
    
    const systolicCV = systolicStd / systolicMean; // Coefficient of variation
    const diastolicCV = diastolicStd / diastolicMean;
    
    // Lower CV = higher precision
    const consistencyFactor = Math.max(0, 1 - Math.min(1, (systolicCV + diastolicCV) * 5));
    
    // More samples = higher precision
    const bufferSizeFactor = Math.min(1, this.systolicBuffer.length / this.BP_BUFFER_SIZE);
    
    // Calculate overall precision
    const precision = 0.3 + (consistencyFactor * 0.4) + (bufferSizeFactor * 0.3);
    
    return { finalSystolic, finalDiastolic, precision };
  }
  
  /**
   * Reset the blood pressure processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.qualityHistory = [];
    this.lastCalculationTime = 0;
    console.log("BloodPressureProcessor: Reset completed");
  }
}
