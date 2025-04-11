import { calculateAmplitude, findPeaksAndValleys } from './utils';

export class BloodPressureProcessor {
  // Tamaños de buffer basados en frecuencia de muestreo
  private readonly BP_BUFFER_SIZE = 450; // 15 segundos a 30Hz
  
  // Pesos para cálculos estadísticos
  private readonly MEDIAN_WEIGHT = 0.6;
  private readonly MEAN_WEIGHT = 0.4;
  
  // Buffers para historial de mediciones
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private lastValidMeasurement: { systolic: number; diastolic: number } | null = null;
  
  // Rangos fisiológicos basados en literatura médica
  private readonly MIN_SYSTOLIC = 80;
  private readonly MAX_SYSTOLIC = 190;
  private readonly MIN_DIASTOLIC = 50;
  private readonly MAX_DIASTOLIC = 120;
  private readonly MIN_PULSE_PRESSURE = 25;
  private readonly MAX_PULSE_PRESSURE = 70;
  
  // Umbrales de calidad de señal
  private readonly MIN_SIGNAL_AMPLITUDE = 0.001;
  private readonly MIN_PEAK_COUNT = 1;
  private readonly MIN_FPS = 30;
  
  // Control de tiempo para mediciones
  private lastCalculationTime: number = 0;
  private readonly RECALCULATION_INTERVAL = 2000;
  private readonly MIN_SAMPLES_FOR_CALCULATION = 450; // 15 segundos de datos

