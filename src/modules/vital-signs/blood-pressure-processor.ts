import { 
  calculateStandardDeviation, 
  normalizeValues, 
  findPeaksAndValleys,
  evaluateSignalQuality
} from './shared-signal-utils';
import { getModel } from '@/core/neural/ModelRegistry';
import { BloodPressureNeuralModel } from '@/core/neural/BloodPressureModel';
import { Tensor1D } from '@/core/neural/NeuralNetworkBase';

// Constantes fisiológicas (ejemplos, ajustar con datos reales)
const MIN_SYSTOLIC = 80;
const MAX_SYSTOLIC = 200;
const MIN_DIASTOLIC = 50;
const MAX_DIASTOLIC = 120;
const DEFAULT_SYSTOLIC = 115;
const DEFAULT_DIASTOLIC = 75;

export class BloodPressureProcessor {
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private readonly BUFFER_SIZE = 10;
  private lastSystolic: number = DEFAULT_SYSTOLIC;
  private lastDiastolic: number = DEFAULT_DIASTOLIC;
  private confidence: number = 0;
  private bpModel: BloodPressureNeuralModel | null = null;

  constructor() {
    this.loadModel();
  }

  private async loadModel() {
    this.bpModel = await getModel<BloodPressureNeuralModel>('bloodPressure');
     if (!this.bpModel) {
      console.warn("Blood Pressure Model not found or failed to load.");
    }
  }

  public calculateBloodPressure(ppgValues: number[]): { systolic: number | typeof NaN; diastolic: number | typeof NaN } {
    if (!ppgValues || ppgValues.length < 50) { // Necesita suficientes datos
      this.confidence = 0;
      return { systolic: NaN, diastolic: NaN };
    }

    // Intentar usar el modelo neuronal si está disponible
    if (this.bpModel) {
      try {
        // Preprocesar entrada para el modelo (asegúrate que coincida)
        const modelInput: Tensor1D = ppgValues.slice(-128); // Ejemplo
        if (modelInput.length < 128) {
            this.confidence = 0;
            return { systolic: NaN, diastolic: NaN };
        }
        
        // El modelo BP devuelve un tensor con [systolic, diastolic]
        const predictionTensor = this.bpModel.predict(modelInput);
        let predictedSystolic = predictionTensor[0];
        let predictedDiastolic = predictionTensor[1];

        // Validar y limitar resultados del modelo
        const isValidSystolic = predictedSystolic >= MIN_SYSTOLIC && predictedSystolic <= MAX_SYSTOLIC;
        const isValidDiastolic = predictedDiastolic >= MIN_DIASTOLIC && predictedDiastolic <= MAX_DIASTOLIC;
        const isValidPair = isValidSystolic && isValidDiastolic && predictedSystolic > predictedDiastolic;

        if (isValidPair) {
          this.confidence = 0.65; // Confianza base del modelo
          this.lastSystolic = predictedSystolic;
          this.lastDiastolic = predictedDiastolic;
          this.updateBuffers(predictedSystolic, predictedDiastolic);
          const smoothed = this.getSmoothedPressure();
          return { systolic: smoothed.systolic, diastolic: smoothed.diastolic };
        } else {
          console.warn(`BP prediction out of range or invalid: S=${predictedSystolic}, D=${predictedDiastolic}`);
          this.confidence = 0.1;
          return { systolic: NaN, diastolic: NaN };
        }
      } catch (error) {
        console.error("Error during Blood Pressure model prediction:", error);
        this.confidence = 0;
        // Fallback si el modelo falla (o no existe)
        return this.calculateBloodPressureFallback(ppgValues);
      }
    } else {
      // Fallback si el modelo no está cargado
      console.warn("BP Model not loaded, using fallback calculation.");
      this.confidence = 0.15; // Confianza baja para fallback
      return this.calculateBloodPressureFallback(ppgValues);
    }
  }

