/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { 
  calculateStandardDeviation, 
  normalizeValues, 
  findPeaksAndValleys,
  evaluateSignalQuality,
  calculateDC
} from './shared-signal-utils';

// Constantes fisiológicas
const MIN_GLUCOSE = 40;  // mg/dL
const MAX_GLUCOSE = 400; // mg/dL
const DEFAULT_GLUCOSE = NaN; // Default to NaN

/**
 * Procesador para ESTIMAR Glucosa desde señal PPG.
 * ADVERTENCIA: La estimación de Glucosa desde PPG es ALTAMENTE EXPERIMENTAL
 * y NO está validada clínicamente. Los resultados son especulativos.
 * NO USAR PARA FINES MÉDICOS.
 */
export class GlucoseProcessor {
  private confidence: number = 0;
  private valueBuffer: number[] = [];
  private readonly BUFFER_SIZE = 10;
  private lastGlucose: number = NaN; // Iniciar como NaN
  // No glucoseModel needed

  constructor() {
    this.reset();
  }
  
  /**
   * Estima Glucosa basada SOLO en características PPG.
   * @param ppgValues Array de valores de señal PPG (filtrada).
   * @returns Estimación de Glucosa (NaN si no es calculable).
   */
  public calculateGlucose(ppgValues: number[]): number {
    // Requiere una cantidad significativa de datos de buena calidad
    const signalQuality = evaluateSignalQuality(ppgValues);
    if (!ppgValues || ppgValues.length < 100 || signalQuality < 30) { // Requerir calidad mínima
      this.confidence = 0;
      return NaN;
    }

    // --- Lógica Placeholder Experimental --- 
    const normalized = normalizeValues(ppgValues);
    if (normalized.every(v => v === 0)) return NaN;
    
    const stdDev = calculateStandardDeviation(normalized);
    const { peakIndices, valleyIndices } = findPeaksAndValleys(normalized);

    if (peakIndices.length < 3 || valleyIndices.length < 3) { 
      this.confidence = 0.05;
      return NaN;
    }

    // Calcular características adicionales (ejemplos)
    const avgPeak = peakIndices.map(i => normalized[i]).reduce((s,v)=>s+v,0) / peakIndices.length;
    const avgValley = valleyIndices.map(i => normalized[i]).reduce((s,v)=>s+v,0) / valleyIndices.length;
    const amplitude = avgPeak - avgValley;
    // Simple skewness estimate (placeholder)
    const mean = calculateDC(normalized);
    let skewness = 0;
    if (stdDev > 1e-6) {
        skewness = normalized.reduce((sum, v) => sum + Math.pow(v - mean, 3), 0) / (normalized.length * Math.pow(stdDev, 3));
    }

    // Fórmula de Estimación Placeholder (SIN BASE CIENTÍFICA SÓLIDA)
    // Intenta correlacionar características con un rango plausible de glucosa.
    let estimatedGlucose = 90 + (skewness * 20) - (amplitude * 50) + (stdDev * 30);

    // Validar y limitar
    const clampedGlucose = Math.max(MIN_GLUCOSE, Math.min(MAX_GLUCOSE, estimatedGlucose));

    if (isNaN(clampedGlucose)) {
        this.confidence = 0.05;
        return NaN;
    }
    
    // Confianza muy baja debido a la naturaleza especulativa
    this.confidence = Math.max(0.05, Math.min(0.3, (signalQuality / 100) * 0.3)); 

    this.updateBuffer(clampedGlucose);
    const smoothed = this.getSmoothedGlucose();

    return isNaN(smoothed) ? NaN : Math.round(smoothed);
  }

  private updateBuffer(glucoseValue: number): void {
    this.valueBuffer.push(glucoseValue);
    if (this.valueBuffer.length > this.BUFFER_SIZE) {
      this.valueBuffer.shift();
    }
  }

  private getSmoothedGlucose(): number {
    if (this.valueBuffer.length < 3) return NaN; 
    const sum = this.valueBuffer.reduce((a, b) => a + b, 0);
    return sum / this.valueBuffer.length; // No redondear hasta el final
  }
  
  public getConfidence(): number {
    return this.confidence;
  }
  
  public reset(): void {
    this.valueBuffer = [];
    this.lastGlucose = NaN; // Reset to NaN
    this.confidence = 0;
    console.log("Glucose Processor Reset");
  }
}
