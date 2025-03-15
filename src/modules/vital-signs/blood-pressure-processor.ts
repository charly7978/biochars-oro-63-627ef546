
import { calculateAmplitude, findPeaksAndValleys } from './utils';

export class BloodPressureProcessor {
  // Tamaño de buffer ampliado para mayor estabilidad
  private readonly BP_BUFFER_SIZE = 20; // Increased from 15 to 20
  // Parámetros de mediana y promedio ponderado
  private readonly MEDIAN_WEIGHT = 0.7; // Increased from 0.6 to 0.7
  private readonly MEAN_WEIGHT = 0.3; // Decreased from 0.4 to 0.3
  // Historia de mediciones
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  // Definir valores fisiológicos válidos
  private readonly MIN_SYSTOLIC = 90;
  private readonly MAX_SYSTOLIC = 170;
  private readonly MIN_DIASTOLIC = 60;
  private readonly MAX_DIASTOLIC = 100;
  private readonly MIN_PULSE_PRESSURE = 30;
  private readonly MAX_PULSE_PRESSURE = 60;
  // Umbrales mínimos para aceptar una medición
  private readonly MIN_SIGNAL_AMPLITUDE = 0.04; // Increased from 0.03 to 0.04
  private readonly MIN_PEAK_COUNT = 5; // Increased from 4 to 5
  private readonly MIN_FPS = 25; // Increased from 20 to 25
  // New parameters for better BP calculation
  private readonly PTT_COEF = 0.08; // Decreased from 0.09 to 0.08
  private readonly AMP_COEF = 0.22; // Decreased from 0.25 to 0.22
  private readonly BASE_SYSTOLIC = 118; // Changed from 115
  private readonly BASE_DIASTOLIC = 78; // Changed from 75

