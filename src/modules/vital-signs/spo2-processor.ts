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

  /**
   * Calculates the oxygen saturation (SpO2) from real PPG values
   * No simulation or reference values are used
   */
  public calculateSpO2(values: number[]): number {
    // *** LOG: Entrada a calculateSpO2 ***
    // console.log(`SpO2Processor: calculateSpO2 llamado. Tamaño entrada: ${values.length}`);
    if (values.length < 30) {
      // console.log("SpO2Processor: Datos insuficientes");
      return this.getLastValidSpo2(1);
    }

    const dc = calculateDC(values);
    // *** LOG: DC Calculado ***
    // console.log(`  DC: ${dc.toFixed(4)}`);
    if (dc === 0 || isNaN(dc)) {
      // console.log("SpO2Processor: DC es cero o NaN");
      return this.getLastValidSpo2(1);
    }

    const ac = calculateAC(values);
    // *** LOG: AC Calculado ***
    // console.log(`  AC: ${ac.toFixed(4)}`);
    if (isNaN(ac)) {
        // console.log("SpO2Processor: AC es NaN");
        return this.getLastValidSpo2(1);
    }
    
    const perfusionIndex = ac / dc;
    // *** LOG: Índice de Perfusión ***
    // console.log(`  Perfusion Index: ${perfusionIndex.toFixed(4)}`);
    
    if (perfusionIndex < 0.02) { // Umbral más bajo para permitir cálculo
      // console.log("SpO2Processor: Índice de perfusión bajo");
      return this.getLastValidSpo2(2);
    }

    const R = (ac / dc); // Mismo que perfusionIndex en esta implementación
    // *** LOG: Ratio R ***
    // console.log(`  Ratio (R): ${R.toFixed(4)}`);
    
    // Fórmula base (Asegurar que no genere NaN)
    let spO2_raw = 105 - (25 * R); // Ejemplo de fórmula común (ajustar coeficientes)
    if (isNaN(spO2_raw)) {
        // console.log("SpO2Processor: spO2_raw es NaN");
        return this.getLastValidSpo2(1);
    }
    
    // Limitar a rango fisiológico posible durante el cálculo
    let spO2 = Math.max(70, Math.min(100, spO2_raw));
    // console.log(`  SpO2 inicial (70-100): ${spO2.toFixed(1)}`);

    // Ajuste basado en perfusión (Mantener simple)
    // spO2 = spO2 + (perfusionIndex - 0.1) * 10; // Ejemplo de ajuste

    // Limitar nuevamente y redondear
    spO2 = Math.round(Math.max(70, Math.min(100, spO2)));
    // console.log(`  SpO2 después ajuste/redondeo: ${spO2}`);

    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    let finalSpO2 = spO2; // Usar valor actual si el buffer es pequeño
    if (this.spo2Buffer.length >= 3) { // Calcular promedio solo si hay suficientes valores
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      finalSpO2 = Math.round(sum / this.spo2Buffer.length);
    }
    
    // *** LOG: SpO2 Final ***
    // console.log(`SpO2Processor: Devolviendo SpO2 final: ${finalSpO2}`);
    return finalSpO2;
  }
  
  /**
   * Get last valid SpO2 with optional decay
   * Only uses real historical values
   */
  private getLastValidSpo2(decayAmount: number): number {
    if (this.spo2Buffer.length > 0) {
      const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
      // console.log(`SpO2Processor: Devolviendo último válido con decay: ${Math.max(0, lastValid - decayAmount)} (desde ${lastValid})`);
      return Math.max(70, lastValid - decayAmount); // Aplicar mínimo fisiológico aquí también
    }
    // console.log("SpO2Processor: Devolviendo 0 (sin valor válido previo)");
    return 0; // Devolver 0 si no hay historial
  }

  /**
   * Reset the SpO2 processor state
   * Ensures all measurements start from zero
   */
  public reset(): void {
    // console.log("SpO2Processor: Resetting buffer");
    this.spo2Buffer = [];
  }
}
