
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Wrapper de compatibilidad que mantiene la interfaz original 
 * mientras usa la implementación refactorizada.
 * 
 * Este archivo es crucial para mantener la compatibilidad con el código existente
 * mientras mejoramos la estructura interna.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Exponemos las constantes originales para compatibilidad
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.05; // Aumentado de 1.02 a 1.05 para mejor calibración
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045; // Reducido de 0.05 a 0.045 para mayor sensibilidad
  private readonly SPO2_WINDOW = 8; // Reducido de 10 a 8 para respuesta más rápida
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 22; // Reducido de 25 a 22 para mejor detección de arritmias
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 2500; // Reducido de 3000 a 2500 ms
  private readonly PEAK_THRESHOLD = 0.28; // Reducido de 0.3 a 0.28 para mayor sensibilidad
  
  /**
   * Constructor que inicializa el procesador interno refactorizado
   */
  constructor() {
    this.processor = new CoreProcessor();
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   * Mantiene exactamente la misma firma de método para compatibilidad
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  /**
   * Reinicia el procesador
   */
  public reset() {
    return this.processor.reset();
  }
  
  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  public fullReset(): void {
    this.processor.fullReset();
  }
}

// Re-exportamos los tipos para compatibilidad
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
