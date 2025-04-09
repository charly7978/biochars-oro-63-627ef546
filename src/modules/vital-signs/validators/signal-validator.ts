/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validator for PPG signals to ensure quality and presence
 * Enhanced with improved fingerprint detection and signal quality assessment
 */
export class SignalValidator {
  // Signal quality parameters - adjusted for real signals
  private readonly DEFAULT_MIN_AMPLITUDE_THRESHOLD: number = 0.01; // Reduced threshold
  private readonly DEFAULT_MIN_VALUES_COUNT: number = 12; // Reduced buffer length
  private readonly MAX_THRESHOLD_VARIANCE: number = 0.025; // Increased variance allowance
  
  // Rhythm detection parameters for finger detection
  private readonly RHYTHM_DETECTION_BUFFER_SIZE: number = 30; // Reduced buffer for faster detection
  private readonly PATTERN_DETECTION_SAMPLE_RATE: number = 30; // Hz
  private readonly MIN_PEAK_DISTANCE_MS: number = 300; // 300ms (200 BPM max)
  private readonly MAX_PEAK_DISTANCE_MS: number = 1500; // 1500ms (40 BPM min)
  private readonly PEAK_THRESHOLD_FACTOR: number = 0.35; // Decreased for better sensitivity
  
  // Buffer for rhythm-based finger detection
  private patternDetectionBuffer: number[] = [];
  private peakTimes: number[] = [];
  private lastPeakAmplitude: number = 0;
  private lastPeakTime: number | null = null;
  private patternDetectionStartTime: number = Date.now();
  
  // Finger detection state
  private fingerDetected: boolean = false;
  private patternConfidence: number = 0;
  private consecutiveValidPatterns: number = 0;
  private readonly MIN_CONSECUTIVE_PATTERNS: number = 2; // Reduced from 3
  
  // Configuration
  private minAmplitudeThreshold: number;
  private minValuesCount: number;

  constructor(
    minAmplitudeThreshold: number = 0.01, 
    minValuesCount: number = 12
  ) {
    this.minAmplitudeThreshold = minAmplitudeThreshold || this.DEFAULT_MIN_AMPLITUDE_THRESHOLD;
    this.minValuesCount = minValuesCount || this.DEFAULT_MIN_VALUES_COUNT;
    
    console.log("SignalValidator: Inicializado con umbrales optimizados", {
      minAmplitudeThreshold: this.minAmplitudeThreshold,
      minValuesCount: this.minValuesCount,
      patternDetectionBufferSize: this.RHYTHM_DETECTION_BUFFER_SIZE
    });
  }
  
  /**
   * Check if signal has near-zero value (invalid)
   * More sensitive threshold for real signals
   */
  public isValidSignal(value: number, zeroThreshold: number = 0.005): boolean {
    return Math.abs(value) > zeroThreshold;
  }
  
  /**
   * Check if we have enough data points for processing
   * More sensitive threshold for real signals
   */
  public hasEnoughData(values: number[], minCount: number | null = null): boolean {
    const minRequired = minCount !== null ? minCount : this.minValuesCount;
    return values.length >= minRequired;
  }
  
  /**
   * Check if signal has sufficient amplitude for reliable measurement
   * More sensitive threshold for real signals
   */
  public hasValidAmplitude(values: number[], customThreshold?: number): boolean {
    if (values.length < Math.min(5, this.minValuesCount)) {
      return false;
    }
    
    // Use last 10 values to check amplitude
    const lastValues = values.slice(-10);
    const min = Math.min(...lastValues);
    const max = Math.max(...lastValues);
    const amplitude = max - min;
    
    // Apply provided or default threshold
    const threshold = customThreshold || this.minAmplitudeThreshold;
    const isValid = amplitude >= threshold;
    
    if (!isValid) {
      console.log("SignalValidator: Amplitud insuficiente", {
        amplitud: amplitude,
        umbral: threshold,
        min,
        max
      });
    }
    
    return isValid;
  }
  
  /**
   * Track signal for rhythmic pattern detection
   * Optimized for real-time pattern recognition
   */
  public trackSignalForPatternDetection(value: number): void {
    // Add value to buffer
    this.patternDetectionBuffer.push(value);
    if (this.patternDetectionBuffer.length > this.RHYTHM_DETECTION_BUFFER_SIZE) {
      this.patternDetectionBuffer.shift();
    }
    
    if (this.patternDetectionBuffer.length < 10) {
      return;
    }
    
    // Detect peaks in real-time
    this.detectPeaks();
    
    // Analyze rhythm patterns for finger detection
    this.analyzeRhythmPattern();
  }
  
