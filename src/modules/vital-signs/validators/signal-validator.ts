/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validador de señal PPG para asegurar mediciones basadas solo en datos reales
 */
export class SignalValidator {
  private readonly minAmplitude: number;
  private readonly minDataPoints: number;
  private readonly minSignalStrength: number = 0.0005; // Reduced to improve sensitivity
  
  // Finger detection variables - more sensitive settings
  private signalPatternBuffer: number[] = [];
  private patternDetectionCounter: number = 0;
  private fingerDetected: boolean = false;
  private readonly PATTERN_BUFFER_SIZE = 15; // Reduced from 20 for faster detection
  private readonly MIN_PATTERN_DETECTION_COUNT = 2; // Reduced from 3 for faster detection

  constructor(minAmplitude: number = 0.003, minDataPoints: number = 8) {
    this.minAmplitude = minAmplitude;
    this.minDataPoints = minDataPoints;
  }
  
  /**
   * Verifica si un valor individual es una señal válida
   */
  public isValidSignal(value: number): boolean {
    return Math.abs(value) > this.minSignalStrength;
  }
  
  /**
   * Verifica si tenemos suficientes datos para análisis
   */
  public hasEnoughData(values: number[]): boolean {
    return values.length >= this.minDataPoints;
  }
  
  /**
   * Verifica si la amplitud de la señal es suficiente para análisis confiable
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 5) return false;
    
    // Tomar solo los últimos valores para análisis
    const recentValues = values.slice(-10); // Reduced from 15 for faster response
    
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    console.log("SignalValidator amplitude check:", {
      min, max, amplitude, threshold: this.minAmplitude
    });
    
    return amplitude >= this.minAmplitude;
  }
  
  /**
   * Track signal for rhythmic pattern detection to identify finger presence
   * Uses physiological characteristics to recognize true finger signals
   * More aggressive detection now
   */
  public trackSignalForPatternDetection(value: number): void {
    // Add value to pattern buffer
    this.signalPatternBuffer.push(value);
    
    // Keep buffer at fixed size
    if (this.signalPatternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.signalPatternBuffer.shift();
    }
    
    // Only attempt pattern detection with sufficient data
    if (this.signalPatternBuffer.length >= this.PATTERN_BUFFER_SIZE) {
      const hasRhythmicPattern = this.detectRhythmicPattern(this.signalPatternBuffer);
      
      if (hasRhythmicPattern) {
        this.patternDetectionCounter = Math.min(this.patternDetectionCounter + 1, this.MIN_PATTERN_DETECTION_COUNT + 3);
        console.log("SignalValidator: Rhythmic pattern detected", { counter: this.patternDetectionCounter });
      } else {
        this.patternDetectionCounter = Math.max(0, this.patternDetectionCounter - 1);
      }
      
      // Update finger detection status based on consistent pattern detection
      const wasDetected = this.fingerDetected;
      this.fingerDetected = this.patternDetectionCounter >= this.MIN_PATTERN_DETECTION_COUNT;
      
      if (this.fingerDetected !== wasDetected) {
        console.log("SignalValidator: Finger detection changed to", this.fingerDetected);
      }
    }
  }
  
  /**
   * Check if finger is detected based on physiological signal patterns
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.signalPatternBuffer = [];
    this.patternDetectionCounter = 0;
    this.fingerDetected = false;
  }
  
  /**
   * Detect rhythmic patterns in signal that are characteristic of PPG
   * Looking for periodic patterns with physiological timing
   * Much more sensitive parameters used here
   */
  private detectRhythmicPattern(values: number[]): boolean {
    if (values.length < 8) return false; // Reduced from 10
    
    // Calculate local peaks to find heartbeat rhythm - more lenient peak detection
    const peaks: number[] = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(i);
      }
    }
    
    // Need at least 2 peaks to analyze intervals
    if (peaks.length < 2) {
      console.log("SignalValidator: Not enough peaks found", { peakCount: peaks.length });
      return false;
    }
    
    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Check if intervals are within physiological range (30-220 BPM)
    // At 30Hz sampling, that's roughly between 8-60 samples between peaks
    // Much more lenient now: 25-240 BPM or 7-72 samples
    const validIntervals = intervals.filter(interval => interval >= 7 && interval <= 72);
    
    // Calculate consistency of intervals (CV < 0.30 for stable rhythm - more lenient)
    if (validIntervals.length >= 2) {
      const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
      const variance = validIntervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / validIntervals.length;
      const cv = Math.sqrt(variance) / avgInterval; // Coefficient of variation
      
      console.log("SignalValidator rhythm metrics:", { 
        validIntervals: validIntervals.length,
        totalIntervals: intervals.length,
        avgInterval, 
        cv, 
        threshold: 0.30 
      });
      
      // CV < 0.30 indicates consistent periodic pattern (more lenient than 0.25)
      return cv < 0.30;
    }
    
    console.log("SignalValidator: Not enough valid intervals found", { 
      validIntervals: validIntervals.length, 
      totalIntervals: intervals.length 
    });
    return false;
  }
  
  /**
   * Registra los resultados de validación para depuración
   */
  public logValidationResults(
    isValid: boolean, 
    amplitude: number, 
    values: number[]
  ): void {
    if (!isValid) {
      console.log("SignalValidator: Señal no válida", {
        amplitud: amplitude,
        umbralMinimo: this.minAmplitude,
        longitudDatos: values.length,
        ultimosValores: values.slice(-5),
        fingerDetected: this.fingerDetected
      });
    }
  }
}
