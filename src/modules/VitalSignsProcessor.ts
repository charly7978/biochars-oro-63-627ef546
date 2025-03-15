
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
 * Este archivo centraliza la detección de dedo en FingerDetector
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
    console.log("VitalSignsProcessor: Inicializado con detector de dedo TRIPLE VERIFICACIÓN anti-falsos-positivos");
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   * Utiliza FingerDetector con TRIPLE VERIFICACIÓN como única fuente para detección de dedos
   * COMPLETAMENTE REDISEÑADO para eliminar TODOS los falsos positivos
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null },
    rgbValues?: {red: number, green: number}
  ): VitalSignsResult {
    // Limitar velocidad de procesamiento si es necesario
    const currentTime = Date.now();
    if (currentTime - this.lastProcessedTime < 33 && !this.processingEnabled) { // ~30fps
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        signalQuality: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
    this.lastProcessedTime = currentTime;
    
    // Almacenar valores RGB si están disponibles
    if (rgbValues) {
      this.lastRgbValues = rgbValues;
    }
    
    // TRIPLE VERIFICACIÓN de calidad con el detector de dedo centralizado y valores RGB
    const fingerDetectionResult = this.fingerDetector.processQuality(
      ppgValue, 
      this.lastRgbValues.red, 
      this.lastRgbValues.green
    );
    
    // Log más detallado periódicamente
    if (Math.random() < 0.01) {
      console.log("VitalSignsProcessor: Estado de procesamiento (TRIPLE VERIFICACIÓN)", {
        ppgValue,
        calidadDetectada: fingerDetectionResult.quality,
        dedoDetectado: fingerDetectionResult.isFingerDetected,
        nivelCalidad: fingerDetectionResult.qualityLevel,
        valorRojo: this.lastRgbValues.red,
        valorVerde: this.lastRgbValues.green,
        ratioRG: this.lastRgbValues.red / Math.max(1, this.lastRgbValues.green),
        framesValidosConsecutivos: this.consecutiveValidFrames,
        framesVacíosConsecutivos: this.consecutiveEmptyFrames
      });
    }
    
    // Actualizar contadores de consistencia
    if (fingerDetectionResult.isFingerDetected) {
      this.consecutiveValidFrames += 1;
      this.consecutiveEmptyFrames = Math.max(0, this.consecutiveEmptyFrames - 1);
    } else {
      this.consecutiveEmptyFrames += 1;
      this.consecutiveValidFrames = Math.max(0, this.consecutiveValidFrames - 2); // Más agresivo
    }
    
    // Solo procesar señales cuando:
    // 1. El dedo está realmente detectado con TRIPLE VERIFICACIÓN
    // 2. Hemos tenido suficientes frames válidos consecutivos 
    // 3. La calidad es suficiente
    if (fingerDetectionResult.isFingerDetected && 
        this.consecutiveValidFrames >= 5 && 
        fingerDetectionResult.quality >= this.fingerDetector.getConfig().MIN_QUALITY_FOR_DETECTION) {
      
      const vitalSignsResult = this.processor.processSignal(ppgValue, rrData);
      vitalSignsResult.signalQuality = fingerDetectionResult.quality;
      return vitalSignsResult;
    }
    
    // Retornar valores por defecto si no hay dedo presente o no cumple criterios
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      signalQuality: 0,
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
