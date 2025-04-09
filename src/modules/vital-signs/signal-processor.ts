
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * No simulation or reference values are used
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  
  // Raw signal buffer for direct processing
  private rawPpgValues: number[] = [];
  
  // Finger detection state
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - more relaxed thresholds for real signals
  private readonly MIN_QUALITY_FOR_FINGER = 20; // Reduced for better sensitivity
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 1500; // Faster response
  private readonly MIN_SIGNAL_AMPLITUDE = 0.08; // Lower threshold for real signals
  
  // Signal processing params
  private processingCount: number = 0;
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.005, 8); // More sensitive thresholds
    
    console.log("SignalProcessor: Inicializado para procesamiento de señales REALES únicamente");
  }
  
  /**
   * Apply Moving Average filter to real values
   * Now maintains both raw and filtered values
   */
  public applySMAFilter(value: number): number {
    this.processingCount++;
    
    // Store raw value for direct processing
    this.rawPpgValues.push(value);
    if (this.rawPpgValues.length > 100) {
      this.rawPpgValues.shift();
    }
    
    // Log every 20th value
    if (this.processingCount % 20 === 0) {
      console.log("SignalProcessor: Aplicando filtro SMA a señal REAL", {
        valorOriginal: value,
        bufferedRawValues: this.rawPpgValues.length,
        bufferedFilteredValues: this.ppgValues.length
      });
    }
    
    return this.filter.applySMAFilter(value, this.ppgValues);
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   */
  public applyEMAFilter(value: number, alpha?: number): number {
    return this.filter.applyEMAFilter(value, this.ppgValues, alpha);
  }
  
  /**
   * Apply median filter to real data
   */
  public applyMedianFilter(value: number): number {
    return this.filter.applyMedianFilter(value, this.ppgValues);
  }
  
  /**
   * Get raw PPG values for direct processing
   */
  public getRawPPGValues(): number[] {
    return [...this.rawPpgValues];
  }
  
  /**
   * Check if finger is detected based on rhythmic patterns
   * Uses physiological characteristics (heartbeat rhythm)
   */
  public isFingerDetected(): boolean {
    // If already confirmed through consistent patterns, maintain detection
    if (this.fingerDetectionConfirmed) {
      return true;
    }
    
    // Otherwise, use the validator's pattern detection
    return this.signalValidator.isFingerDetected();
  }
  
  /**
   * Apply combined filtering for real signal processing
   * No simulation is used
   * Incorporates rhythmic pattern-based finger detection
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean, rawValue: number } {
    this.processingCount++;
    
    // Store raw value first for direct processing
    this.rawPpgValues.push(value);
    if (this.rawPpgValues.length > 100) {
      this.rawPpgValues.shift();
    }
    
    // Track the signal for pattern detection with REAL signal
    this.signalValidator.trackSignalForPatternDetection(value);
    
    // Step 1: Median filter to remove outliers
    const medianFiltered = this.applyMedianFilter(value);
    
    // Step 2: Low pass filter to smooth the signal
    const lowPassFiltered = this.applyEMAFilter(medianFiltered, 0.25); // Adjusted alpha for better responsiveness
    
    // Step 3: Moving average for final smoothing
    const smaFiltered = this.applySMAFilter(lowPassFiltered);
    
    // Calculate noise level of real signal
    this.quality.updateNoiseLevel(value, smaFiltered);
    
    // Calculate signal quality (0-100)
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
    
    // Store the filtered value in the buffer
    this.ppgValues.push(smaFiltered);
    if (this.ppgValues.length > 30) {
      this.ppgValues.shift();
    }
    
    // Check finger detection using pattern recognition with appropriate quality threshold
    const fingerDetected = this.signalValidator.isFingerDetected() && 
                           (qualityValue >= this.MIN_QUALITY_FOR_FINGER || this.fingerDetectionConfirmed);
    
    // Calculate signal amplitude from REAL data
    let amplitude = 0;
    if (this.ppgValues.length > 10) {
      const recentValues = this.ppgValues.slice(-10);
      amplitude = Math.max(...recentValues) - Math.min(...recentValues);
    }
    
    // More sensitive amplitude detection for real signals
    const hasValidAmplitude = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    
    // If finger is detected by pattern and has valid amplitude, confirm it
    if (fingerDetected && hasValidAmplitude && !this.fingerDetectionConfirmed) {
      const now = Date.now();
      
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = now;
        console.log("Signal processor: Detección de dedo potencial iniciada", {
          time: new Date(now).toISOString(),
          quality: qualityValue,
          amplitude
        });
      }
      
      // If finger detection has been consistent for required time period, confirm it
      if (this.fingerDetectionStartTime && (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME)) {
        this.fingerDetectionConfirmed = true;
        this.rhythmBasedFingerDetection = true;
        console.log("Signal processor: Detección de dedo CONFIRMADA por patrón rítmico!", {
          time: new Date(now).toISOString(),
          detectionMethod: "Detección de patrón rítmico",
          detectionDuration: (now - this.fingerDetectionStartTime) / 1000,
          quality: qualityValue,
          amplitude
        });
      }
    } else if (!fingerDetected || !hasValidAmplitude) {
      // Reset finger detection if lost or amplitude too low
      if (this.fingerDetectionConfirmed) {
        console.log("Signal processor: Detección de dedo perdida", {
          hasValidPattern: fingerDetected,
          hasValidAmplitude,
          amplitude,
          quality: qualityValue
        });
      }
      
      this.fingerDetectionConfirmed = false;
      this.fingerDetectionStartTime = null;
      this.rhythmBasedFingerDetection = false;
    }
    
    // Log filter results periodically
    if (this.processingCount % 20 === 0) {
      console.log("Resultado de filtrado:", {
        original: value,
        median: medianFiltered,
        ema: lowPassFiltered,
        sma: smaFiltered,
        quality: qualityValue,
        fingerDetected: (fingerDetected && hasValidAmplitude) || this.fingerDetectionConfirmed,
        amplitude
      });
    }
    
    return { 
      filteredValue: smaFiltered,
      rawValue: value, // Now returning the raw value directly
      quality: qualityValue,
      fingerDetected: (fingerDetected && hasValidAmplitude) || this.fingerDetectionConfirmed
    };
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    // Use both filtered and raw values for better accuracy
    const rawBpm = this.heartRateDetector.calculateHeartRate(this.rawPpgValues, sampleRate);
    const filteredBpm = this.heartRateDetector.calculateHeartRate(this.ppgValues, sampleRate);
    
    // Weighted average with more weight to filtered for stability
    const bpm = rawBpm > 0 && filteredBpm > 0 
      ? (filteredBpm * 0.7 + rawBpm * 0.3) 
      : (filteredBpm > 0 ? filteredBpm : rawBpm);
    
    console.log("Heart rate calculation from REAL data:", { 
      rawBpm,
      filteredBpm,
      combinedBpm: bpm,
      rawBufferSize: this.rawPpgValues.length,
      filteredBufferSize: this.ppgValues.length
    });
    
    return bpm;
  }
  
  /**
   * Get the PPG values buffer
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Reset the signal processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    super.reset();
    this.rawPpgValues = [];
    this.quality.reset();
    this.signalValidator.resetFingerDetection();
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
    this.processingCount = 0;
    
    console.log("SignalProcessor: Reset completado, todos los buffers y estado limpiados");
  }
}
