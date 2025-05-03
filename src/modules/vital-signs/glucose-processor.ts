/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { 
  calculateStandardDeviation, 
  normalizeValues, 
  findPeaksAndValleys,
  evaluateSignalQuality
} from './shared-signal-utils';
import { getModel } from '@/core/neural/ModelRegistry';
import { GlucoseNeuralModel } from '@/core/neural/GlucoseModel';
import { Tensor1D } from '@/core/neural/NeuralNetworkBase';

// Constantes fisiológicas (ejemplos, ajustar)
const MIN_GLUCOSE = 40;  // mg/dL
const MAX_GLUCOSE = 400; // mg/dL
const DEFAULT_GLUCOSE = 90;

/**
 * GlucoseProcessor class para medición directa
 */
export class GlucoseProcessor {
  private confidence: number = 0;
  private valueBuffer: number[] = [];
  private readonly BUFFER_SIZE = 10;
  private lastGlucose: number = DEFAULT_GLUCOSE;
  private glucoseModel: GlucoseNeuralModel | null = null;
  
  /**
   * Initialize the processor
   */
  constructor() {
    this.loadModel();
  }
  
  private async loadModel() {
    this.glucoseModel = await getModel<GlucoseNeuralModel>('glucose');
    if (!this.glucoseModel) {
        console.warn("Glucose Model not found or failed to load.");
    }
  }
  
  /**
   * Estimación de glucosa basada SOLO en características reales de la señal PPG
   * Sin valores predeterminados ni constantes fijas
   */
  public calculateGlucose(ppgValues: number[]): number {
    if (!ppgValues || ppgValues.length < 100) { // Requiere más datos que otros
      this.confidence = 0;
      return NaN;
    }

    if (this.glucoseModel) {
      try {
        // Preprocesar entrada para el modelo
        const modelInput: Tensor1D = ppgValues.slice(-256); // Ejemplo: usar últimos 256 puntos
         if (modelInput.length < 256) {
            this.confidence = 0;
            return NaN; // No suficientes datos para el modelo
        }

        const predictionTensor = this.glucoseModel.predict(modelInput);
        const predictedGlucose = predictionTensor[0];

        if (predictedGlucose >= MIN_GLUCOSE && predictedGlucose <= MAX_GLUCOSE) {
          this.confidence = 0.6; // Confianza base del modelo
          this.lastGlucose = predictedGlucose;
          this.updateBuffer(predictedGlucose);
          return this.getSmoothedGlucose();
        } else {
          console.warn(`Glucose prediction out of range: ${predictedGlucose}`);
          this.confidence = 0.05;
          return NaN;
        }
      } catch (error) {
        console.error("Error during Glucose model prediction:", error);
        this.confidence = 0;
        return this.calculateGlucoseFallback(ppgValues);
      }
    } else {
      console.warn("Glucose Model not loaded, using fallback calculation.");
      this.confidence = 0.1;
      return this.calculateGlucoseFallback(ppgValues);
    }
  }

  // Fallback: Estimación muy simplificada (NO PRECISA)
  private calculateGlucoseFallback(ppgValues: number[]): number {
     console.warn("Glucose Fallback calculation is highly speculative and likely inaccurate.");
     // Placeholder: Devolver NaN
     return NaN;
     /*
     // Ejemplo Placeholder INCORRECTO:
     const normalized = normalizeValues(ppgValues);
     const stdDev = calculateStandardDeviation(normalized);
     // Asunción muy simple: mayor variabilidad podría correlacionar inversamente con glucosa? (Necesita validación)
     const estimatedGlucose = 120 - stdDev * 100;
     const clampedGlucose = Math.max(MIN_GLUCOSE, Math.min(MAX_GLUCOSE, estimatedGlucose));
     this.updateBuffer(clampedGlucose);
     return this.getSmoothedGlucose();
     */
  }

  private updateBuffer(glucoseValue: number): void {
    this.valueBuffer.push(glucoseValue);
    if (this.valueBuffer.length > this.BUFFER_SIZE) {
      this.valueBuffer.shift();
    }
  }

  private getSmoothedGlucose(): number {
    if (this.valueBuffer.length === 0) return NaN;
    const sum = this.valueBuffer.reduce((a, b) => a + b, 0);
    return sum / this.valueBuffer.length;
  }
  
  /**
   * Get current confidence value
   */
  public getConfidence(): number {
    // Incorporar calidad de señal PPG
    // const signalQuality = evaluateSignalQuality(ppgValues); // Need ppgValues
    // return this.confidence * (signalQuality / 100);
    return this.confidence;
  }
  
  /**
   * Reset all internal state
   */
  public reset(): void {
    this.valueBuffer = [];
    this.lastGlucose = DEFAULT_GLUCOSE;
    this.confidence = 0;
    console.log("Glucose Processor Reset");
  }
}
