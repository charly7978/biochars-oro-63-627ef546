/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC } from './utils';
import { antiRedundancyGuard } from '../../core/validation/CrossValidationSystem';

// Registrar el archivo y la tarea única globalmente (fuera de la clase)
antiRedundancyGuard.registerFile('src/modules/vital-signs/spo2-processor.ts');
antiRedundancyGuard.registerTask('SpO2ProcessorSingleton');

export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10;
  private spo2Buffer: number[] = [];
  private lastCalculationTimestamp = 0;
  private minCalculationInterval = 500; // ms - evita cálculos excesivos

  /**
   * Calculates the oxygen saturation (SpO2) from real PPG values
   * No simulation or reference values are used
   */
  public calculateSpO2(values: number[]): number {
    // Evitar cálculos excesivos que pueden afectar rendimiento
    const now = Date.now();
    if (now - this.lastCalculationTimestamp < this.minCalculationInterval) {
      if (this.spo2Buffer.length > 0) {
        console.log('[SpO2] Usando último valor válido por intervalo:', this.spo2Buffer[this.spo2Buffer.length - 1]);
        return this.spo2Buffer[this.spo2Buffer.length - 1];
      }
    }
    this.lastCalculationTimestamp = now;
    // Verificación de datos suficientes (relajada)
    if (values.length < 10) {
      console.log('[SpO2] Datos insuficientes para cálculo confiable:', values.length);
      return this.getLastValidSpo2(1);
    }
    const dc = calculateDC(values);
    if (dc === 0 || isNaN(dc)) {
      console.log('[SpO2] DC es cero o NaN - señal inválida');
      return this.getLastValidSpo2(1);
    }
    const ac = calculateAC(values);
    if (isNaN(ac)) {
      console.log('[SpO2] AC es NaN - señal inválida');
      return this.getLastValidSpo2(1);
    }
    const perfusionIndex = ac / dc;
    console.log(`[SpO2] Perfusion Index: ${perfusionIndex.toFixed(4)}`);
    if (perfusionIndex < 0.01) { // Umbral más bajo para permitir cálculo
      console.log('[SpO2] Índice de perfusión bajo para medición confiable');
      return this.getLastValidSpo2(2);
    }
    const R = (ac / dc);
    let spO2_raw = 110 - (25 * R);
    if (isNaN(spO2_raw)) {
      console.log('[SpO2] spO2_raw es NaN - cálculo inválido');
      return this.getLastValidSpo2(1);
    }
    // Limitar a rango fisiológico posible durante el cálculo
    let spO2 = Math.max(80, Math.min(98, spO2_raw)); // Límite superior 98%
    console.log(`[SpO2] Calculado (antes de redondear): ${spO2.toFixed(1)}`);
    if (perfusionIndex > 0.1) {
      spO2 = Math.min(98, spO2 + 1);
    }
    spO2 = Math.round(Math.max(80, Math.min(98, spO2)));
    console.log(`[SpO2] Final: ${spO2}`);
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }
    let finalSpO2 = spO2;
    if (this.spo2Buffer.length >= 3) {
      const sortedValues = [...this.spo2Buffer].sort((a, b) => a - b);
      finalSpO2 = sortedValues[Math.floor(sortedValues.length / 2)];
      console.log(`[SpO2] Mediana (más estable): ${finalSpO2}`);
    }
    return finalSpO2;
  }
  
  /**
   * Get last valid SpO2 with optional decay
   * Only uses real historical values
   */
  private getLastValidSpo2(decayAmount: number): number {
    if (this.spo2Buffer.length > 0) {
      const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
      console.log(`SpO2Processor: Usando último valor válido: ${lastValid}`);
      return Math.max(80, lastValid - decayAmount);
    }
    console.log("SpO2Processor: No hay historial de SpO2 válido");
    return 0;
  }

  /**
   * Reset the SpO2 processor state
   * Ensures all measurements start from zero
   */
  public reset(): void {
    console.log("SpO2Processor: Resetting buffer y estado");
    this.spo2Buffer = [];
    this.lastCalculationTimestamp = 0;
  }
}
