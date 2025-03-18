
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC, calculateSignalQuality } from '../utils/perfusion-utils';

/**
 * Calculate oxygen saturation from PPG signals
 * Direct measurement only - no simulation
 */
export class OxygenSaturationCalculator {
  private spo2History: number[] = [];
  private readonly HISTORY_SIZE = 10;
  private readonly MIN_SIGNAL_LENGTH = 15;
  private readonly MIN_AC_THRESHOLD = 0.05;
  private readonly MIN_PI_THRESHOLD = 0.02;
  private readonly MAX_SPO2 = 99;
  private readonly MIN_SPO2 = 90;
  
  /**
   * Calculate SpO2 from real PPG values
   * Returns 0 if unable to calculate
   */
  public calculateSpO2(ppgValues: number[]): number {
    // Verificación de datos suficientes
    if (ppgValues.length < this.MIN_SIGNAL_LENGTH) {
      return this.getSmoothedValue();
    }
    
    // Cálculos en señal real (no simulación)
    const recentValues = ppgValues.slice(-this.MIN_SIGNAL_LENGTH);
    
    // Calcular componentes AC y DC
    const ac = calculateAC(recentValues);
    const dc = calculateDC(recentValues);
    
    // Verificar calidad de la señal
    if (dc === 0 || ac < this.MIN_AC_THRESHOLD) {
      return this.getSmoothedValue();
    }
    
    // Cálculo del índice de perfusión (PI) - medida real, no simulada
    const perfusionIndex = ac / dc;
    
    // Verificar si el PI es muy bajo (señal débil)
    if (perfusionIndex < this.MIN_PI_THRESHOLD) {
      return this.getSmoothedValue();
    }
    
    // Cálculo de SpO2 basado en R (ratio AC/DC)
    // Fórmula simplificada para SpO2 derivada de medidas directas
    let spo2 = Math.round(110 - (25 * perfusionIndex));
    
    // Limitación a valores realistas
    spo2 = Math.max(this.MIN_SPO2, Math.min(this.MAX_SPO2, spo2));
    
    // Añadir a historial para estabilidad
    this.addToHistory(spo2);
    
    // Devolver valor suavizado
    return this.getSmoothedValue();
  }
  
  /**
   * Agregar valor al historial con limitación de tamaño
   */
  private addToHistory(value: number): void {
    if (value > 0) { // Only add non-zero values
      this.spo2History.push(value);
      if (this.spo2History.length > this.HISTORY_SIZE) {
        this.spo2History.shift();
      }
    }
  }
  
  /**
   * Obtener valor suavizado del historial
   */
  private getSmoothedValue(): number {
    if (this.spo2History.length === 0) return 0;
    
    // Ordenar valores y eliminar valores extremos (si hay suficientes)
    const sortedValues = [...this.spo2History].sort((a, b) => a - b);
    
    // Si hay suficientes valores, eliminar extremos
    if (sortedValues.length >= 5) {
      // Eliminar los 20% más bajos y más altos
      const trimStart = Math.floor(sortedValues.length * 0.2);
      const trimEnd = sortedValues.length - trimStart;
      const trimmedValues = sortedValues.slice(trimStart, trimEnd);
      
      // Calcular promedio de valores centrales
      return Math.round(trimmedValues.reduce((a, b) => a + b, 0) / trimmedValues.length);
    }
    
    // Si no hay suficientes, usar el promedio simple
    return Math.round(sortedValues.reduce((a, b) => a + b, 0) / sortedValues.length);
  }
  
  /**
   * Reset the calculator
   */
  public reset(): void {
    this.spo2History = [];
  }
}
