
import { calculateMeanValue, smoothSignal } from '../../utils/vitalSignsUtils';

export class HemoglobinProcessor {
  private values: number[] = [];
  private readonly maxSamples = 300;
  private readonly minSamplesToCalculate = 100;
  
  /**
   * Procesa un valor de señal PPG para estimar la hemoglobina
   * @param ppgValue Valor de la señal PPG filtrada
   * @returns Estimación de hemoglobina en g/dL o 0 si no hay suficientes datos
   */
  processValue(ppgValue: number): number {
    if (this.values.length >= this.maxSamples) {
      this.values.shift();
    }
    
    this.values.push(ppgValue);
    
    if (this.values.length < this.minSamplesToCalculate) {
      return 0;
    }
    
    // Aplicar suavizado a la señal para reducir el ruido
    const smoothedValues = smoothSignal(this.values, 0.85);
    
    // Calcular el valor medio de la señal suavizada
    const meanValue = calculateMeanValue(smoothedValues);
    
    // Aplicar algoritmo de estimación de hemoglobina basado en características de la señal PPG
    // Esta es una implementación simple que requiere calibración clínica para mayor precisión
    const amplitudeVariation = this.calculateAmplitudeVariation(smoothedValues);
    const baseline = 12.5; // Valor de referencia de hemoglobina normal
    
    // La estimación se basa en la variación de amplitud de la señal PPG
    // Los coeficientes son aproximados y deberían ser calibrados con datos clínicos
    const hemoglobin = baseline + (amplitudeVariation * 2.5) - (Math.abs(meanValue) * 0.08);
    
    // Limitar el rango a valores fisiológicamente plausibles
    return Math.max(8.0, Math.min(18.0, hemoglobin));
  }
  
  /**
   * Calcula la hemoglobina basada en un array de valores PPG
   * Método de compatibilidad para el VitalSignsProcessor
   */
  calculateHemoglobin(ppgValues: number[]): number {
    // Reiniciar el procesador para trabajar con el nuevo conjunto de datos
    this.reset();
    
    // Procesar cada valor del array
    let result = 0;
    for (const value of ppgValues) {
      result = this.processValue(value);
    }
    
    return result;
  }
  
  /**
   * Calcula la variación de amplitud de la señal
   */
  private calculateAmplitudeVariation(values: number[]): number {
    if (values.length < 2) return 0;
    
    let sumVariation = 0;
    for (let i = 1; i < values.length; i++) {
      sumVariation += Math.abs(values[i] - values[i-1]);
    }
    
    return sumVariation / (values.length - 1);
  }
  
  /**
   * Reinicia el procesador
   */
  reset(): void {
    this.values = [];
  }
}
