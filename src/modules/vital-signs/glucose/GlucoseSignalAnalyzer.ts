
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

/**
 * GlucoseSignalAnalyzer
 * Handles genuine PPG signal analysis for glucose estimation
 * No simulation or artificial data manipulation
 */
export class GlucoseSignalAnalyzer {
  /**
   * Analyze genuine PPG signal to extract key metrics with improved algorithms
   * Only processes real data without simulation
   */
  public static analyzeSignal(values: number[]): { 
    amplitude: number; 
    frequency: number; 
    phase: number; 
    perfusionIndex: number;
    areaUnderCurve: number;
    signalVariability: number;
  } {
    // Calculate amplitude (AC component) with improved peak detection from real data
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
    
    // Calculate "DC" component (average value) from actual measurements
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate perfusion index (AC/DC ratio) from real data
    const perfusionIndex = avg !== 0 ? amplitude / avg : 0;
    
    // Calculate frequency through zero crossings from actual signal
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
    
    // Calculate phase using autocorrelation with genuine signal
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
    
    // Calculate area under the curve from real measurement
    const areaUnderCurve = this.calculateAreaUnderCurve(values, avg);
    
    // Calculate signal variability from actual data
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
   * Find real peaks and valleys in genuine signal
   */
  public static findPeaksAndValleys(values: number[]): { peakValues: number[], valleyValues: number[] } {
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
   * from actual signal values
   */
  public static calculateAreaUnderCurve(values: number[], baseline: number): number {
    let area = 0;
    for (const value of values) {
      area += (value - baseline);
    }
    // Normalize by signal length for consistent scaling
    return Math.abs(area) / values.length;
  }
  
  /**
   * Calculate signal variability from real measurements
   */
  public static calculateVariability(values: number[]): number {
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
}
