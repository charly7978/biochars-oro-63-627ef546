
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { VitalSignsProcessor as CoreVitalSignsProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';
import { FingerDetector } from './finger-detection/FingerDetector';

/**
 * Wrapper de compatibilidad que mantiene la interfaz original 
 * mientras usa la implementación refactorizada e integra el detector de dedo.
 * 
 * Procesamiento 100% real
 */
export class VitalSignsProcessor {
  private processor: CoreVitalSignsProcessor;
  private fingerDetector: FingerDetector;
  private lastRgbValues: {red: number, green: number} = {red: 0, green: 0};
  private consecutiveEmptyFrames: number = 0;
  private consecutiveValidFrames: number = 0;
  private lastProcessedTime: number = 0;
  private processingEnabled: boolean = true;
  
  /**
   * Constructor que inicializa el procesador interno refactorizado y el detector de dedo
   */
  constructor() {
    this.processor = new CoreVitalSignsProcessor();
    this.fingerDetector = new FingerDetector();
    console.log("VitalSignsProcessor: Inicializado con detector de dedo");
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   * Procesamiento 100% real, sin simulaciones
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null },
    rgbValues?: {red: number, green: number}
  ): VitalSignsResult {
    // Limitar velocidad de procesamiento si es necesario
    const currentTime = Date.now();
    if (currentTime - this.lastProcessedTime < 33 && !this.processingEnabled) {
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        signalQuality: 0
      };
    }
    this.lastProcessedTime = currentTime;
    
    // Almacenar valores RGB si están disponibles
    if (rgbValues) {
      this.lastRgbValues = rgbValues;
    }
    
    // Verificar calidad con el detector de dedo
    const fingerDetectionResult = this.fingerDetector.processQuality(
      ppgValue, 
      this.lastRgbValues.red, 
      this.lastRgbValues.green
    );
    
    // Actualizar contadores de consistencia
    if (fingerDetectionResult.isFingerDetected) {
      this.consecutiveValidFrames += 1;
      this.consecutiveEmptyFrames = Math.max(0, this.consecutiveEmptyFrames - 1);
    } else {
      this.consecutiveEmptyFrames += 1;
      this.consecutiveValidFrames = Math.max(0, this.consecutiveValidFrames - 2);
    }
    
    // Solo procesar señales cuando hay dedo detectado
    if (fingerDetectionResult.isFingerDetected && 
        this.consecutiveValidFrames >= 5 && 
        fingerDetectionResult.quality >= this.fingerDetector.getConfig().MIN_QUALITY_FOR_DETECTION) {
      
      const vitalSignsResult = this.processor.processSignal(ppgValue, rrData);
      vitalSignsResult.signalQuality = fingerDetectionResult.quality;
      return vitalSignsResult;
    }
    
    // Retornar valores por defecto si no hay dedo presente
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      signalQuality: 0
    };
  }
  
  /**
   * Reinicia el procesador
   */
  public reset() {
    this.fingerDetector.reset();
    this.lastRgbValues = {red: 0, green: 0};
    this.consecutiveEmptyFrames = 0;
    this.consecutiveValidFrames = 0;
    return this.processor.reset();
  }
  
  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  public fullReset(): void {
    this.fingerDetector.reset();
    this.lastRgbValues = {red: 0, green: 0};
    this.consecutiveEmptyFrames = 0;
    this.consecutiveValidFrames = 0;
    this.processingEnabled = true;
    this.processor.fullReset();
    console.log("VitalSignsProcessor: Reset completo realizado");
  }
}

// Re-exportamos los tipos para compatibilidad
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
