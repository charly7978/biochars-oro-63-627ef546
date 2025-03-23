
/**
 * NOTA IMPORTANTE: Este es un adaptador de compatibilidad para el procesador de signos vitales.
 * Las interfaces principales deben mantenerse intactas para compatibilidad.
 */

import { AdvancedSignalProcessor } from '../advanced/AdvancedSignalProcessor';
import type { VitalSignsResult } from '../vital-signs/VitalSignsProcessor';
import type { RRData } from '../vital-signs/VitalSignsProcessor';

/**
 * Adaptador que mantiene la interfaz original mientras usa
 * la implementación avanzada.
 */
export class VitalSignsAdapter {
  private advancedProcessor: AdvancedSignalProcessor;
  
  /**
   * Constructor que inicializa el procesador avanzado
   */
  constructor() {
    this.advancedProcessor = new AdvancedSignalProcessor();
    
    // Verificar si el dispositivo puede manejar procesamiento avanzado
    this.checkDeviceCapabilities();
  }
  
  /**
   * Verifica las capacidades del dispositivo y configura
   * el procesador adecuadamente
   */
  private checkDeviceCapabilities(): void {
    try {
      // Verificar disponibilidad de hardware acceleration
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        console.log('WebGL no disponible, adaptando modo de rendimiento');
        this.advancedProcessor.setLowPowerMode(true);
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
      console.error('Error al verificar capacidades, ajustando modo:', error);
      this.advancedProcessor.setLowPowerMode(true);
    }
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: RRData
  ): VitalSignsResult {
    return this.advancedProcessor.processSignal(ppgValue, rrData);
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): VitalSignsResult | null {
    return this.advancedProcessor.reset();
  }
  
  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  public fullReset(): void {
    this.advancedProcessor.fullReset();
  }
  
  /**
   * Habilita o deshabilita el procesamiento de alto rendimiento
   */
  public setHighPerformanceMode(enabled: boolean): void {
    this.advancedProcessor.setLowPowerMode(!enabled);
    console.log(`Modo de alto rendimiento ${enabled ? 'activado' : 'desactivado'}`);
  }
}

// Re-exportamos los tipos para compatibilidad
export type { VitalSignsResult } from '../vital-signs/VitalSignsProcessor';
export type { RRData } from '../vital-signs/VitalSignsProcessor';
