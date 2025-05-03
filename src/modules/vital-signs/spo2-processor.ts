/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { 
  applySMAFilter, 
  calculateStandardDeviation, 
  calculateAC, 
  calculateDC,
  evaluateSignalQuality
} from './shared-signal-utils';
import { getModel } from '@/core/neural/ModelRegistry';
import { SpO2NeuralModel } from '@/core/neural/SpO2Model';
import { Tensor1D } from '@/core/neural/NeuralNetworkBase';

// Constantes (ejemplo)
const MIN_SPO2 = 80;
const MAX_SPO2 = 100;
const DEFAULT_SPO2 = 95; // Valor por defecto si falla la predicción

/**
 * Procesador para estimar SpO2 desde la señal PPG
 * Nota: Asume que recibe señales R e IR, lo cual no sucede actualmente
 */
export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10; // Número de muestras para promediar
  private spo2Buffer: number[] = [];
  private lastSpo2: number = DEFAULT_SPO2;
  private confidence: number = 0; // Confianza del cálculo actual
  private spo2Model: SpO2NeuralModel | null = null;

  constructor() {
    this.loadModel();
  }

  private async loadModel() {
    this.spo2Model = await getModel<SpO2NeuralModel>('spo2');
    if (!this.spo2Model) {
      console.warn("SpO2 Model not found or failed to load.");
    }
  }

  public calculateSpO2(ppgValues: number[]): number {
    if (!ppgValues || ppgValues.length < 20) { // Necesita suficientes datos
        this.confidence = 0;
        return NaN; // No se puede calcular
    }

    // Intentar usar el modelo neuronal si está disponible
    if (this.spo2Model) {
        try {
            // Preprocesar entrada para el modelo (asegúrate que coincida con lo esperado)
            const modelInput: Tensor1D = ppgValues.slice(-128); // Ejemplo: usar últimos 128 puntos
            if (modelInput.length < 128) {
                this.confidence = 0;
                return NaN; // No suficientes datos para el modelo
            }
            
            const predictionTensor = this.spo2Model.predict(modelInput);
            const predictedSpo2 = predictionTensor[0]; // Asumiendo que el modelo devuelve un tensor con el valor SpO2

            // Validar y limitar el resultado del modelo
            if (predictedSpo2 >= MIN_SPO2 && predictedSpo2 <= MAX_SPO2) {
                 this.confidence = 0.7; // Confianza base del modelo (ajustar según sea necesario)
                 this.lastSpo2 = predictedSpo2;
                 this.updateBuffer(predictedSpo2);
                 return this.getSmoothedSpo2();
            } else {
                 console.warn(`SpO2 prediction out of range: ${predictedSpo2}`);
                 this.confidence = 0.1; // Baja confianza si el resultado está fuera de rango
                 // No actualizar lastSpo2 si está fuera de rango, usar el último válido o NaN
                 return NaN; 
            }
        } catch (error) {
            console.error("Error during SpO2 model prediction:", error);
            this.confidence = 0;
            // Fallback a cálculo basado en R si el modelo falla
            return this.calculateSpo2Fallback(ppgValues);
        }
    } else {
      // Fallback si el modelo no está cargado
      console.warn("SpO2 Model not loaded, using fallback calculation.");
      this.confidence = 0.2; // Menor confianza para el fallback
      return this.calculateSpo2Fallback(ppgValues);
    }
  }
  
  // Fallback: Cálculo clásico basado en la relación R (AC/DC)
  // Nota: Esto requiere señales separadas de Rojo e Infrarrojo, no solo una señal PPG combinada.
  // Esta implementación es un placeholder y NO funcionará correctamente con una sola señal PPG.
  private calculateSpo2Fallback(ppgValues: number[]): number {
      // Placeholder: Esta lógica es incorrecta sin señales R/IR separadas.
      // Devolver NaN para indicar que no se puede calcular de forma fiable.
      console.warn("SpO2 Fallback calculation requires Red and IR signals, returning NaN.");
      this.confidence = 0;
      return NaN;
      /*
      // Ejemplo (INCORRECTO CON UNA SOLA SEÑAL):
      const ac = calculateAC(ppgValues);
      const dc = calculateDC(ppgValues);
      if (dc === 0) return NaN;
      const ratio = ac / dc;
      // Formula de calibración simple (necesita calibración real)
      // Esta fórmula es solo un ejemplo y no es médicamente precisa.
      const estimatedSpo2 = 110 - 25 * ratio; 
      const clampedSpo2 = Math.max(MIN_SPO2, Math.min(MAX_SPO2, estimatedSpo2));
      this.updateBuffer(clampedSpo2);
      return this.getSmoothedSpo2();
      */
  }

  private updateBuffer(spo2Value: number): void {
      this.spo2Buffer.push(spo2Value);
      if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
          this.spo2Buffer.shift();
      }
  }

  private getSmoothedSpo2(): number {
      if (this.spo2Buffer.length === 0) return NaN;
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      return sum / this.spo2Buffer.length;
  }

  private getLastValidSpo2(decayAmount: number): number {
    // This function seems less relevant now model is primary
    // Kept for potential use but might be removed
    this.lastSpo2 = Math.max(MIN_SPO2, this.lastSpo2 - decayAmount);
    return this.lastSpo2;
  }

  public getConfidence(): number {
    // Considerar la calidad de la señal PPG también aquí
    // const signalQuality = evaluateSignalQuality(ppgValues); // Necesitaría ppgValues aquí
    // return this.confidence * (signalQuality / 100);
    return this.confidence; 
  }

  public reset(): void {
    this.spo2Buffer = [];
    this.lastSpo2 = DEFAULT_SPO2;
    this.confidence = 0;
    console.log("SpO2 Processor Reset");
  }
}