  /**
   * Calcula la presión arterial usando características directas de la señal PPG
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    const currentTime = Date.now();
    
    // Validación básica de datos
    if (!this.isValidSignal(values)) {
      return this.getLastValidMeasurement();
    }

    // Análisis de la señal PPG
    const signalFeatures = this.analyzeSignal(values);
    if (!signalFeatures.isValid) {
      return this.getLastValidMeasurement();
    }

    // Cálculo de presión basado en características de la señal
    const { systolic, diastolic } = this.calculatePressureFromFeatures(signalFeatures);
    
    // Actualizar buffers y último cálculo válido
    this.updateBuffers(systolic, diastolic);
    this.lastCalculationTime = currentTime;
    
    // Calcular valores finales usando estadísticas
    const finalValues = this.calculateFinalValues();
    this.lastValidMeasurement = finalValues;
    
    return finalValues;
  }

  private isValidSignal(values: number[]): boolean {
    if (!values?.length) return false;
    
    const signalAmplitude = Math.max(...values) - Math.min(...values);
    return values.length >= this.MIN_SAMPLES_FOR_CALCULATION && 
           signalAmplitude >= this.MIN_SIGNAL_AMPLITUDE;
  }

  private analyzeSignal(values: number[]): {
    isValid: boolean;
    ptt?: number;
    amplitude?: number;
    peakCount?: number;
    features?: any;
  } {
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    
    if (peakIndices.length < this.MIN_PEAK_COUNT) {
      return { isValid: false };
    }

    const pttValues = this.calculatePTTValues(peakIndices);
    if (pttValues.length === 0) {
      return { isValid: false };
    }

    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    const features = this.extractSignalFeatures(values, peakIndices, valleyIndices);
    
    return {
      isValid: true,
      ptt: this.calculateWeightedPTT(pttValues),
      amplitude,
      peakCount: peakIndices.length,
      features
    };
  }

  private calculatePressureFromFeatures(signalFeatures: any): { 
    systolic: number; 
    diastolic: number; 
  } {
    const { ptt, amplitude, features } = signalFeatures;
    
    // Factores basados en características de la señal
    const pttFactor = this.calculatePTTFactor(ptt);
    const amplitudeFactor = this.calculateAmplitudeFactor(amplitude);
    const morphologyFactor = this.calculateMorphologyFactor(features);
    
    // Cálculo de presiones usando múltiples características
    let systolic = this.calculateSystolicPressure(pttFactor, amplitudeFactor, morphologyFactor);
    let diastolic = this.calculateDiastolicPressure(pttFactor, amplitudeFactor, morphologyFactor);
    
    // Ajustar para mantener diferencial fisiológico
    ({ systolic, diastolic } = this.adjustPressureDifferential(systolic, diastolic));
    
    return { systolic, diastolic };
  }

  private calculatePTTValues(peakIndices: number[]): number[] {
    const pttValues: number[] = [];
    const msPerSample = 1000 / this.MIN_FPS;
    
    for (let i = 1; i < peakIndices.length; i++) {
      const ptt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      if (ptt >= 200 && ptt <= 2000) {
        pttValues.push(ptt);
      }
    }
    
    return pttValues;
  }

  private calculateWeightedPTT(pttValues: number[]): number {
    if (pttValues.length === 0) return 0;
    
    const sortedPTT = [...pttValues].sort((a, b) => a - b);
    const filteredPTT = this.filterOutliers(pttValues, sortedPTT, 2.5);
    
    let weightedSum = 0;
    let weightSum = 0;
    
    filteredPTT.forEach((val, idx) => {
      const weight = Math.exp(-idx / filteredPTT.length);
      weightedSum += val * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : sortedPTT[Math.floor(sortedPTT.length / 2)];
  }

  private calculatePTTFactor(ptt: number): number {
    return (850 - Math.max(200, Math.min(2000, ptt))) * 0.12;
  }

  private calculateAmplitudeFactor(amplitude: number): number {
    return Math.min(100, Math.max(5, amplitude * 10.0)) * 0.28;
  }

  private calculateMorphologyFactor(features: any): number {
    const { 
      dicroticNotchPosition, 
      dicroticNotchAmplitude,
      systolicSlope,
      diastolicSlope 
    } = features;
    
    return (dicroticNotchPosition * 0.3 + 
            dicroticNotchAmplitude * 0.2 +
            systolicSlope * 0.3 +
            diastolicSlope * 0.2);
  }

  private calculateSystolicPressure(
    pttFactor: number,
    amplitudeFactor: number,
    morphologyFactor: number
  ): number {
    const basePressure = this.getBaselineSystolic();
    const pressure = basePressure + pttFactor + amplitudeFactor + morphologyFactor;
    return Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, pressure));
  }

  private calculateDiastolicPressure(
    pttFactor: number,
    amplitudeFactor: number,
    morphologyFactor: number
  ): number {
    const basePressure = this.getBaselineDiastolic();
    const pressure = basePressure + 
                    (pttFactor * 0.45) + 
                    (amplitudeFactor * 0.22) + 
                    (morphologyFactor * 0.33);
    return Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, pressure));
  }

  private adjustPressureDifferential(systolic: number, diastolic: number): {
    systolic: number;
    diastolic: number;
  } {
    const differential = systolic - diastolic;
    
    if (differential < this.MIN_PULSE_PRESSURE) {
      diastolic = systolic - this.MIN_PULSE_PRESSURE;
    } else if (differential > this.MAX_PULSE_PRESSURE) {
      diastolic = systolic - this.MAX_PULSE_PRESSURE;
    }
    
    diastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));
    
    return { systolic, diastolic };
  }

  private getBaselineSystolic(): number {
    if (this.systolicBuffer.length === 0) {
      return 120; // Valor inicial basado en literatura médica
    }
    return this.calculateMedian([...this.systolicBuffer].sort((a, b) => a - b));
  }

  private getBaselineDiastolic(): number {
    if (this.diastolicBuffer.length === 0) {
      return 80; // Valor inicial basado en literatura médica
    }
    return this.calculateMedian([...this.diastolicBuffer].sort((a, b) => a - b));
  }

  private getLastValidMeasurement(): { systolic: number; diastolic: number } {
    if (this.lastValidMeasurement) {
      return this.lastValidMeasurement;
    }
    return {
      systolic: this.getBaselineSystolic(),
      diastolic: this.getBaselineDiastolic()
    };
  }

  private updateBuffers(systolic: number, diastolic: number): void {
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
  }

  /**
   * Calculate median of an array
   */
  private calculateMedian(sortedArray: number[]): number {
    if (sortedArray.length === 0) return 0;
    
    const medianIndex = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[medianIndex - 1] + sortedArray[medianIndex]) / 2
      : sortedArray[medianIndex];
  }
  
  /**
   * Filter outliers using IQR method with configurable threshold
   */
  private filterOutliers(values: number[], sortedValues: number[], iqrThreshold: number = 1.5): number[] {
    if (sortedValues.length < 4) return values;
    
    const q1Index = Math.floor(sortedValues.length / 4);
    const q3Index = Math.floor(3 * sortedValues.length / 4);
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - iqrThreshold * iqr;
    const upperBound = q3 + iqrThreshold * iqr;
    
    return values.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Calculate final blood pressure values using median and mean
   * for greater stability and noise rejection
   */
  private calculateFinalValues(): { systolic: number; diastolic: number } {
    if (this.systolicBuffer.length === 0) {
      return { 
        systolic: this.getBaselineSystolic(),
        diastolic: this.getBaselineDiastolic()
      };
    }
    
    // 1. Calculate medians
    const sortedSystolic = [...this.systolicBuffer].sort((a, b) => a - b);
    const sortedDiastolic = [...this.diastolicBuffer].sort((a, b) => a - b);
    
    const systolicMedian = this.calculateMedian(sortedSystolic);
    const diastolicMedian = this.calculateMedian(sortedDiastolic);
    
    // 2. Calculate averages
    const systolicMean = this.systolicBuffer.reduce((sum, val) => sum + val, 0) / this.systolicBuffer.length;
    const diastolicMean = this.diastolicBuffer.reduce((sum, val) => sum + val, 0) / this.diastolicBuffer.length;
    
    // 3. Apply weighting between median and average
    const systolic = Math.round((systolicMedian * this.MEDIAN_WEIGHT) + (systolicMean * this.MEAN_WEIGHT));
    const diastolic = Math.round((diastolicMedian * this.MEDIAN_WEIGHT) + (diastolicMean * this.MEAN_WEIGHT));
    
    return { systolic, diastolic };
  }
  
  /**
   * Reset the blood pressure processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastCalculationTime = 0;
    console.log("BloodPressureProcessor: Reset completed");
  }

  private extractSignalFeatures(values: number[], peakIndices: number[], valleyIndices: number[]): {
    dicroticNotchPosition: number;
    dicroticNotchAmplitude: number;
    systolicSlope: number;
    diastolicSlope: number;
  } {
    // Calcular características morfológicas de la señal PPG
    const dicroticNotches = this.findDicroticNotches(values, peakIndices);
    const avgNotchPos = dicroticNotches.reduce((sum, pos) => sum + pos, 0) / dicroticNotches.length || 0.5;
    const avgNotchAmp = this.calculateNotchAmplitude(values, dicroticNotches) || 0.5;
    
    // Calcular pendientes
    const systolicSlope = this.calculateSystolicSlope(values, peakIndices, valleyIndices) || 1.0;
    const diastolicSlope = this.calculateDiastolicSlope(values, peakIndices, valleyIndices) || -0.5;
    
    return {
      dicroticNotchPosition: avgNotchPos,
      dicroticNotchAmplitude: avgNotchAmp,
      systolicSlope,
      diastolicSlope
    };
  }

  private findDicroticNotches(values: number[], peakIndices: number[]): number[] {
    const notches: number[] = [];
    
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const start = peakIndices[i];
      const end = peakIndices[i + 1];
      const segment = values.slice(start, end);
      
      // Buscar punto de inflexión después del pico sistólico
      let maxDerivative = -Infinity;
      let notchIndex = -1;
      
      for (let j = Math.floor(segment.length * 0.3); j < Math.floor(segment.length * 0.7); j++) {
        const derivative = segment[j + 1] - segment[j];
        if (derivative > maxDerivative) {
          maxDerivative = derivative;
          notchIndex = j;
        }
      }
      
      if (notchIndex !== -1) {
        notches.push(start + notchIndex);
      }
    }
    
    return notches;
  }

  private calculateNotchAmplitude(values: number[], notchIndices: number[]): number {
    if (notchIndices.length === 0) return 0;
    
    const amplitudes = notchIndices.map(idx => values[idx]);
    return amplitudes.reduce((sum, amp) => sum + amp, 0) / amplitudes.length;
  }

  private calculateSystolicSlope(values: number[], peakIndices: number[], valleyIndices: number[]): number {
    const slopes: number[] = [];
    
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIdx = peakIndices[i];
      const prevValleyIdx = valleyIndices.filter(v => v < peakIdx).pop();
      
      if (prevValleyIdx !== undefined) {
        const deltaY = values[peakIdx] - values[prevValleyIdx];
        const deltaX = peakIdx - prevValleyIdx;
        slopes.push(deltaY / deltaX);
      }
    }
    
    return slopes.length > 0 ? 
      slopes.reduce((sum, slope) => sum + slope, 0) / slopes.length : 
      0;
  }

  private calculateDiastolicSlope(values: number[], peakIndices: number[], valleyIndices: number[]): number {
    const slopes: number[] = [];
    
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIdx = peakIndices[i];
      const nextValleyIdx = valleyIndices.find(v => v > peakIdx);
      
      if (nextValleyIdx !== undefined) {
        const deltaY = values[nextValleyIdx] - values[peakIdx];
        const deltaX = nextValleyIdx - peakIdx;
        slopes.push(deltaY / deltaX);
      }
    }
    
    return slopes.length > 0 ? 
      slopes.reduce((sum, slope) => sum + slope, 0) / slopes.length : 
      0;
  }
}
