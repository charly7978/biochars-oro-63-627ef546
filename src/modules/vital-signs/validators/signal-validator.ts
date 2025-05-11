
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useSignalQualityDetector } from '../../../hooks/vital-signs/use-signal-quality-detector';

/**
 * Validates PPG signals to ensure they meet requirements
 * Works with real data only, no simulation
 * Enhanced with rhythmic pattern detection for finger detection
 * Esta clase ahora utiliza useSignalQualityDetector para centralizar la lógica
 */
export class SignalValidator {
  // Thresholds for physiological detection
  private readonly MIN_SIGNAL_AMPLITUDE: number;
  private readonly MIN_PPG_VALUES: number;
  
  // Handle para el detector centralizado
  private detector: ReturnType<typeof useSignalQualityDetector>;
  
  /**
   * Create a new signal validator with custom thresholds
   */
  constructor(
    minSignalAmplitude: number = 0.02,
    minPpgValues: number = 15
  ) {
    this.MIN_SIGNAL_AMPLITUDE = minSignalAmplitude;
    this.MIN_PPG_VALUES = minPpgValues;
    
    // Inicializar detector central
    this.detector = useSignalQualityDetector();
    
    // Configurar detector según los parámetros de esta clase
    this.detector.updateConfig({
      minSignalVariance: minSignalAmplitude / 2,
      weakSignalThreshold: minSignalAmplitude
    });
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
    return !this.detector.detectWeakSignal(ppgValue);
  }
  
  /**
   * Add value to signal history for pattern detection
   */
  public trackSignalForPatternDetection(value: number): void {
    // Utilizar detector central para el tracking
    this.detector.detectWeakSignal(value);
  }
  
  /**
   * Check if a finger is detected based on rhythmic patterns
   */
  public isFingerDetected(): boolean {
    return this.detector.isFingerDetected();
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.detector.reset();
    console.log("SignalValidator: Finger detection state reset.");
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
  
  /**
   * Get diagnostic information
   */
  public getDiagnostics(): any {
    return this.detector.getDiagnostics();
  }
}
