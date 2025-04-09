
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validates signal characteristics to ensure high quality real measurements
 * All methods work with real signals only, no simulations
 */
export class SignalValidator {
  private readonly signalThreshold: number;
  private readonly minDataPoints: number;
  private readonly MIN_AMPLITUDE = 0.05;
  
  // Pattern detection for finger presence
  private readonly patternBuffer: number[] = [];
  private readonly MAX_PATTERN_BUFFER = 60; // 2 seconds @ 30Hz
  private readonly MIN_ACCEPTABLE_PERIODICITY = 0.3;
  private readonly MIN_ACCEPTABLE_AMPLITUDE = 0.05;
  private fingerDetected: boolean = false;
  private confidenceCounter: number = 0;
  private readonly MIN_CONFIDENCE_THRESHOLD = 5;
  private readonly MAX_CONFIDENCE_THRESHOLD = 15;
  private lastDetectionTime: number | null = null;

  constructor(signalThreshold: number = 0.01, minDataPoints: number = 15) {
    this.signalThreshold = signalThreshold;
    this.minDataPoints = minDataPoints;
  }

  /**
   * Validates if the signal value is meaningful
   */
  public isValidSignal(value: number): boolean {
    return !isNaN(value) && Math.abs(value) >= this.signalThreshold && Math.abs(value) < 100;
  }

  /**
   * Checks if there are enough data points for analysis
   */
  public hasEnoughData(values: number[]): boolean {
    return values.length >= this.minDataPoints;
  }

  /**
   * Checks if the signal has sufficient amplitude for accurate measurements
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 5) {
      return false;
    }
    
    const recentValues = values.slice(-20);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    return amplitude >= this.MIN_AMPLITUDE;
  }

  /**
   * Log validation results for debugging
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("Signal validation results:", {
      isValid,
      amplitude,
      threshold: this.MIN_AMPLITUDE,
      dataPoints: values.length,
      requiredPoints: this.minDataPoints
    });
  }
  
  /**
   * Track signal for pattern-based finger detection
   * This helps detect rhythmic patterns consistent with heartbeats
   */
  public trackSignalForPatternDetection(value: number): void {
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.MAX_PATTERN_BUFFER) {
      this.patternBuffer.shift();
    }
    
    // Run pattern detection every 10 new values
    if (this.patternBuffer.length % 10 === 0 && this.patternBuffer.length >= 30) {
      this.detectFingerUsingPattern();
    }
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.fingerDetected = false;
    this.confidenceCounter = 0;
    this.lastDetectionTime = null;
    this.patternBuffer.length = 0;
  }
  
  /**
   * Check if finger is detected based on signal patterns
   */
  public isFingerDetected(): boolean {
    // Quick early return if we've already detected
    if (this.fingerDetected && this.confidenceCounter > this.MIN_CONFIDENCE_THRESHOLD) {
      return true;
    }
    
    // If pattern buffer isn't full enough yet, use amplitude check
    if (this.patternBuffer.length < 30) {
      if (this.patternBuffer.length >= 10) {
        const amplitude = Math.max(...this.patternBuffer) - Math.min(...this.patternBuffer);
        return amplitude >= this.MIN_ACCEPTABLE_AMPLITUDE;
      }
      return false;
    }
    
    // Time-based confidence decay
    if (this.lastDetectionTime !== null) {
      const now = Date.now();
      const timeSinceLastDetection = now - this.lastDetectionTime;
      
      // If it's been too long since our last successful detection, decay confidence
      if (timeSinceLastDetection > 3000) { // 3 seconds
        this.confidenceCounter = Math.max(0, this.confidenceCounter - 1);
        this.lastDetectionTime = now;
      }
    }
    
    return this.fingerDetected;
  }
  
  /**
   * Detect finger presence using rhythmic pattern analysis
   * Works with real PPG signals looking for cardiac-like rhythms
   */
  private detectFingerUsingPattern(): void {
    if (this.patternBuffer.length < 30) {
      return;
    }
    
    // Check amplitude
    const min = Math.min(...this.patternBuffer);
    const max = Math.max(...this.patternBuffer);
    const amplitude = max - min;
    
    if (amplitude < this.MIN_ACCEPTABLE_AMPLITUDE) {
      this.confidenceCounter = Math.max(0, this.confidenceCounter - 1);
      this.fingerDetected = this.confidenceCounter > 0;
      return;
    }
    
    // Normalize signal for better analysis
    const mean = this.patternBuffer.reduce((sum, val) => sum + val, 0) / this.patternBuffer.length;
    const normalizedSignal = this.patternBuffer.map(val => val - mean);
    
    // Check periodicity using autocorrelation
    const periodicityScore = this.calculatePeriodicityScore(normalizedSignal);
    
    // Check for signal consistency
    const variance = this.calculateVariance(normalizedSignal);
    const consistencyScore = Math.max(0, 1 - (variance / (amplitude * amplitude)));
    
    // Calculate overall finger detection score
    const amplitudeScore = Math.min(1, amplitude / (this.MIN_ACCEPTABLE_AMPLITUDE * 3));
    const overallScore = (periodicityScore * 0.5) + (consistencyScore * 0.3) + (amplitudeScore * 0.2);
    
    // Update finger detection status
    if (overallScore >= this.MIN_ACCEPTABLE_PERIODICITY) {
      this.confidenceCounter = Math.min(this.MAX_CONFIDENCE_THRESHOLD, this.confidenceCounter + 1);
      this.fingerDetected = true;
      this.lastDetectionTime = Date.now();
    } else {
      this.confidenceCounter = Math.max(0, this.confidenceCounter - 1);
      this.fingerDetected = this.confidenceCounter > 0;
    }
    
    // Log detection results every few calculations
    if (this.patternBuffer.length % 30 === 0) {
      console.log("Finger detection analysis:", {
        overallScore,
        periodicityScore,
        consistencyScore,
        amplitudeScore,
        amplitude,
        threshold: this.MIN_ACCEPTABLE_PERIODICITY,
        confidence: this.confidenceCounter,
        isDetected: this.fingerDetected
      });
    }
  }
  
  /**
   * Calculate periodicity score using autocorrelation
   * Higher values indicate more heartbeat-like rhythm
   */
  private calculatePeriodicityScore(signal: number[]): number {
    // Use autocorrelation to detect periodic patterns
    const halfSize = Math.floor(signal.length / 2);
    const correlations: number[] = [];
    
    for (let lag = 5; lag < halfSize; lag++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < halfSize; i++) {
        if ((i + lag) < signal.length) {
          correlation += signal[i] * signal[i + lag];
          count++;
        }
      }
      
      correlations.push(count > 0 ? correlation / count : 0);
    }
    
    // Find peak in correlation, which indicates periodicity
    if (correlations.length > 5) {
      const max = Math.max(...correlations);
      const mean = correlations.reduce((sum, val) => sum + val, 0) / correlations.length;
      
      // If max is significantly higher than mean, we have periodicity
      return max > 0 ? max / Math.max(0.001, mean) * 0.5 : 0;
    }
    
    return 0;
  }
  
  /**
   * Calculate signal variance
   */
  private calculateVariance(signal: number[]): number {
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    return variance;
  }
}
