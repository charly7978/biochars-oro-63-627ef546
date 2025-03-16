
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';
import { CalibrationResult } from './AutoCalibrationSystem';

/**
 * Procesador de señales vitales mejorado con calibración avanzada
 * Todas las mediciones provienen EXCLUSIVAMENTE de la señal PPG real
 * Sin ningún tipo de simulación o datos de referencia
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  private calibrationResult: CalibrationResult | null = null;
  
  /**
   * Constructor que inicializa el procesador sin simulaciones
   */
  constructor() {
    console.log("VitalSignsProcessor wrapper: Inicializando con medición directa pura");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Aplica parámetros de calibración al procesador
   */
  public applyCalibration(calibration: CalibrationResult) {
    console.log("VitalSignsProcessor: Aplicando calibración", calibration);
    this.calibrationResult = calibration;
    
    // Aquí se aplican los parámetros de calibración al procesador interno
    if (this.processor.applyCalibration) {
      this.processor.applyCalibration(calibration);
    }
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * Mantiene exactamente la misma firma de método para compatibilidad
   * Siempre realiza medición directa sin valores de referencia
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Si hay calibración disponible, aplicar transformación a la señal
    if (this.calibrationResult) {
      // Normalizar la señal según la calibración
      ppgValue = (ppgValue - this.calibrationResult.baselineOffset) * 
                 this.calibrationResult.amplitudeScalingFactor;
    }
    
    // Procesamiento directo sin ajustes o simulaciones
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  /**
   * Reset the processor
   * Ensures all measurements start from zero
   */
  public reset() {
    console.log("VitalSignsProcessor wrapper: Reset - todas las mediciones comenzarán desde cero");
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   * Removes any history and ensures fresh start
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor wrapper: Full reset - eliminando todo historial de datos");
    this.processor.fullReset();
    this.calibrationResult = null;
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
