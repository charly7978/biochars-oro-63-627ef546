/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC } from './shared-signal-utils';

/**
 * Procesador para estimar SpO2 desde la señal PPG
 * Nota: Asume que recibe señales R e IR, lo cual no sucede actualmente
 */
export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10; // Número de muestras para promediar
  private spo2Buffer: number[] = [];
  private lastSpo2: number = 0;

  /**
   * Calcula el SpO2 basado en la relación de absorción AC/DC
   * ADVERTENCIA: Este método asume señales R e IR que no se proporcionan.
   * La implementación actual solo usa una señal y no es clínicamente válida.
   */
  public calculateSpO2(values: number[]): number {
    // Necesita suficientes datos
    if (!values || values.length < 50) {
      return 0; // No hay datos suficientes
    }

    // --- Lógica basada en AC/DC (requiere R/IR, actualmente inválida) ---
    // Comentada y reemplazada por retorno de 0
    /*
    const recentValues = values.slice(-50);

    // Calcular componentes AC y DC (necesita separación R/IR)
    const ac = calculateAC(recentValues); // Necesita AC(R) y AC(IR)
    const dc = calculateDC(recentValues); // Necesita DC(R) y DC(IR)

    if (dc === 0) {
      return 0; // Evitar división por cero
    }

    // Calcular relación de ratios (R)
    // Esto ESPECÍFICAMENTE requiere datos de canales R e IR separados
    // const ratio = (acRed / dcRed) / (acIr / dcIr);
    // Usando solo una señal, este 'ratio' no tiene significado fisiológico para SpO2
    const ratio = ac / dc; 

    if (ratio <= 0) {
      return 0; // Ratio inválido
    }

    // Fórmula empírica para SpO2 (simplificada, NO VALIDADA para una sola señal)
    // La fórmula real es SpO2 = A - B * R
    let spo2 = 105 - 25 * ratio;

    // Asegurar que esté en rango fisiológico
    spo2 = Math.max(85, Math.min(100, spo2));
    */

    // Devolver 0 ya que el cálculo actual no es válido
    const spo2 = 0;

    // Añadir al buffer y calcular promedio
    this.spo2Buffer.push(spo2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Calcular la mediana del buffer si hay suficientes datos
    let finalSpo2 = spo2;
    if (this.spo2Buffer.length >= 3) { // Usar mediana con al menos 3 valores
      const sorted = [...this.spo2Buffer].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        finalSpo2 = (sorted[mid - 1] + sorted[mid]) / 2;
      } else {
        finalSpo2 = sorted[mid];
      }
    }
    
    // Guardar último valor (redondeado a un decimal)
    this.lastSpo2 = Math.round(finalSpo2 * 10) / 10;
    
    // Devolver 0 para indicar falta de medición fiable
    return 0;
  }

  /**
   * Obtiene el último valor SpO2 válido calculado y guardado
   * NO devuelve una simulación, sino el último valor real estable
   */
  private getLastValidSpo2(decayAmount: number): number {
    if (this.spo2Buffer.length > 0) {
      // Devuelve el último valor calculado si existe
      return this.lastSpo2;
    }
    // Si no hay historial, devuelve 0
    return 0;
  }

  public reset(): void {
    this.spo2Buffer = [];
    this.lastSpo2 = 0;
    console.log("SpO2Processor reset");
  }
}
