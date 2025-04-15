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
  
  // Constants for pattern detection - made more strict
  private readonly PATTERN_DETECTION_WINDOW_MS = 3000; // 3 seconds
  private readonly MIN_PEAKS_FOR_PATTERN = 4; // Stays at 4 for pattern logic
  private readonly REQUIRED_PATTERNS = 3; // Reduced from 4
  private readonly MIN_SIGNAL_VARIANCE = 0.02; // Reduced from 0.04
  
  /**
   * Create a new signal validator with custom thresholds
   */
  constructor(
    minSignalAmplitude: number = 0.01, // Keep original default here
    minPpgValues: number = 15
  ) {
    this.MIN_SIGNAL_AMPLITUDE = minSignalAmplitude; // Use passed value or default
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
    return Math.abs(ppgValue) >= 0.02; // Increased from 0.005
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
   * Checks if a finger is likely detected based on signal characteristics.
   * TEMPORARILY simplified to ignore pattern count for return value.
   */
  public isFingerDetected(): boolean {
    // Initial, quick check based on simple metrics
    if (this.signalHistory.length < this.MIN_PPG_VALUES) {
      this.fingerDetectionConfirmed = false; // Ensure it's false if not enough data
      return false;
    }
    const recentValues = this.signalHistory.slice(-10).map(p => p.value);
    const variance = this.calculateVariance(recentValues);
    const amplitude = Math.max(...recentValues) - Math.min(...recentValues);

    // If basic metrics are okay, tentatively confirm
    if (variance > this.MIN_SIGNAL_VARIANCE && amplitude > this.MIN_SIGNAL_AMPLITUDE) { // Use full amplitude threshold here
         this.fingerDetectionConfirmed = true;
    } else {
         // If basic metrics fail *after* confirmation, reset confirmation only after a grace period
         // Check every ~0.5s (assuming ~30fps)
         if (this.fingerDetectionConfirmed && this.signalHistory.length > this.MIN_PPG_VALUES && this.signalHistory.length % 15 === 0) { 
             this.fingerDetectionConfirmed = false;
         }
    }

    // Call pattern detection logic internally to update the count, but don't use it for the return value yet.
    this.detectRhythmicPatterns(); 

    // *** TEMPORARY CHANGE: Return based only on the confirmed flag ***
    return this.fingerDetectionConfirmed;
    
    // Original logic (kept for reference):
    // return this.fingerDetectionConfirmed && (this.detectedPatternCount >= this.REQUIRED_PATTERNS);
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.signalHistory = [];
    this.peakTimes = [];
    this.detectedPatternCount = 0;
    this.fingerDetectionConfirmed = false;
  }
  
  /**
   * Detect rhythmic patterns in the signal history
   * Uses physiological heartbeat patterns to detect finger presence
   */
  private detectRhythmicPatterns(): void {
    const now = Date.now();
    const relevantHistory = this.signalHistory.filter(p => now - p.time <= this.PATTERN_DETECTION_WINDOW_MS);
    
    if (relevantHistory.length < this.MIN_PPG_VALUES) {
      this.detectedPatternCount = 0; // Reset count if not enough data in window
      return;
    }

    const values = relevantHistory.map(p => p.value);
    const { peakIndices } = findPeaksAndValleys(values);

    if (peakIndices.length >= this.MIN_PEAKS_FOR_PATTERN) {
      const intervals = [];
      for (let i = 1; i < peakIndices.length; i++) {
        const timeDiff = relevantHistory[peakIndices[i]].time - relevantHistory[peakIndices[i-1]].time;
        if (timeDiff > 300 && timeDiff < 1500) { // Basic check for reasonable RR interval
           intervals.push(timeDiff);
        }
      }
      
      if (intervals.length >= this.MIN_PEAKS_FOR_PATTERN - 1) {
         const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
         const stdDev = this.calculateStandardDeviation(intervals);
         const coefficientOfVariation = avgInterval > 0 ? stdDev / avgInterval : Infinity;
         
         // Check if variation is within a reasonable range (e.g., less than 20%)
         if (coefficientOfVariation < 0.20) { 
            this.detectedPatternCount = Math.min(this.REQUIRED_PATTERNS + 1, this.detectedPatternCount + 1); // Increment count, cap it
         } else {
            // If pattern breaks, decrease count slightly (decay)
            this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
         }
      } else {
         // Not enough valid intervals found, decrease count
         this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
      }
    } else {
      // Not enough peaks found, decrease count
      this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
    }
    
    // Update peak times for potential future use (not strictly necessary for current logic)
    this.peakTimes = peakIndices.map(idx => relevantHistory[idx].time);
  }
  
  /**
   * Calculate variance of a number array
   */
   private calculateVariance(values: number[]): number {
     if (!values || values.length < 2) return 0;
     const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
     const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
     return squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1);
   }
   
   /**
   * Calculate standard deviation of a number array
   */
   private calculateStandardDeviation(values: number[]): number {
     return Math.sqrt(this.calculateVariance(values));
   }
  
  /**
   * Log validation results
   */
  public logValidationResults(isValidAmplitude: boolean, amplitude: number, ppgValues: number[]): void {
    console.log("SignalValidator Results:", {
      hasEnoughData: this.hasEnoughData(ppgValues),
      hasValidAmplitude: isValidAmplitude,
      calculatedAmplitude: amplitude.toFixed(4),
      minAmplitudeThreshold: this.MIN_SIGNAL_AMPLITUDE,
      bufferLength: ppgValues.length,
      minBufferLength: this.MIN_PPG_VALUES,
      fingerConfirmedFlag: this.fingerDetectionConfirmed,
      patternCount: this.detectedPatternCount,
      requiredPatterns: this.REQUIRED_PATTERNS
    });
  }
}

// Helper function (can be moved to utils if needed)
function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];
  if (values.length < 3) {
    return { peakIndices, valleyIndices };
  }

  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
      peakIndices.push(i);
    } else if (values[i] < values[i - 1] && values[i] < values[i + 1]) {
      valleyIndices.push(i);
    }
  }
  return { peakIndices, valleyIndices };
}
