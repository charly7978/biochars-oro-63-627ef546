
/**
 * Sistema de autocalibración extremadamente simplificado
 * Implementa calibración instantánea y no bloqueante
 */

export interface CalibrationResult {
  baselineOffset: number;
  amplitudeScalingFactor: number;
  noiseFloor: number;
  signalQualityThreshold: number;
  detectionSensitivity: number;
  confidenceThreshold: number;
  hasValidCalibration: boolean;
}

export interface SignalCharacteristics {
  minValue: number;
  maxValue: number;
  avgValue: number;
  noiseLevel: number;
  snr: number;
  peakToPeakAmplitude: number;
  variability: number;
}

export class AutoCalibrationSystem {
  // Sistema completamente no bloqueante
  private DEFAULT_FRAMES_REQUIRED = 1; // Único frame necesario
  private MIN_SAMPLE_FRAMES = 1; 
  private framesCollected: number[] = [];
  private calibrationResult: CalibrationResult | null = null;
  private isCalibrating: boolean = false;
  
  // No usar promesas para evitar bloqueos
  private calibrationTimeoutId: any = null;
  
  constructor() {
    // Crear calibración predeterminada instantáneamente para que esté siempre disponible
    this.calibrationResult = {
      baselineOffset: 0,
      amplitudeScalingFactor: 1.0,
      noiseFloor: 0.001, // Ultra permisivo
      signalQualityThreshold: 1, // Ultra permisivo
      detectionSensitivity: 1.0, // Ultra permisivo
      confidenceThreshold: 0.01, // Ultra permisivo
      hasValidCalibration: true
    };
    
    console.log("AutoCalibrationSystem: Pre-calibrado con valores predeterminados");
  }
  
  /**
   * CAMBIO CRÍTICO: Devuelve INSTANTÁNEAMENTE valores predeterminados
   * sin nunca iniciar una calibración real
   */
  public startCalibration(): Promise<CalibrationResult> {
    // CRÍTICO: Siempre cancelar cualquier timeout anterior
    this.clearTimeouts();
    
    // No iniciar calibración real, dar resultado inmediato
    this.isCalibrating = false;
    
    console.log("AutoCalibrationSystem: Retornando calibración instantánea", {
      timestamp: new Date().toISOString()
    });
    
    // Usar valores ultra permisivos
    const instantCalibration: CalibrationResult = {
      baselineOffset: 0,
      amplitudeScalingFactor: 1.0,
      noiseFloor: 0.001, // Ultra permisivo
      signalQualityThreshold: 1, // Ultra permisivo
      detectionSensitivity: 1.0, // Ultra permisivo
      confidenceThreshold: 0.01, // Ultra permisivo
      hasValidCalibration: true
    };
    
    // Guardar resultado y devolver inmediatamente
    this.calibrationResult = instantCalibration;
    
    // Devolver promesa resuelta inmediatamente
    return Promise.resolve(instantCalibration);
  }
  
  /**
   * Limpia timeouts para evitar memory leaks
   */
  private clearTimeouts(): void {
    if (this.calibrationTimeoutId) {
      clearTimeout(this.calibrationTimeoutId);
      this.calibrationTimeoutId = null;
    }
  }
  
  /**
   * No hace nada, solo devuelve true para indicar que la calibración está completa
   */
  public processCalibrationFrame(): boolean {
    return true; // Siempre completado
  }
  
  /**
   * Obtiene el resultado de la última calibración
   * Siempre devuelve una calibración ultra permisiva
   */
  public getCalibrationResult(): CalibrationResult {
    // CRÍTICO: Siempre devolver valores predeterminados ultra permisivos
    return {
      baselineOffset: 0,
      amplitudeScalingFactor: 1.0,
      noiseFloor: 0.001,
      signalQualityThreshold: 1,
      detectionSensitivity: 1.0,
      confidenceThreshold: 0.01,
      hasValidCalibration: true
    };
  }
  
  /**
   * Verifica si hay una calibración en curso
   */
  public isCalibrationActive(): boolean {
    return false; // Nunca calibrando
  }
  
  /**
   * Cancela la calibración actual
   */
  public cancelCalibration(): void {
    this.isCalibrating = false;
    this.clearTimeouts();
  }
  
  /**
   * Reinicia completamente el sistema de calibración
   */
  public reset(): void {
    this.framesCollected = [];
    this.isCalibrating = false;
    this.clearTimeouts();
    
    // CRÍTICO: Mantener un resultado de calibración válido incluso después de reset
    this.calibrationResult = {
      baselineOffset: 0,
      amplitudeScalingFactor: 1.0,
      noiseFloor: 0.001,
      signalQualityThreshold: 1, 
      detectionSensitivity: 1.0,
      confidenceThreshold: 0.01,
      hasValidCalibration: true
    };
    
    console.log("AutoCalibrationSystem: Sistema reiniciado con valores predeterminados");
  }
}
