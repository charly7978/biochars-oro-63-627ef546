/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';
import { applySMAFilter } from '@/core/signal/filters/movingAverage';
import { applyMedianFilter } from '@/core/signal/filters/medianFilter';
import { calculateEMA } from '@/lib/utils';

// CONSTANTES (Podrían moverse a un archivo de configuración)
const MEDIAN_WINDOW_SIZE = 3;
const SMA_WINDOW_SIZE = 5;
const EMA_ALPHA = 0.2;

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * No simulation or reference values are used
 */
export class SignalProcessor extends BaseProcessor {
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  
  // Estado interno para filtros
  private medianBuffer: number[] = [];
  private smaBuffer: number[] = [];
  private prevEMA: number | null = null; // Inicializamos como null
  
  // Finger detection state
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - more strict thresholds
  private readonly MIN_QUALITY_FOR_FINGER = 45; // Increased from default
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 3500; // Increased from 3000
  private readonly MIN_SIGNAL_AMPLITUDE = 0.25; // Increased from previous value
  
  constructor() {
    super();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.02, 15); // Increased thresholds
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
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean } {
    // Track the signal for pattern detection
    this.signalValidator.trackSignalForPatternDetection(value);
    
    // Step 1: Median filter to remove outliers
    const { filteredValue: medianFiltered, updatedBuffer: newMedianBuffer } = applyMedianFilter(value, this.medianBuffer, MEDIAN_WINDOW_SIZE);
    this.medianBuffer = newMedianBuffer;
    
    // Step 2: Low pass filter (EMA) to smooth the signal
    // Usamos calculateEMA directamente. Si prevEMA es null (primera vez), calculateEMA lo manejará.
    const emaFiltered = calculateEMA(medianFiltered, this.prevEMA === null ? medianFiltered : this.prevEMA, EMA_ALPHA);
    this.prevEMA = emaFiltered; // Actualizamos prevEMA para la próxima iteración
    
    // Step 3: Moving average (SMA) for final smoothing
    const { filteredValue: smaFiltered, updatedBuffer: newSmaBuffer } = applySMAFilter(emaFiltered, this.smaBuffer, SMA_WINDOW_SIZE);
    this.smaBuffer = newSmaBuffer;
    
    // Calculate noise level of real signal
    // Asumimos que updateNoiseLevel usa el valor crudo y el filtrado final (SMA)
    this.quality.updateNoiseLevel(value, smaFiltered);
    
    // Calculate signal quality (0-100)
    // Pasamos el buffer de valores *filtrados* (SMA) si es lo que espera calculateSignalQuality
    // O podríamos necesitar mantener un buffer de valores crudos si es necesario.
    // Por ahora, pasamos el buffer SMA. ¡VERIFICAR ESTO!
    const qualityValue = this.quality.calculateSignalQuality(this.smaBuffer);
    
    // Store the filtered value in the *main* processor buffer (ppgValues from BaseProcessor)
    this.ppgValues.push(smaFiltered); // Guardamos el valor final filtrado
    if (this.ppgValues.length > 30) { // Usamos un tamaño de buffer consistente si es necesario
      this.ppgValues.shift();
    }
    
    // Check finger detection using pattern recognition with a higher quality threshold
    const patternDetected = this.signalValidator.isFingerDetected();
    const fingerDetectedByQuality = qualityValue >= this.MIN_QUALITY_FOR_FINGER;
    
    // Calculate signal amplitude from the *filtered* signal buffer
    let amplitude = 0;
    if (this.ppgValues.length > 10) {
      const recentValues = this.ppgValues.slice(-10);
      amplitude = Math.max(...recentValues) - Math.min(...recentValues);
    }
    
    // Require minimum amplitude for detection (physiological requirement)
    const hasValidAmplitude = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    
    // Logic for confirming finger detection
    const potentialFinger = patternDetected && (fingerDetectedByQuality || this.fingerDetectionConfirmed) && hasValidAmplitude;
    
    if (potentialFinger && !this.fingerDetectionConfirmed) {
      const now = Date.now();
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = now;
        console.log("Signal processor: Potential finger detection started", {
          time: new Date(now).toISOString(),
          quality: qualityValue,
          amplitude,
          patternDetected,
          fingerDetectedByQuality
        });
      }
      
      if (this.fingerDetectionStartTime && (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME)) {
        this.fingerDetectionConfirmed = true;
        this.rhythmBasedFingerDetection = true; // Asumimos que la detección de patrón implica ritmo
        console.log("Signal processor: Finger detection CONFIRMED!", {
          time: new Date(now).toISOString(),
          detectionMethod: "Rhythmic pattern & Quality & Amplitude",
          detectionDuration: (now - this.fingerDetectionStartTime) / 1000,
          quality: qualityValue,
          amplitude
        });
      }
    } else if (!potentialFinger) {
      // Reset finger detection if lost
      if (this.fingerDetectionConfirmed) {
        console.log("Signal processor: Finger detection lost", {
          patternDetected,
          fingerDetectedByQuality,
          hasValidAmplitude,
          amplitude,
          quality: qualityValue
        });
      }
      this.fingerDetectionConfirmed = false;
      this.fingerDetectionStartTime = null;
      this.rhythmBasedFingerDetection = false;
    }
    
    return {
      filteredValue: smaFiltered,
      quality: qualityValue,
      // La detección final es si está confirmada o si cumple las condiciones ahora
      fingerDetected: this.fingerDetectionConfirmed || potentialFinger
    };
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    // Asegúrate de que HeartRateDetector use ppgValues (que ahora contiene valores filtrados con SMA)
    return this.heartRateDetector.calculateHeartRate(this.ppgValues, sampleRate);
  }
  
  /**
   * Reset the signal processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    super.reset(); // Resetea ppgValues
    this.quality.reset();
    this.signalValidator.resetFingerDetection();
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
    // Resetea estados de filtros
    this.medianBuffer = [];
    this.smaBuffer = [];
    this.prevEMA = null;
    this.heartRateDetector.reset(); // Asegúrate que el detector de HR también se resetea
  }
}