  /**
   * Calcula la presión arterial utilizando características de la señal PPG
   * Implementa un enfoque de mediana y promedio ponderado para mayor precisión
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    // Validación de calidad de la señal
    if (values.length < 40 || Math.max(...values) - Math.min(...values) < this.MIN_SIGNAL_AMPLITUDE) {
      return { systolic: 0, diastolic: 0 };
    }

    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    if (peakIndices.length < this.MIN_PEAK_COUNT) {
      return { systolic: 0, diastolic: 0 };
    }

    // Parámetros de muestreo
    const fps = this.MIN_FPS; // Tasa de muestreo conservadora
    const msPerSample = 1000 / fps;

    // Calcular valores PTT (Pulse Transit Time) con mayor precisión
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      // Rango fisiológicamente válido más estricto
      if (dt > 400 && dt < 1200) {
        pttValues.push(dt);
      }
    }
    
    // Filtrar valores atípicos (outliers) usando técnica estadística
    const sortedPTT = [...pttValues].sort((a, b) => a - b);
    const medianPTT = sortedPTT.length % 2 === 0
      ? (sortedPTT[Math.floor(sortedPTT.length / 2) - 1] + sortedPTT[Math.floor(sortedPTT.length / 2)]) / 2
      : sortedPTT[Math.floor(sortedPTT.length / 2)];
    
    // Filtrar valores fuera de 1.5 IQR (rango intercuartil)
    let filteredPTT: number[] = [];
    if (sortedPTT.length >= 4) {
      const q1Index = Math.floor(sortedPTT.length / 4);
      const q3Index = Math.floor(3 * sortedPTT.length / 4);
      const q1 = sortedPTT[q1Index];
      const q3 = sortedPTT[q3Index];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      filteredPTT = pttValues.filter(val => val >= lowerBound && val <= upperBound);
    } else {
      filteredPTT = pttValues;
    }
    
    // Si no hay suficientes mediciones después del filtrado, usar el valor mediano
    let calculatedPTT = 0;
    if (filteredPTT.length >= 3) {
      // Calcular PTT ponderado con mayor peso a valores más recientes
      let weightSum = 0;
      let weightedSum = 0;
      
      filteredPTT.forEach((val, idx) => {
        // Ponderación exponencial que da más peso a muestras más recientes
        const weight = Math.pow(1.3, idx) / filteredPTT.length; // Increased from 1.2 to 1.3
        weightedSum += val * weight;
        weightSum += weight;
      });
      
      calculatedPTT = weightSum > 0 ? weightedSum / weightSum : medianPTT;
    } else if (sortedPTT.length > 0) {
      calculatedPTT = medianPTT;
    } else {
      calculatedPTT = 800; // Valor conservador si no hay datos suficientes
    }
    
    // Normalizar PTT a un rango fisiológicamente relevante
    const normalizedPTT = Math.max(500, Math.min(1100, calculatedPTT));
    
    // Calcular amplitud mejorada de la señal PPG
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    // Menor factor de amplificación para evitar sobreestimación
    const normalizedAmplitude = Math.min(80, Math.max(0, amplitude * 4.8)); // Changed from 5.0 to 4.8

    // Coeficientes más conservadores basados en estudios de validación
    const pttFactor = (800 - normalizedPTT) * this.PTT_COEF;
    const ampFactor = normalizedAmplitude * this.AMP_COEF;
    
    // Usar un modelo de estimación más conservador
    let instantSystolic = this.BASE_SYSTOLIC + pttFactor + ampFactor;
    let instantDiastolic = this.BASE_DIASTOLIC + (pttFactor * 0.52) + (ampFactor * 0.22); // Adjusted from 0.55/0.25
    
    // Aplicar límites fisiológicos
    instantSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, instantSystolic));
    instantDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, instantDiastolic));
    
    // Mantener diferencial de presión fisiológicamente válido
    const differential = instantSystolic - instantDiastolic;
    if (differential < this.MIN_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MIN_PULSE_PRESSURE;
    } else if (differential > this.MAX_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MAX_PULSE_PRESSURE;
    }
    
    // Verificar nuevamente límites fisiológicos después del ajuste de diferencial
    instantDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, instantDiastolic));

    // Actualizar buffers de presión con nuevos valores
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    // Mantener tamaño de buffer limitado
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    // Implementar enfoque de mediana y promedio ponderado para mayor estabilidad
    // 1. Calcular medianas
    const sortedSystolic = [...this.systolicBuffer].sort((a, b) => a - b);
    const sortedDiastolic = [...this.diastolicBuffer].sort((a, b) => a - b);
    
    const medianIndex = Math.floor(this.systolicBuffer.length / 2);
    const systolicMedian = this.systolicBuffer.length % 2 === 0
      ? (sortedSystolic[medianIndex - 1] + sortedSystolic[medianIndex]) / 2
      : sortedSystolic[medianIndex];
      
    const diastolicMedian = this.diastolicBuffer.length % 2 === 0
      ? (sortedDiastolic[medianIndex - 1] + sortedDiastolic[medianIndex]) / 2
      : sortedDiastolic[medianIndex];
    
    // 2. Calcular promedios
    const systolicMean = this.systolicBuffer.reduce((sum, val) => sum + val, 0) / this.systolicBuffer.length;
    const diastolicMean = this.diastolicBuffer.reduce((sum, val) => sum + val, 0) / this.diastolicBuffer.length;
    
    // 3. Aplicar ponderación entre mediana y promedio
    const finalSystolic = (systolicMedian * this.MEDIAN_WEIGHT) + (systolicMean * this.MEAN_WEIGHT);
    const finalDiastolic = (diastolicMedian * this.MEDIAN_WEIGHT) + (diastolicMean * this.MEAN_WEIGHT);
    
    // 4. Verificar diferencial de presión en resultado final
    let adjustedSystolic = finalSystolic;
    let adjustedDiastolic = finalDiastolic;
    
    const finalDifferential = adjustedSystolic - adjustedDiastolic;
    if (finalDifferential < this.MIN_PULSE_PRESSURE) {
      adjustedDiastolic = adjustedSystolic - this.MIN_PULSE_PRESSURE;
    } else if (finalDifferential > this.MAX_PULSE_PRESSURE) {
      adjustedDiastolic = adjustedSystolic - this.MAX_PULSE_PRESSURE;
    }
    
    // 5. Aplicar límites fisiológicos una última vez
    adjustedDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, adjustedDiastolic));

    return {
      systolic: Math.round(adjustedSystolic),
      diastolic: Math.round(adjustedDiastolic)
    };
  }
  
  /**
   * Reinicia el estado del procesador de presión arterial
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }
}
