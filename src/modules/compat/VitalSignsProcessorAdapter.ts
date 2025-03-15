
/**
 * NOTA IMPORTANTE: Este es un adaptador de compatibilidad para el procesador de signos vitales.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

import { VitalSignsProcessor as CoreVitalSignsProcessor, VitalSignsResult } from '../core/VitalSignsProcessor';
import { RRData } from '../core/ArrhythmiaProcessor';

/**
 * Wrapper de compatibilidad que mantiene la interfaz original 
 * mientras usa la implementación refactorizada.
 * 
 * Este archivo es crucial para mantener la compatibilidad con el código existente
 * mientras mejoramos la estructura interna.
 */
export class VitalSignsProcessor {
  private processor: CoreVitalSignsProcessor;
  
  /**
   * Constructor que inicializa el procesador interno refactorizado
   */
  constructor() {
    this.processor = new CoreVitalSignsProcessor();
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   * Mantiene exactamente la misma firma de método para compatibilidad
   */
  public processSignal(
    ppgValue: number,
    rrData?: RRData
  ): VitalSignsResult {
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): VitalSignsResult | null {
    return this.processor.reset();
  }
  
  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  public fullReset(): void {
    this.processor.fullReset();
  }
  
  /**
   * Verifica si está en proceso de calibración
   */
  public isCurrentlyCalibrating(): boolean {
    return this.processor.isCurrentlyCalibrating();
  }

  /**
   * Obtiene el progreso actual de calibración
   */
  public getCalibrationProgress(): VitalSignsResult['calibration'] {
    return this.processor.getCalibrationProgress();
  }
  
  /**
   * Inicia el proceso de calibración
   */
  public startCalibration(): void {
    this.processor.startCalibration();
  }
  
  /**
   * Fuerza la finalización del proceso de calibración
   */
  public forceCalibrationCompletion(): void {
    this.processor.forceCalibrationCompletion();
  }
}

// Re-exportamos los tipos para compatibilidad
export type { VitalSignsResult } from '../core/VitalSignsProcessor';
export type { RRData } from '../core/ArrhythmiaProcessor';