  // Fallback: Estimación basada en características de la onda PPG (PTT - Pulse Transit Time simplificado)
  // Nota: Esto es una gran simplificación y NO es clínicamente preciso sin calibración y/o ECG.
  private calculateBloodPressureFallback(ppgValues: number[]): { systolic: number | typeof NaN; diastolic: number | typeof NaN } {
      console.warn("BP Fallback calculation is highly experimental and likely inaccurate.");
      // Placeholder: Devolver NaN para indicar que no hay cálculo fiable.
      return { systolic: NaN, diastolic: NaN };
      /*
      // Ejemplo de lógica Placeholder (NO PRECISA):
      const normalized = normalizeValues(ppgValues);
      const { peakIndices, valleyIndices } = findPeaksAndValleys(normalized);

      if (peakIndices.length < 2 || valleyIndices.length === 0) {
          return { systolic: NaN, diastolic: NaN };
      }

      // Estimación simple basada en la pendiente de subida (muy simplificado)
      const riseTimes: number[] = [];
      for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length); i++) {
          const peakIdx = peakIndices[i];
          // Find the preceding valley more carefully
          let valleyIdx = -1;
          for(let j = valleyIndices.length - 1; j >= 0; j--) {
              if (valleyIndices[j] < peakIdx) {
                  valleyIdx = valleyIndices[j];
                  break;
              }
          }
          if (valleyIdx !== -1 && peakIdx > valleyIdx) {
              const riseTime = peakIdx - valleyIdx; // In samples
              riseTimes.push(riseTime);
          }
      }

      if (riseTimes.length === 0) return { systolic: NaN, diastolic: NaN };

      const avgRiseTime = riseTimes.reduce((s, t) => s + t, 0) / riseTimes.length;
      
      // Fórmulas inversas muy simplificadas (Placeholder - REQUIERE CALIBRACIÓN REAL)
      // Más rápido el ascenso -> mayor presión (generalmente)
      const estimatedSystolic = 160 - avgRiseTime * 2; // Ajustar factores con calibración
      const estimatedDiastolic = 100 - avgRiseTime * 1; // Ajustar factores con calibración

      const systolic = Math.max(MIN_SYSTOLIC, Math.min(MAX_SYSTOLIC, estimatedSystolic));
      const diastolic = Math.max(MIN_DIASTOLIC, Math.min(MAX_DIASTOLIC, estimatedDiastolic));

      if (systolic <= diastolic) return { systolic: NaN, diastolic: NaN }; // Inválido

      this.updateBuffers(systolic, diastolic);
      return this.getSmoothedPressure();
      */
  }
  
  private updateBuffers(systolic: number, diastolic: number): void {
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    if (this.systolicBuffer.length > this.BUFFER_SIZE) {
      this.systolicBuffer.shift();
    }
    if (this.diastolicBuffer.length > this.BUFFER_SIZE) {
      this.diastolicBuffer.shift();
    }
  }

  private getSmoothedPressure(): { systolic: number, diastolic: number } {
    const smoothedSystolic = this.systolicBuffer.length > 0
      ? this.systolicBuffer.reduce((a, b) => a + b, 0) / this.systolicBuffer.length
      : NaN;
    const smoothedDiastolic = this.diastolicBuffer.length > 0
      ? this.diastolicBuffer.reduce((a, b) => a + b, 0) / this.diastolicBuffer.length
      : NaN;
    
    // Use Math.round for final integer values
    return {
        systolic: Math.round(smoothedSystolic),
        diastolic: Math.round(smoothedDiastolic)
    };
  }

  private calculateMedian(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 !== 0 ? sortedArray[mid] : (sortedArray[mid - 1] + sortedArray[mid]) / 2;
  }

  public getConfidence(): number {
     // Incorporate signal quality later if available
     // const signalQuality = evaluateSignalQuality(ppgValues); // Need ppgValues
     // return this.confidence * (signalQuality / 100);
     return this.confidence;
  }

  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastSystolic = DEFAULT_SYSTOLIC;
    this.lastDiastolic = DEFAULT_DIASTOLIC;
    this.confidence = 0;
    console.log("Blood Pressure Processor Reset");
  }
}
