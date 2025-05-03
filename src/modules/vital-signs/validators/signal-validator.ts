/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validates PPG signals to ensure they meet requirements
 * Works with real data only, no simulation
 * Enhanced with rhythmic pattern detection for finger detection
 */

// Removed manual math functions, using standard Math now

export class SignalValidator {
  // Thresholds for physiological detection
  private readonly MIN_SIGNAL_AMPLITUDE: number;
  private readonly MIN_PPG_VALUES: number;
  
  // Signal history for rhythmic pattern detection
  private signalHistory: Array<{time: number, value: number}> = [];
  private peakTimes: number[] = [];
  private detectedPatternCount: number = 0;
  private fingerDetectionConfirmed: boolean = false;
  
  // Constants for pattern detection - made more strict
  private readonly PATTERN_DETECTION_WINDOW_MS = 3000; // 3 seconds
  private readonly MIN_PEAKS_FOR_PATTERN = 4; // Increased from 3 - need more peaks
  private readonly REQUIRED_PATTERNS = 4; // Increased from 3 - need more consistent patterns
  private readonly MIN_SIGNAL_VARIANCE = 0.04; // New threshold for minimum signal variance
  
  /**
   * Create a new signal validator with custom thresholds
   */
  constructor(
    minSignalAmplitude: number = 0.02, // Increased from 0.01
    minPpgValues: number = 15
  ) {
    this.MIN_SIGNAL_AMPLITUDE = minSignalAmplitude;
    this.MIN_PPG_VALUES = minPpgValues;
  }
  
  /**
   * Check if there are enough PPG values to process
   */
  public hasEnoughData(ppgValues: number[]): boolean {
    return ppgValues.length >= this.MIN_PPG_VALUES;
  }
  
  /**
   * Check if signal amplitude is sufficient
   */
  public hasValidAmplitude(ppgValues: number[]): boolean {
    if (!this.hasEnoughData(ppgValues)) return false;

    // Use Math.max and Math.min
    const maxVal = Math.max(...ppgValues);
    const minVal = Math.min(...ppgValues);
    const amplitude = maxVal - minVal;

    return amplitude >= this.MIN_SIGNAL_AMPLITUDE;
  }
  
  /**
   * Validate that the signal is strong enough
   */
  public isValidSignal(ppgValue: number): boolean {
    // Use Math.abs
    return Math.abs(ppgValue) >= 0.02; // Example threshold
  }
  
  /**
   * Add value to signal history for pattern detection
   */
  public trackSignalForPatternDetection(value: number): void {
    const now = Date.now();
    this.signalHistory.push({ time: now, value });
    
    // Trim buffer
    this.signalHistory = this.signalHistory.filter(p => now - p.time < this.PATTERN_DETECTION_WINDOW_MS * 1.5);
    
    // Basic rhythmic pattern detection (needs improvement for real use)
    const recentSignals = this.signalHistory.filter(p => now - p.time < this.PATTERN_DETECTION_WINDOW_MS);
    if (recentSignals.length < this.MIN_PPG_VALUES * 2) { // Need enough data for pattern analysis
      // Not enough data yet, potentially reduce count if previously high?
      // this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
      return;
    }

    // --- Rhythmic Pattern Detection Logic --- 
    // (This section remains complex and likely needs refinement/validation)
    const values = recentSignals.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    // Use Math.pow
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    if (variance < this.MIN_SIGNAL_VARIANCE) {
      // Signal variance too low - likely not a physiological signal
      // Use Math.max
      this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
      return;
    }
    
    // Basic peak detection within the window (example)
    const peaks: number[] = [];
    const peakThreshold = mean * 0.1; // Example relative threshold
    for (let i = 2; i < recentSignals.length - 2; i++) {
      const current = recentSignals[i];
      const prev1 = recentSignals[i - 1];
      const prev2 = recentSignals[i - 2];
      const next1 = recentSignals[i + 1];
      const next2 = recentSignals[i + 2];
      
      // Simple local maximum check
      if (current.value > prev1.value && 
          current.value > prev2.value && 
          current.value > next1.value && 
          current.value > next2.value &&
          // Use Math.abs
          Math.abs(current.value) > peakThreshold) { 
        peaks.push(current.time);
      }
    }
    
    this.peakTimes = peaks; // Store detected peak times

    // Check consistency of intervals if enough peaks found
    if (this.peakTimes.length >= this.MIN_PEAKS_FOR_PATTERN) {
      const intervals = [];
      for (let i = 1; i < this.peakTimes.length; i++) {
        intervals.push(this.peakTimes[i] - this.peakTimes[i - 1]);
      }
      
      if (intervals.length > 1) {
        const meanInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        const plausibleMinInterval = 60000 / 200; // Corresponds to max HR 200
        const plausibleMaxInterval = 60000 / 40;  // Corresponds to min HR 40

        const validIntervals = intervals.filter(int => int >= plausibleMinInterval && int <= plausibleMaxInterval);

        // Check if a good portion of intervals are physiologically plausible
        // Use Math.floor
        if (validIntervals.length < Math.floor(intervals.length * 0.7)) { 
          // If less than 70% of intervals are plausible, reject the pattern
          // Use Math.max
          this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
          return;
        }
        
        // Check consistency (coefficient of variation)
        let sumSqDiff = 0;
        for (const interval of validIntervals) {
           // Use Math.pow
           sumSqDiff += Math.pow(interval - meanInterval, 2);
        }
        // Use Math.sqrt
        const stdDev = Math.sqrt(sumSqDiff / validIntervals.length);
        const coefficientOfVariation = meanInterval > 0 ? stdDev / meanInterval : 1; // Assign 1 if mean is 0

        // Increase count if variation is low (consistent rhythm)
        if (coefficientOfVariation < 0.25) { // Threshold can be tuned
          this.detectedPatternCount++;
        } else {
          // Reduce counter if pattern not consistent
          // Use Math.max
          this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
        }
      } else {
        // Reduce counter if not enough intervals
        // Use Math.max
        this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
      }
    } else {
      // Decrement pattern count if we don't have enough peaks
      // Use Math.max
      this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
    }

    // Confirm finger detection if enough *consistent* patterns are detected
    if (this.detectedPatternCount >= this.REQUIRED_PATTERNS) {
      this.fingerDetectionConfirmed = true;
    }
  }
  
  /**
   * Check if a finger is detected based on rhythmic patterns
   */
  public isFingerDetected(): boolean {
    // Require confirmed patterns for positive detection
    return this.fingerDetectionConfirmed;
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.signalHistory = [];
    this.peakTimes = [];
    this.detectedPatternCount = 0;
    this.fingerDetectionConfirmed = false;
    // console.log("SignalValidator: Finger detection reset.");
  }
  
  /**
   * Log validation results
   */
  public logValidationResults(isValidAmplitude: boolean, amplitude: number, ppgValues: number[]): void {
    // Optional logging - Can be removed or expanded
    // console.log(`Validation - Amplitude: ${amplitude.toFixed(3)}, Valid: ${isValidAmplitude}, FingerDetected: ${this.isFingerDetected()}`);
    // if (ppgValues.length > 0) {
    //   console.log(`Signal range: [${Math.min(...ppgValues).toFixed(3)}, ${Math.max(...ppgValues).toFixed(3)}]`);
    // }
  }
}
