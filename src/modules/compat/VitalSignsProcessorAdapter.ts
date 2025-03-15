
/**
 * NOTA IMPORTANTE: Este es un adaptador de compatibilidad para el procesador de signos vitales.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

import { VitalSignsProcessor as CoreVitalSignsProcessor } from '../core/VitalSignsProcessor';
import type { VitalSignsResult } from '../core/VitalSignsProcessor';
import type { RRData } from '../core/ArrhythmiaProcessor';
import { AdvancedSignalProcessor } from '../advanced/AdvancedSignalProcessor';

/**
 * Wrapper de compatibilidad que mantiene la interfaz original 
 * mientras usa la implementación refactorizada y ahora incorpora
 * algoritmos avanzados de procesamiento de señal.
 * 
 * Este archivo es crucial para mantener la compatibilidad con el código existente
 * mientras mejoramos la estructura interna.
 */
export class VitalSignsProcessor {
  private processor: CoreVitalSignsProcessor;
  private advancedProcessor: AdvancedSignalProcessor;
  private useAdvancedProcessing: boolean = true;
  
  /**
   * Constructor que inicializa el procesador interno refactorizado
   * y el nuevo procesador con algoritmos avanzados
   */
  constructor() {
    this.processor = new CoreVitalSignsProcessor();
    this.advancedProcessor = new AdvancedSignalProcessor();
    
    // Verificar si el dispositivo puede manejar procesamiento avanzado
    this.checkDeviceCapabilities();
  }
  
  /**
   * Verifica las capacidades del dispositivo y decide si usar 
   * algoritmos avanzados o estándar
   */
  private checkDeviceCapabilities(): void {
    try {
      // Verificar disponibilidad de hardware acceleration
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        console.log('WebGL no disponible, usando procesador estándar');
        this.useAdvancedProcessing = false;
        return;
      }
      
      // Verificar capacidad de procesamiento
      const concurrency = navigator.hardwareConcurrency || 2;
      if (concurrency < 4) {
        console.log('Procesador con pocos núcleos, adaptando algoritmos');
        this.advancedProcessor.setLowPowerMode(true);
      }
      
      console.log(`Usando procesador avanzado con ${concurrency} núcleos disponibles`);
    } catch (error) {
      console.error('Error al verificar capacidades, usando procesador estándar:', error);
      this.useAdvancedProcessing = false;
    }
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   * Mantiene exactamente la misma firma de método para compatibilidad
   */
  public processSignal(
    ppgValue: number,
    rrData?: RRData
  ): VitalSignsResult {
    // Si estamos usando procesamiento avanzado, enviamos la señal a ambos procesadores
    // pero devolvemos los resultados del avanzado
    if (this.useAdvancedProcessing) {
      // Procesar con algoritmos avanzados
      const advancedResult = this.advancedProcessor.processSignal(ppgValue, rrData);
      
      // También procesar con el algoritmo estándar para mantener la consistencia interna
      this.processor.processSignal(ppgValue, rrData);
      
      return advancedResult;
    }
    
    // Si no usamos procesamiento avanzado, solo usamos el procesador estándar
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): VitalSignsResult | null {
    this.advancedProcessor.reset();
    return this.processor.reset();
  }
  
  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  public fullReset(): void {
    this.advancedProcessor.fullReset();
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
    this.advancedProcessor.startCalibration();
    this.processor.startCalibration();
  }
  
  /**
   * Fuerza la finalización del proceso de calibración
   */
  public forceCalibrationCompletion(): void {
    this.advancedProcessor.forceCalibrationCompletion();
    this.processor.forceCalibrationCompletion();
  }
  
  /**
   * Habilita o deshabilita el procesamiento avanzado
   */
  public setAdvancedProcessing(enabled: boolean): void {
    this.useAdvancedProcessing = enabled;
    console.log(`Procesamiento avanzado ${enabled ? 'activado' : 'desactivado'}`);
  }
}

// Re-exportamos los tipos para compatibilidad
export type { VitalSignsResult } from '../core/VitalSignsProcessor';
export type { RRData } from '../core/ArrhythmiaProcessor';
