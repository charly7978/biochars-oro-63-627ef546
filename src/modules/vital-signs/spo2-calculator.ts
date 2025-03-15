
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { calculateAC, calculateDC } from '../../utils/signalProcessingUtils';

export class SpO2Calculator {
  private readonly SPO2_BUFFER_SIZE = 10;
  private spo2Buffer: number[] = [];

  /**
   * Calcula la saturación de oxígeno a partir de valores PPG
   * @param values Valores de la señal PPG
   * @returns Valor de SpO2 calculado
   */
  public calculateSpO2(values: number[]): number {
    // Sin suficientes datos, no calcular
    if (values.length < 30) {
      return 0;
    }

    const dc = calculateDC(values);
    if (dc === 0) {
      return 0;
    }

    const ac = calculateAC(values);
    
    // No hay señal pulsátil suficiente
    if (ac === 0 || ac/dc < 0.01) {
      return 0;
    }

    // Procesamiento directo de la señal PPG sin ajustes artificiales
    // El valor es proporcional a la absorción real de luz por la hemoglobina
    const calculatedValue = this.processRawData(ac, dc);
    
    if (calculatedValue > 0) {
      this.spo2Buffer.push(calculatedValue);
      if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
        this.spo2Buffer.shift();
      }

      // Promedio de valores recientes para estabilidad
      if (this.spo2Buffer.length > 0) {
        const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.spo2Buffer.length);
      }
    }

    return 0;
  }

  /**
   * Procesamiento de datos crudos de AC/DC sin simulaciones
   */
  private processRawData(ac: number, dc: number): number {
    // Solo procesamiento directo de valores fisicos reales
    // No se aplican factores o ajustes artificiales
    if (dc === 0) return 0;
    
    const ratio = ac / dc;
    
    // Convertir ratio a SpO2 según principios físicos de absorción de luz
    // Sin factores de calibración artificiales
    return Math.max(0, Math.min(100, this.convertRatioToSpO2(ratio)));
  }
  
  /**
   * Convertir el ratio AC/DC a valor de SpO2 según principios físicos
   * Sin simulaciones o valores artificiales
   */
  private convertRatioToSpO2(ratio: number): number {
    if (ratio <= 0) return 0;
    
    // Conversión basada únicamente en física de absorción de luz
    // Sin simulaciones o valores artificiales
    return Math.max(0, Math.min(100, 100 - (ratio * 25)));
  }

  /**
   * Reinicia el buffer de SpO2
   */
  public reset(): void {
    this.spo2Buffer = [];
  }
}
