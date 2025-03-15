
import { VitalSignsProcessor as NewVitalSignsProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Wrapper de compatibilidad que mantiene la interfaz original 
 * mientras usa la implementación refactorizada.
 * 
 * Este archivo es crucial para mantener la compatibilidad con el código existente
 * mientras mejoramos la estructura interna.
 */
export class VitalSignsProcessor {
  private processor: NewVitalSignsProcessor;
  
  // Exponemos las constantes originales para compatibilidad
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.02;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly SPO2_WINDOW = 10;
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 25;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 3000;
  private readonly PEAK_THRESHOLD = 0.3;
  
  /**
   * Constructor que inicializa el procesador interno refactorizado
   */
  constructor() {
    this.processor = new NewVitalSignsProcessor();
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   * Mantiene exactamente la misma firma de método para compatibilidad
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ) {
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
