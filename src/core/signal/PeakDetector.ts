export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

export class PeakDetector {
  // Parámetros optimizados basados en investigación clínica
  private readonly MIN_PEAK_DISTANCE_MS = 450;
  private readonly MAX_PEAK_DISTANCE_MS = 1500;
  private readonly SAMPLING_RATE = 30;
  private readonly SLOPE_SUM_WINDOW = 8;
  private readonly DERIVATIVE_WINDOW = 5;
  private readonly VERIFICATION_WINDOW = 5;
  
  private lastPeakIndex: number = -1;
  private lastPeakTime: number = 0;
  private peakThreshold: number = 0.35;
  private adaptiveThreshold: number = 0.35;
  private rrIntervals: number[] = [];
  private consecutiveGoodIntervals: number = 0;
  private readonly MIN_GOOD_INTERVALS = 3;
  
  constructor() {
    this.reset();
  }
  
  public detectPeaks(values: number[]): {
    peakIndices: number[];
    valleyIndices: number[];
    intervals: number[];
    lastPeakTime: number;
  } {
    const n = values.length;
    if (n < this.SLOPE_SUM_WINDOW + this.VERIFICATION_WINDOW) {
      return { peakIndices: [], valleyIndices: [], intervals: [], lastPeakTime: this.lastPeakTime };
    }

    const derivative = this.calculateFirstDerivative(values);
    const slopeSum = this.calculateSlopeSum(derivative);

    this.updateAdaptiveThreshold(slopeSum);

    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    let inPeakRegion = false;
    let peakStartIndex = -1;

    for (let i = this.SLOPE_SUM_WINDOW; i < n - this.VERIFICATION_WINDOW; i++) {
      const currentValue = slopeSum[i];

      if (currentValue > this.adaptiveThreshold && !inPeakRegion) {
        // Potential peak start
        inPeakRegion = true;
        peakStartIndex = i;
      } else if (currentValue < this.adaptiveThreshold && inPeakRegion) {
        // Potential peak end
        inPeakRegion = false;
        const peakEndIndex = i - 1;

        if (peakStartIndex !== -1 && peakEndIndex > peakStartIndex) {
          // Find max in the original signal within this detected peak region
          let maxVal = -Infinity;
          let maxIndex = peakStartIndex;
          for (let j = peakStartIndex; j <= peakEndIndex; j++) {
            if (values[j] > maxVal) {
              maxVal = values[j];
              maxIndex = j;
            }
          }
          
          // Find preceding valley
          let minValBefore = Infinity;
          let valleyIndexBefore = Math.max(0, maxIndex - this.DERIVATIVE_WINDOW);
          for (let j = Math.max(0, maxIndex - this.DERIVATIVE_WINDOW); j < maxIndex; j++) {
              if (values[j] < minValBefore) {
                  minValBefore = values[j];
                  valleyIndexBefore = j;
              }
          }
          if (valleyIndexBefore !== -1) valleyIndices.push(valleyIndexBefore);

          // Find succeeding valley
          let minValAfter = Infinity;
          let valleyIndexAfter = Math.min(n - 1, maxIndex + this.DERIVATIVE_WINDOW);
          for (let j = maxIndex + 1; j <= Math.min(n - 1, maxIndex + this.DERIVATIVE_WINDOW); j++) {
              if (values[j] < minValAfter) {
                  minValAfter = values[j];
                  valleyIndexAfter = j;
              }
          }
           if (valleyIndexAfter !== -1) valleyIndices.push(valleyIndexAfter);

          // Basic peak validation (e.g., minimum distance)
          const currentTime = (maxIndex / this.SAMPLING_RATE) * 1000;
          if (this.lastPeakTime === 0 || (currentTime - this.lastPeakTime >= this.MIN_PEAK_DISTANCE_MS && currentTime - this.lastPeakTime <= this.MAX_PEAK_DISTANCE_MS)) {
            
            // Advanced validation (Prominence, Shape - placeholder)
            const prominence = maxVal - Math.max(minValBefore, minValAfter);
            if (prominence > this.peakThreshold * 0.5) { // Simple prominence check
                peakIndices.push(maxIndex);
                const interval = currentTime - this.lastPeakTime;
                if (this.lastPeakTime > 0 && interval > 0) {
                  this.rrIntervals.push(interval);
                  if (this.rrIntervals.length > 20) this.rrIntervals.shift(); // Keep history manageable

                  // Check interval consistency
                  if (this.rrIntervals.length > 1) {
                      const lastInterval = this.rrIntervals[this.rrIntervals.length - 1];
                      const secondLastInterval = this.rrIntervals[this.rrIntervals.length - 2];
                      if (Math.abs(lastInterval - secondLastInterval) < lastInterval * 0.3) {
                          this.consecutiveGoodIntervals++;
                      } else {
                          this.consecutiveGoodIntervals = 0;
                      }
                  } else {
                      this.consecutiveGoodIntervals = 1;
                  }
                } else {
                    this.consecutiveGoodIntervals = 0;
                }
                this.lastPeakTime = currentTime;
            } else {
                this.consecutiveGoodIntervals = 0;
            }
          } else {
              this.consecutiveGoodIntervals = 0;
          }
        }
        peakStartIndex = -1; // Reset start index
      }
    }

    return {
      peakIndices,
      valleyIndices: [...new Set(valleyIndices)].sort((a, b) => a - b), // Remove duplicates and sort
      intervals: this.getValidIntervals(),
      lastPeakTime: this.lastPeakTime
    };
  }
  