  /**
   * Detect peaks in signal for rhythm analysis
   * Enhanced for better detection of cardiac patterns
   */
  private detectPeaks(): void {
    const bufferLength = this.patternDetectionBuffer.length;
    if (bufferLength < 5) return;
    
    // Get last 5 values for peak detection
    const recentValues = this.patternDetectionBuffer.slice(-5);
    const midPoint = Math.floor(recentValues.length / 2);
    const midValue = recentValues[midPoint];
    
    // Calculate dynamic threshold based on recent signal history
    const valuesForThreshold = this.patternDetectionBuffer.slice(-10);
    const min = Math.min(...valuesForThreshold);
    const max = Math.max(...valuesForThreshold);
    const range = max - min;
    const threshold = min + range * this.PEAK_THRESHOLD_FACTOR;
    
    // Only process potential peaks with sufficient amplitude
    if (range < this.minAmplitudeThreshold * 0.5) {
      return;
    }
    
    // Check if current value is a local maximum
    const isPeak = midValue > threshold &&
                  midValue > recentValues[midPoint - 1] &&
                  midValue > recentValues[midPoint - 2] &&
                  midValue > recentValues[midPoint + 1] &&
                  midValue >= recentValues[midPoint + 2];
    
    if (isPeak) {
      const now = Date.now();
      const timeSinceDetectionStart = now - this.patternDetectionStartTime;
      
      // Check if this peak is sufficiently spaced from the last one
      if (this.lastPeakTime === null || 
          (now - this.lastPeakTime >= this.MIN_PEAK_DISTANCE_MS)) {
        
        // Record peak time and amplitude
        this.peakTimes.push(now);
        this.lastPeakAmplitude = midValue;
        this.lastPeakTime = now;
        
        // Keep only recent peaks
        if (this.peakTimes.length > 10) {
          this.peakTimes.shift();
        }
        
        // Log every peak with more detail for real signals
        console.log("SignalValidator: Pico detectado en señal REAL", {
          amplitude: midValue,
          threshold,
          peakCount: this.peakTimes.length,
          timeSinceStart: timeSinceDetectionStart,
          signalToNoise: range > 0 ? midValue / range : 0
        });
      }
    }
  }
  
  /**
   * Analyze rhythm pattern to detect regular cardiac patterns
   * Enhanced for real PPG signals
   */
  private analyzeRhythmPattern(): void {
    if (this.peakTimes.length < 3) {
      // Not enough peaks to establish pattern
      this.patternConfidence = 0;
      return;
    }
    
    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < this.peakTimes.length; i++) {
      intervals.push(this.peakTimes[i] - this.peakTimes[i - 1]);
    }
    
    // Check if intervals are within physiological heart rate range (40-200 BPM)
    const validIntervals = intervals.filter(
      interval => interval >= this.MIN_PEAK_DISTANCE_MS && interval <= this.MAX_PEAK_DISTANCE_MS
    );
    
    if (validIntervals.length < 2) {
      // Not enough valid intervals
      this.patternConfidence = 0;
      this.consecutiveValidPatterns = 0;
      return;
    }
    
    // Calculate variability to determine pattern regularity
    const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    const intervalVariability = validIntervals.reduce(
      (sum, val) => sum + Math.abs(val - avgInterval) / avgInterval, 
      0
    ) / validIntervals.length;
    
    // More permissive threshold for variability with real signals
    const hasRegularPattern = intervalVariability < this.MAX_THRESHOLD_VARIANCE * 1.5;
    
    // Calculate estimated heart rate for validation
    const estimatedBPM = 60000 / avgInterval;
    const isValidBPM = estimatedBPM >= 40 && estimatedBPM <= 200;
    
    // Update confidence based on pattern quality
    if (hasRegularPattern && isValidBPM) {
      // Stronger confidence with stable, physiologically valid pattern
      this.patternConfidence = Math.min(1.0, (1.0 - intervalVariability * 10) * 
                                       (validIntervals.length / intervals.length));
      this.consecutiveValidPatterns++;
    } else {
      // Gradually reduce confidence for invalid patterns
      this.patternConfidence = Math.max(0, this.patternConfidence - 0.2);
      this.consecutiveValidPatterns = 0;
    }
    
    // Update finger detection state - more sensitive for real signals
    if (this.consecutiveValidPatterns >= this.MIN_CONSECUTIVE_PATTERNS && 
        this.patternConfidence > 0.4) { // Reduced threshold
      this.fingerDetected = true;
    } else if (this.patternConfidence < 0.2 || this.consecutiveValidPatterns === 0) {
      this.fingerDetected = false;
    }
    
    // Log pattern analysis results
    console.log("SignalValidator: Análisis de patrón cardíaco:", {
      intervalos: intervals.length,
      intervalosValidos: validIntervals.length,
      variabilidad: intervalVariability,
      bpmEstimado: estimatedBPM,
      confianza: this.patternConfidence,
      patronesConsecutivos: this.consecutiveValidPatterns,
      dedoDetectado: this.fingerDetected
    });
  }
  
  /**
   * Check if finger is detected based on rhythmic patterns
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }
  
  /**
   * Get pattern detection confidence
   */
  public getPatternConfidence(): number {
    return this.patternConfidence;
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.patternDetectionBuffer = [];
    this.peakTimes = [];
    this.lastPeakAmplitude = 0;
    this.lastPeakTime = null;
    this.patternDetectionStartTime = Date.now();
    this.fingerDetected = false;
    this.patternConfidence = 0;
    this.consecutiveValidPatterns = 0;
    
    console.log("SignalValidator: Detección de dedo reseteada");
  }
  
  /**
   * Log validation results
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    const min = Math.min(...values.slice(-10));
    const max = Math.max(...values.slice(-10));
    
    console.log("SignalValidator: Resultados de validación", {
      esValido: isValid,
      amplitud: amplitude,
      umbral: this.minAmplitudeThreshold,
      min,
      max,
      valoresUtilizados: values.length,
      valorMinRequerido: this.minValuesCount,
      dedoDetectado: this.fingerDetected,
      confianzaPatron: this.patternConfidence,
      patronesConsecutivos: this.consecutiveValidPatterns
    });
  }
}
