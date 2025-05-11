/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { 
  calculateAC, 
  calculateDC,
  evaluateSignalQuality // Assuming this remains useful
} from './shared-signal-utils';

// Constantes
const MIN_SPO2 = 80;
const MAX_SPO2 = 100;
const DEFAULT_SPO2 = NaN; // Default to NaN as calculation is unreliable

/**
 * Procesador para ESTIMAR SpO2 desde señal PPG.
 * ADVERTENCIA: El cálculo fiable de SpO2 requiere señales Roja e Infrarroja.
 * Esta implementación utiliza solo una señal PPG y es una APROXIMACIÓN NO VALIDADA CLÍNICAMENTE,
 * basada en la relación AC/DC, que puede correlacionar pobremente con SpO2 real.
 * NO USAR PARA FINES MÉDICOS.
 */
export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10; 
  private spo2Buffer: number[] = [];
  private lastSpo2: number = NaN; // Iniciar como NaN
  private confidence: number = 0; 

  constructor() {
    this.reset();
  }

  /**
   * Estima SpO2 usando la relación AC/DC de la señal PPG única.
   * @param ppgValues Array de valores de señal PPG (filtrada).
   * @returns Estimación de SpO2 (NaN si no es calculable).
   */
  public calculateSpO2(ppgValues: number[]): number {
    // Necesita suficientes datos y variabilidad
    if (!ppgValues || ppgValues.length < 30) { 
      this.confidence = 0;
      return NaN; 
    }

    // Usar un segmento reciente para calcular AC/DC
    const segment = ppgValues.slice(-50); // Usar últimos 50 puntos
    const ac = calculateAC(segment);
    const dc = calculateDC(segment);

    if (dc === 0 || ac <= 0) { // DC no puede ser 0, AC debe ser positivo
      this.confidence = 0;
      return NaN;
    }

    // Calcular Ratio (R = AC/DC). Este R NO es el mismo que en pulsioximetría R/IR.
    const ratio = ac / dc;
    
    // Fórmula empírica de calibración (Placeholder - MUY SIMPLIFICADA y probablemente INCORRECTA)
    const A = 110; // Valor placeholder
    const B = 25;  // Valor placeholder
    let estimatedSpo2 = A - B * ratio; 

    // Validar y limitar el resultado estimado
    if (estimatedSpo2 >= MIN_SPO2 && estimatedSpo2 <= MAX_SPO2) {
        this.confidence = 0.35; // Confianza baja/moderada debido a la naturaleza del método
        this.lastSpo2 = estimatedSpo2;
        this.updateBuffer(estimatedSpo2);
        return this.getSmoothedSpo2();
    } else {
        // Si el cálculo da un valor fuera de rango, es probable que la señal o la fórmula sean inadecuadas.
        console.warn(`Estimación SpO2 (AC/DC) fuera de rango: ${estimatedSpo2.toFixed(1)}`);
        this.confidence = 0.1;
        // Devolver NaN si la estimación no es plausible
        return NaN;
    }
  }

  // Método privado para actualizar el buffer interno
  private updateBuffer(spo2Value: number): void {
      this.spo2Buffer.push(spo2Value);
      if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
          this.spo2Buffer.shift();
      }
  }

  // Método privado para obtener el valor suavizado del buffer
  private getSmoothedSpo2(): number {
      if (this.spo2Buffer.length < 3) return NaN; // Necesitar al menos 3 valores para suavizar
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      // Devolver valor redondeado
      return Math.round(sum / this.spo2Buffer.length);
  }

  public getConfidence(): number {
    // TODO: Incorporar métricas de calidad de señal si están disponibles
    // const signalQuality = evaluateSignalQuality(ppgValues); // Necesitaría ppgValues aquí
    // return this.confidence * (signalQuality / 100);
    return this.confidence; 
  }

  public reset(): void {
    this.spo2Buffer = [];
    this.lastSpo2 = NaN; // Iniciar como NaN
    this.confidence = 0;
    console.log("SpO2 Processor Reset");
  }
}
