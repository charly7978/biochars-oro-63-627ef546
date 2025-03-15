
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { VitalSignsProcessor as NewVitalSignsProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';
import { FingerDetector } from './finger-detection/FingerDetector';

/**
 * Wrapper de compatibilidad que mantiene la interfaz original 
 * mientras usa la implementación refactorizada e integra el detector de dedo.
 * 
 * Este archivo centraliza la detección de dedo en FingerDetector
 */
export class VitalSignsProcessor {
  private processor: NewVitalSignsProcessor;
  private fingerDetector: FingerDetector;
  private lastRgbValues: {red: number, green: number} = {red: 0, green: 0};
  
  /**
   * Constructor que inicializa el procesador interno refactorizado y el detector de dedo
   */
  constructor() {
    this.processor = new NewVitalSignsProcessor();
    this.fingerDetector = new FingerDetector();
    console.log("VitalSignsProcessor: Inicializado con detector de dedo anti-falsos-positivos");
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   * Utiliza FingerDetector como única fuente para detección de dedos
   * MEJORADO con verificación más estricta anti-falsos-positivos
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null },
    rgbValues?: {red: number, green: number}
  ) {
    // Almacenar valores RGB si están disponibles
    if (rgbValues) {
      this.lastRgbValues = rgbValues;
    }
    
    // Verificar calidad de señal con el detector de dedo centralizado y valores RGB
    const fingerDetectionResult = this.fingerDetector.processQuality(
      ppgValue, 
      this.lastRgbValues.red, 
      this.lastRgbValues.green
    );
    
    // Solo procesar señales cuando el dedo está realmente detectado
    if (fingerDetectionResult.isFingerDetected) {
      return this.processor.processSignal(ppgValue, rrData);
    }
    
    // Retornar valores por defecto si no hay dedo presente
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    };
  }
  
  /**
   * Reinicia el procesador
   */
  public reset() {
    this.fingerDetector.reset();
    this.lastRgbValues = {red: 0, green: 0};
    return this.processor.reset();
  }
  
  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  public fullReset(): void {
    this.fingerDetector.reset();
    this.lastRgbValues = {red: 0, green: 0};
    this.processor.fullReset();
    console.log("VitalSignsProcessor: Reset completo realizado");
  }
}

// Re-exportamos los tipos para compatibilidad
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
