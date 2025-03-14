
import { findPeaksAndValleys, calculateAmplitude } from './utils';

export class BloodPressureProcessor {
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private readonly BP_BUFFER_SIZE = 10;
  private readonly BP_ALPHA = 0.7;

  /**
   * Calcula la presión arterial a partir de la señal PPG
   * @param values Array de valores PPG
   * @returns Objeto con presión sistólica y diastólica
   */
  public calculateBloodPressure(values: number[]): { systolic: number; diastolic: number } {
    if (!values || values.length < 30) {
      return { systolic: 0, diastolic: 0 };
    }

    // Encontrar picos y valles
    const { peaks, valleys } = findPeaksAndValleys(values);
    
    if (peaks.length < 2) {
      return { systolic: 120, diastolic: 80 }; // Valores por defecto
    }

    const fps = 30;
    const msPerSample = 1000 / fps;

    // Calcular tiempos entre picos
    const pttValues: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const dt = (peaks[i] - peaks[i - 1]) * msPerSample;
      pttValues.push(dt);
    }
    
    // Calcular PTT ponderado
    const weightedPTT = pttValues.reduce((acc, val, idx) => {
      const weight = (idx + 1) / pttValues.length;
      return acc + val * weight;
    }, 0) / pttValues.reduce((acc, _, idx) => acc + (idx + 1) / pttValues.length, 0);

    // Normalizar valores para el modelo
    const normalizedPTT = Math.max(300, Math.min(1200, weightedPTT));
    
    // Calcular amplitud
    const amplitude = calculateAmplitude(values);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5));

    // Modelo simple de correlación PTT-presión arterial
    const pttFactor = (600 - normalizedPTT) * 0.08;
    const ampFactor = normalizedAmplitude * 0.3;
    
    // Calcular presiones instantáneas
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.5) + (ampFactor * 0.2);

    // Normalizar a rangos fisiológicos
    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    // Asegurar un diferencial razonable
    const differential = instantSystolic - instantDiastolic;
    if (differential < 20) {
      instantDiastolic = instantSystolic - 20;
    } else if (differential > 80) {
      instantDiastolic = instantSystolic - 80;
    }

    // Almacenar en buffer para suavizado
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    // Calcular media ponderada exponencial
    let finalSystolic = 0;
    let finalDiastolic = 0;
    let weightSum = 0;

    for (let i = 0; i < this.systolicBuffer.length; i++) {
      const weight = Math.pow(this.BP_ALPHA, this.systolicBuffer.length - 1 - i);
      finalSystolic += this.systolicBuffer[i] * weight;
      finalDiastolic += this.diastolicBuffer[i] * weight;
      weightSum += weight;
    }

    finalSystolic = finalSystolic / weightSum;
    finalDiastolic = finalDiastolic / weightSum;

    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
  }

  /**
   * Reinicia el estado del procesador
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }
}