  private getValidIntervals(): number[] {
    if (this.rrIntervals.length < 2) return [];
    
    // Simple outlier rejection: remove intervals significantly different from the median
    const sortedIntervals = [...this.rrIntervals].sort((a, b) => a - b);
    // Use Math.floor
    const medianIndex = Math.floor(sortedIntervals.length / 2);
    const medianInterval = sortedIntervals.length % 2 === 0
      ? (sortedIntervals[medianIndex - 1] + sortedIntervals[medianIndex]) / 2
      : sortedIntervals[medianIndex];
      
    const lowerBound = medianInterval * 0.6; // e.g., 60% of median
    const upperBound = medianInterval * 1.6; // e.g., 160% of median
    
    return this.rrIntervals.filter(interval => interval >= lowerBound && interval <= upperBound);
  }
  
  private findPrecisePeakIndex(values: number[], approxIndex: number, window: number): number {
    let maxVal = values[approxIndex];
    let maxIdx = approxIndex;
    
    const start = Math.max(0, approxIndex - window);
    const end = Math.min(values.length - 1, approxIndex + window);
    
    for (let i = start; i <= end; i++) {
      if (values[i] > maxVal) {
        maxVal = values[i];
        maxIdx = i;
      }
    }
    
    return maxIdx;
  }
  
  private findPreciseValleyIndex(values: number[], approxIndex: number, window: number): number {
    let minVal = values[approxIndex];
    let minIdx = approxIndex;
    
    const start = Math.max(0, approxIndex - window);
    const end = Math.min(values.length - 1, approxIndex + window);
    
    for (let i = start; i <= end; i++) {
      if (values[i] < minVal) {
        minVal = values[i];
        minIdx = i;
      }
    }
    
    return minIdx;
  }
  
  private calculateFirstDerivative(values: number[]): number[] {
    const derivative: number[] = [];
    
    for (let i = this.DERIVATIVE_WINDOW; i < values.length; i++) {
      let sum = 0;
      for (let j = 1; j <= this.DERIVATIVE_WINDOW; j++) {
        // Preservar el signo correcto de la derivada
        sum += values[i] - values[i - j];
      }
      derivative.push(sum / this.DERIVATIVE_WINDOW);
    }
    
    return derivative;
  }
  
  private calculateSlopeSum(derivative: number[]): number[] {
    const slopeSum: number[] = [];
    
    for (let i = 0; i < derivative.length - this.SLOPE_SUM_WINDOW; i++) {
      let sum = 0;
      for (let j = 0; j < this.SLOPE_SUM_WINDOW; j++) {
        sum += Math.max(0, derivative[i + j]);
      }
      slopeSum.push(sum);
    }
    
    return slopeSum;
  }
  
  private updateAdaptiveThreshold(slopeSum: number[]): void {
    if (slopeSum.length < 20) return; // Need enough data

    const recentSlope = slopeSum.slice(-20);
    // Use Math.max
    const peakSlope = Math.max(...recentSlope);
    const noiseEstimate = recentSlope.reduce((sum, val) => sum + Math.abs(val), 0) / recentSlope.length;

    // Adjust threshold based on recent peak heights and noise level
    this.adaptiveThreshold = Math.max(
      this.peakThreshold * 0.5, // Minimum threshold
      Math.min(this.peakThreshold * 1.5, peakSlope * 0.3 + noiseEstimate * 0.1) // Dynamic threshold based on signal features
    );
  }
  
  public reset(): void {
    this.lastPeakIndex = -1;
    this.lastPeakTime = 0;
    this.peakThreshold = 0.35;
    this.adaptiveThreshold = 0.35;
    this.rrIntervals = [];
    this.consecutiveGoodIntervals = 0;
  }

  // Funciones matemáticas reemplazadas (usar Math directamente)
  /*
  private realFloor(value: number): number {
    return value >= 0 ? value - (value % 1) : value - (value % 1) - 1;
  }

  private realMax(arr: number[]): number {
    if (arr.length === 0) return -Infinity;
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > max) max = arr[i];
    }
    return max;
  }

  private realMin(arr: number[]): number {
    if (arr.length === 0) return Infinity;
    let min = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < min) min = arr[i];
    }
    return min;
  }

  private realAbs(value: number): number {
    return value < 0 ? -value : value;
  }

  private realRound(value: number): number {
    return (value % 1) >= 0.5 ? (value - (value % 1) + 1) : (value - (value % 1));
  }
  */
}
