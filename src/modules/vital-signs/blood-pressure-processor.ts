import { calculateAmplitude, findPeaksAndValleys } from './utils';

export class BloodPressureProcessor {
  private readonly BP_BUFFER_SIZE = 15;
  private readonly BP_ALPHA = 0.65;
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private readonly MIN_VALID_PEAKS = 4;
  private readonly PTT_WEIGHT_FACTOR = 1.8;
  private readonly MIN_AMPLITUDE = 0.15;

  /**
   * Calculates blood pressure using PPG signal features
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (values.length < 60) {
      return { systolic: 0, diastolic: 0 };
    }

    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    if (peakIndices.length < this.MIN_VALID_PEAKS) {
      return { systolic: 0, diastolic: 0 };
    }

    const fps = 30;
    const msPerSample = 1000 / fps;

    // Cálculo mejorado de PTT con validación de calidad
    const pttValues: number[] = [];
    const amplitudes: number[] = [];
    
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      const amplitude = values[peakIndices[i]] - values[valleyIndices[i-1]];
      
      // Validación más estricta de intervalos PTT
      if (dt > 250 && dt < 1200 && amplitude > this.MIN_AMPLITUDE) {
        pttValues.push(dt);
        amplitudes.push(amplitude);
      }
    }

    if (pttValues.length < 3) {
      return { systolic: 0, diastolic: 0 };
    }

    // Cálculo ponderado mejorado de PTT
    let pttWeightSum = 0;
    let pttWeightedSum = 0;
    
    pttValues.forEach((val, idx) => {
      // Peso exponencial con factor de calidad de amplitud
      const qualityFactor = amplitudes[idx] / Math.max(...amplitudes);
      const weight = Math.pow((idx + 1) / pttValues.length, this.PTT_WEIGHT_FACTOR) * qualityFactor;
      pttWeightedSum += val * weight;
      pttWeightSum += weight;
    });

    const calculatedPTT = pttWeightSum > 0 ? pttWeightedSum / pttWeightSum : 600;
    const normalizedPTT = Math.max(300, Math.min(1200, calculatedPTT));
    
    // Cálculo mejorado de amplitud con corrección de línea base
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 7.2));

    // Factores de corrección optimizados
    const pttFactor = (600 - normalizedPTT) * 0.115;
    const ampFactor = normalizedAmplitude * 0.385;
    
    // Modelo de regresión múltiple mejorado
    let instantSystolic = 120 + pttFactor + ampFactor + 
                         (normalizedAmplitude > 60 ? 5 : 0) - 
                         (calculatedPTT > 800 ? 8 : 0);
                         
    let instantDiastolic = 80 + (pttFactor * 0.72) + (ampFactor * 0.31) -
                          (calculatedPTT > 800 ? 5 : 0);

    // Validación fisiológica mejorada
    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    // Control de diferencial de presión más preciso
    const differential = instantSystolic - instantDiastolic;
    if (differential < 30) {
      instantDiastolic = instantSystolic - 30;
    } else if (differential > 70) {
      instantDiastolic = instantSystolic - 70;
    }

    // Actualización de buffers con peso variable
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    // Promedio ponderado exponencial mejorado
    let finalSystolic = 0;
    let finalDiastolic = 0;
    let weightSum = 0;

    for (let i = 0; i < this.systolicBuffer.length; i++) {
      const weight = Math.pow(this.BP_ALPHA, this.systolicBuffer.length - 1 - i);
      finalSystolic += this.systolicBuffer[i] * weight;
      finalDiastolic += this.diastolicBuffer[i] * weight;
      weightSum += weight;
    }

    return {
      systolic: Math.round(weightSum > 0 ? finalSystolic / weightSum : instantSystolic),
      diastolic: Math.round(weightSum > 0 ? finalDiastolic / weightSum : instantDiastolic)
    };
  }

  /**
   * Reset the blood pressure processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }
}
