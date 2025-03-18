/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validates PPG signals to ensure they meet requirements
 * Works with real data only, no simulation
 * Enhanced with rhythmic pattern detection for finger detection
 */
export class SignalValidator {
  // Thresholds for physiological detection
  private readonly MIN_SIGNAL_AMPLITUDE: number;
  private readonly MIN_PPG_VALUES: number;
  
  // Signal history for rhythmic pattern detection
  private signalHistory: Array<{time: number, value: number}> = [];
  private peakTimes: number[] = [];
  private detectedPatternCount: number = 0;
  private fingerDetectionConfirmed: boolean = false;
  
  // Constants for pattern detection
  private readonly PATTERN_DETECTION_WINDOW_MS = 3000; // 3 seconds
  private readonly MIN_PEAKS_FOR_PATTERN = 3; // Need at least 3 peaks for pattern
  private readonly REQUIRED_PATTERNS = 3; // Need 3 consistent patterns
  
  /**
   * Create a new signal validator with custom thresholds
   */
  constructor(
    minSignalAmplitude: number = 0.01,
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
    if (ppgValues.length < this.MIN_PPG_VALUES) {
      return false;
    }
    
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    return amplitude >= this.MIN_SIGNAL_AMPLITUDE;
  }
  
  /**
   * Validate that the signal is strong enough
   */
  public isValidSignal(ppgValue: number): boolean {
    return Math.abs(ppgValue) >= 0.005;
  }
  
  /**
   * Add value to signal history for pattern detection
   */
  public trackSignalForPatternDetection(value: number): void {
    const now = Date.now();
    this.signalHistory.push({ time: now, value });
    
    // Keep only recent signals
    this.signalHistory = this.signalHistory.filter(
      point => now - point.time < this.PATTERN_DETECTION_WINDOW_MS * 2
    );
    
    // Attempt to detect rhythmic patterns
    this.detectRhythmicPatterns();
  }
  
  /**
   * Check if a finger is detected based on rhythmic patterns
   */
  public isFingerDetected(): boolean {
    // If already confirmed, maintain detection unless reset
    if (this.fingerDetectionConfirmed) {
      return true;
    }
    
    // Otherwise, check if we've detected enough consistent patterns
    return this.detectedPatternCount >= this.REQUIRED_PATTERNS;
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.signalHistory = [];
    this.peakTimes = [];
    this.detectedPatternCount = 0;
    this.fingerDetectionConfirmed = false;
    console.log("Finger detection reset");
  }
  
  /**
   * Detect rhythmic patterns in the signal history
   * Uses physiological heartbeat patterns to detect finger presence
   */
  private detectRhythmicPatterns(): void {
    const now = Date.now();
    const recentSignals = this.signalHistory.filter(
      point => now - point.time < this.PATTERN_DETECTION_WINDOW_MS
    );
    
    if (recentSignals.length < 10) return; // Need sufficient data
    
    // Look for peaks in the signal
    const peaks: number[] = [];
    const peakThreshold = 0.2;
    
    for (let i = 2; i < recentSignals.length - 2; i++) {
      const current = recentSignals[i];
      const prev1 = recentSignals[i - 1];
      const prev2 = recentSignals[i - 2];
      const next1 = recentSignals[i + 1];
      const next2 = recentSignals[i + 2];
      
      // Check if this point is a peak (higher than surrounding points)
      if (current.value > prev1.value && 
          current.value > prev2.value &&
          current.value > next1.value && 
          current.value > next2.value &&
          Math.abs(current.value) > peakThreshold) {
        peaks.push(current.time);
      }
    }
    
    // Need enough peaks to establish a pattern
    if (peaks.length >= this.MIN_PEAKS_FOR_PATTERN) {
      // Calculate intervals between peaks
      const intervals: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
      }
      
      // Check for consistency in intervals (rhythm)
      let consistentIntervals = 0;
      const maxDeviation = 200; // Allow 200ms deviation
      
      for (let i = 1; i < intervals.length; i++) {
        if (Math.abs(intervals[i] - intervals[i - 1]) < maxDeviation) {
          consistentIntervals++;
        }
      }
      
      // If we have consistent intervals, increment pattern counter
      if (consistentIntervals >= this.MIN_PEAKS_FOR_PATTERN - 1) {
        this.peakTimes = peaks;
        this.detectedPatternCount++;
        
        // If enough consistent patterns, confirm finger detection
        if (this.detectedPatternCount >= this.REQUIRED_PATTERNS && !this.fingerDetectionConfirmed) {
          this.fingerDetectionConfirmed = true;
          console.log("Finger detection confirmed by consistent heartbeat rhythm!", 
                     {time: new Date(now).toISOString(), patterns: this.detectedPatternCount});
        }
      } else {
        // Reduce counter if pattern not consistent
        this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
      }
    }
  }
  
  /**
   * Log validation results
   */
  public logValidationResults(isValidAmplitude: boolean, amplitude: number, ppgValues: number[]): void {
    if (!isValidAmplitude) {
      console.log("VitalSignsProcessor: Signal amplitude too low", {
        amplitude,
        threshold: this.MIN_SIGNAL_AMPLITUDE
      });
    }
    
    if (ppgValues.length < this.MIN_PPG_VALUES) {
      console.log("VitalSignsProcessor: Insufficient data points", {
        have: ppgValues.length,
        need: this.MIN_PPG_VALUES
      });
    }
  }
}
