import * as tf from '@tensorflow/tfjs';
import {
  BaseNeuralModel,
  Tensor1D,
} from './NeuralNetworkBase';

// Configuración específica del modelo Arrhythmia
const ARRHYTHMIA_MODEL_CONFIG = {
  name: 'ArrhythmiaClassifier',
  version: '1.0.0-tfjs',
  // La forma de entrada depende de cómo se preprocesan los intervalos RR
  // Ejemplo: ventana de 10 intervalos + RMSSD, SDNN, etc. (e.g., [13])
  expectedInputShape: [13], // Ajustar según el modelo real
  modelUrl: '/models/arrhythmia/model.json' // Ruta al modelo TFJS
};

/**
 * Modelo neuronal para detectar arritmias a partir de intervalos RR y características HRV
 * usando TensorFlow.js.
 */
export class ArrhythmiaNeuralModel extends BaseNeuralModel {

  constructor() {
    super(
      ARRHYTHMIA_MODEL_CONFIG.name,
      ARRHYTHMIA_MODEL_CONFIG.expectedInputShape,
      ARRHYTHMIA_MODEL_CONFIG.version
    );
    this.preloadModel().catch(err => {
      console.error("Initial Arrhythmia model load failed:", err);
    });
  }

  /**
   * Predice la probabilidad de arritmia a partir de características HRV.
   * @param hrvFeatures Array numérico con características como RMSSD, SDNN, intervalos RR.
   * @returns Un array con la probabilidad de arritmia (o null si falla).
   */
  public predict(hrvFeatures: Tensor1D): Tensor1D | null {
     if (!this.isLoaded()) {
      console.warn("Arrhythmia model not loaded yet.");
      return null;
    }
    
    if (hrvFeatures.length !== this.inputShape[0]) {
        console.error(`Arrhythmia model expected input length ${this.inputShape[0]} but received ${hrvFeatures.length}`);
        return null;
    }

    // Llama al método predict de la clase base
    const result = super.predict(hrvFeatures);
    
    if (result) {
        // Asume que el modelo devuelve una probabilidad (0 a 1)
        return result;
    } else {
        return null;
    }
  }

  /**
   * Procesa una secuencia de intervalos RR y extrae características para el modelo.
   * @param rrIntervals Array de intervalos RR en ms.
   * @returns Un objeto con la predicción o un objeto indicando fallo.
   */
  public async processSignal(rrIntervals: number[]): Promise<{ 
    isArrhythmia: boolean; 
    confidence: number; 
    category?: string; 
    error?: string 
  }> {
    if (rrIntervals.length < 10) { // Necesita suficientes intervalos
      return { isArrhythmia: false, confidence: 0, error: 'Insufficient RR intervals' };
    }

    // Asegurarse de que el modelo esté listo
    if (!this.isLoaded()) {
        await this.preloadModel(); // Esperar a que cargue si aún no lo ha hecho
        if (!this.isLoaded()) {
            return { isArrhythmia: false, confidence: 0, error: 'Model failed to load' };
        }
    }

    // 1. Extraer características HRV (Ejemplo)
    const rmssd = this.calculateRMSSD(rrIntervals);
    const sdnn = this.calculateSDNN(rrIntervals);
    const meanRR = rrIntervals.reduce((a,b)=>a+b,0) / rrIntervals.length;
    // Usar los últimos N intervalos como características directas
    const lastNIntervals = rrIntervals.slice(-10);
    // Asegurar que tenga 10 elementos, rellenando si es necesario
    while(lastNIntervals.length < 10) lastNIntervals.unshift(meanRR); 
    
    // Normalizar intervalos (ejemplo, dividir por 1000 para segundos)
    const normalizedIntervals = lastNIntervals.map(i => i / 1000.0); 
    
    // Combinar características en el orden esperado por el modelo
    // ¡ESTO ES SOLO UN EJEMPLO! El orden y las características exactas
    // dependerán del modelo entrenado.
    const features: Tensor1D = [
        rmssd / 100, // Normalizar 
        sdnn / 100,  // Normalizar
        meanRR / 1000, // Normalizar
        ...normalizedIntervals
    ];

    // 2. Realizar predicción
    const predictionResult = this.predict(features);

    if (!predictionResult) {
      return { isArrhythmia: false, confidence: 0, error: 'Model prediction failed' };
    }

    // 3. Interpretar resultado
    const probability = predictionResult[0]; // Asume que el modelo devuelve probabilidad
    const confidence = Math.abs(probability - 0.5) * 2; // Confianza basada en qué tan lejos está de 0.5
    const isArrhythmia = probability > 0.6; // Umbral de ejemplo
    let category = 'Normal';
    if (isArrhythmia) {
        // Aquí podría haber lógica para clasificar el tipo de arritmia si el modelo lo soporta
        category = 'Arrhythmia Detected'; 
    }

    return { isArrhythmia, confidence, category };
  }

  // --- Métodos de Cálculo HRV (Ejemplos) --- 
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    let sumSqDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      sumSqDiff += Math.pow(intervals[i] - intervals[i - 1], 2);
    }
    return Math.sqrt(sumSqDiff / (intervals.length - 1));
  }

  private calculateSDNN(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
    return Math.sqrt(variance);
  }
  
  // El getter parameterCount y architecture ahora provienen de BaseNeuralModel.
  
  public async preloadModel(): Promise<boolean> {
      if (!this.isLoaded()) { 
          await this.loadModel(ARRHYTHMIA_MODEL_CONFIG.modelUrl);
      }
      return this.isLoaded();
  }
}
