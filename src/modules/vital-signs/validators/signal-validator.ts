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
  private readonly MIN_PEAKS_FOR_PATTERN = 4; // Increased from 3 - need more peaks
  private readonly REQUIRED_PATTERNS = 4; // Increased from 3 - need more consistent patterns
  private readonly MIN_SIGNAL_VARIANCE = 0.04; // New threshold for minimum signal variance
  
  private readonly MIN_SIGNAL_THRESHOLD: number;
  private readonly MAX_SIGNAL_THRESHOLD: number;
  
  /**
   * Create a new signal validator with custom thresholds
   */
  constructor(
    minSignalAmplitude: number = 0.02, // Increased from 0.01
    minPpgValues: number = 15,
    minThreshold: number = 0.005,
    maxThreshold: number = 25
  ) {
    this.MIN_SIGNAL_AMPLITUDE = minSignalAmplitude;
    this.MIN_PPG_VALUES = minPpgValues;
    this.MIN_SIGNAL_THRESHOLD = minThreshold;
    this.MAX_SIGNAL_THRESHOLD = maxThreshold;
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
  public isValidSignal(value: number): boolean {
    return value >= this.MIN_SIGNAL_THRESHOLD && value <= this.MAX_SIGNAL_THRESHOLD;
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
    
    if (recentSignals.length < 15) return; // Need more data (increased from 10)
    
    // Check for minimum signal variance (reject near-constant signals)
    const values = recentSignals.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    if (variance < this.MIN_SIGNAL_VARIANCE) {
      // Signal variance too low - likely not a physiological signal
      this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
      return;
    }
    
    // Look for peaks in the signal
    const peaks: number[] = [];
    const peakThreshold = 0.25; // Increased from 0.2
    
    for (let i = 2; i < recentSignals.length - 2; i++) {
      const current = recentSignals[i];
      const prev1 = recentSignals[i - 1];
      const prev2 = recentSignals[i - 2];
      const next1 = recentSignals[i + 1];
      const next2 = recentSignals[i + 2];
      
      // Check if this point is a peak (higher than surrounding points)
      // Also require the peak to be significantly higher (20% higher)
      if (current.value > prev1.value * 1.2 && 
          current.value > prev2.value * 1.2 &&
          current.value > next1.value * 1.2 && 
          current.value > next2.value * 1.2 &&
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
      
      // Check for physiologically plausible heart rate (40-180 BPM)
      const validIntervals = intervals.filter(interval => 
        interval >= 333 && interval <= 1500 // 40-180 BPM
      );
      
      if (validIntervals.length < Math.floor(intervals.length * 0.7)) {
        // If less than 70% of intervals are physiologically plausible, reject the pattern
        this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
        return;
      }
      
      // Check for consistency in intervals (rhythm)
      let consistentIntervals = 0;
      const maxDeviation = 150; // Reduced from 200ms - tighter consistency check
      
      for (let i = 1; i < validIntervals.length; i++) {
        if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < maxDeviation) {
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
                     {
                       time: new Date(now).toISOString(), 
                       patterns: this.detectedPatternCount,
                       consistentIntervals,
                       peakCount: peaks.length,
                       meanInterval: validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length,
                       variance
                     });
        }
      } else {
        // Reduce counter if pattern not consistent
        this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
      }
    } else {
      // Decrement pattern count if we don't have enough peaks
      this.detectedPatternCount = Math.max(0, this.detectedPatternCount - 1);
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

  public getSignalQuality(signal: Float32Array): number {
    if (!signal || signal.length === 0) return 0;

    // Calculate signal quality based on various metrics
    const noiseLevel = this.calculateNoiseLevel(signal);
    const signalStrength = this.calculateSignalStrength(signal);
    const stability = this.calculateStability(signal);

    // Combine metrics into overall quality score (0-100)
    const quality = Math.min(100, Math.max(0,
      (1 - noiseLevel) * 40 +
      signalStrength * 30 +
      stability * 30
    ));

    return quality;
  }

  private calculateNoiseLevel(signal: Float32Array): number {
    // Calculate noise using standard deviation of differences
    const differences = new Float32Array(signal.length - 1);
    for (let i = 0; i < differences.length; i++) {
      differences[i] = signal[i + 1] - signal[i];
    }
    
    const mean = differences.reduce((a, b) => a + b, 0) / differences.length;
    const variance = differences.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / differences.length;
    
    return Math.min(1, Math.sqrt(variance) / this.MAX_SIGNAL_THRESHOLD);
  }

  private calculateSignalStrength(signal: Float32Array): number {
    const max = Math.max(...Array.from(signal));
    const min = Math.min(...Array.from(signal));
    const amplitude = max - min;
    
    return Math.min(1, amplitude / this.MAX_SIGNAL_THRESHOLD);
  }

  private calculateStability(signal: Float32Array): number {
    const windowSize = Math.min(50, signal.length);
    const windows = Math.floor(signal.length / windowSize);
    
    if (windows < 2) return 0;
    
    const means = new Float32Array(windows);
    for (let i = 0; i < windows; i++) {
      const start = i * windowSize;
      const end = start + windowSize;
      means[i] = signal.slice(start, end).reduce((a, b) => a + b, 0) / windowSize;
    }
    
    const meanVariance = this.calculateVariance(means);
    return Math.max(0, 1 - meanVariance / this.MAX_SIGNAL_THRESHOLD);
  }

  private calculateVariance(values: Float32Array): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  }
}
