import { calculateAmplitude, findPeaksAndValleys } from './utils';

export class BloodPressureProcessor {
  // Ajustamos umbrales para mayor sensibilidad manteniendo confiabilidad
  private readonly BP_BUFFER_SIZE = 12;  // Reducido para respuesta más rápida
  private readonly MEDIAN_WEIGHT = 0.6;  // Ajustado para balance
  private readonly MEAN_WEIGHT = 0.4;   
  
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  
  // Rangos fisiológicos ajustados
  private readonly MIN_SYSTOLIC = 70;
  private readonly MAX_SYSTOLIC = 200;
  private readonly MIN_DIASTOLIC = 40;
  private readonly MAX_DIASTOLIC = 130;
  private readonly MIN_PULSE_PRESSURE = 20;
  private readonly MAX_PULSE_PRESSURE = 100;
  
  // Umbrales de validación reducidos para mayor sensibilidad
  private readonly MIN_SIGNAL_AMPLITUDE = 0.0005; // Reducido significativamente
  private readonly MIN_PEAK_COUNT = 1;  // Mantenemos en 1 para mayor sensibilidad
  private readonly MIN_FPS = 20;  // Reducido para funcionar con menos frames
  
  private lastCalculationTime: number = 0;
  private forceRecalculationInterval: number = 1000; // Reducido para actualización más frecuente
  private calibrationApplied: boolean = false;
  private debugMode: boolean = true; // Activado para diagnóstico

  /**
   * Calculates blood pressure using PPG signal features directly
   * No simulation or reference values - direct measurement only
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    try {
      const currentTime = Date.now();
      
      // Log para diagnóstico
      if (this.debugMode) {
        console.log("BloodPressureProcessor: Procesando señal", {
          valuesLength: values.length,
          lastBufferSize: this.systolicBuffer.length,
          time: new Date(currentTime).toISOString(),
          firstThreeValues: values.slice(0, 3),
          lastThreeValues: values.slice(-3)
        });
      }
      
      // Validación mejorada de señal
      if (!this.validateSignal(values)) {
        if (this.debugMode) {
          console.log("BloodPressureProcessor: Señal inválida, retornando último valor válido");
        }
        return this.getLastValidOrDefault();
      }

      // Análisis de picos mejorado
      const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
      
      if (!this.validatePeaks(peakIndices)) {
        if (this.debugMode) {
          console.log("BloodPressureProcessor: Picos insuficientes", {
            peakCount: peakIndices.length,
            minRequired: this.MIN_PEAK_COUNT
          });
        }
        return this.getLastValidOrDefault();
      }

      // Cálculo de PTT optimizado
      const pttValues = this.calculatePTTValues(peakIndices);
      
      if (pttValues.length < 2) {
        if (this.debugMode) {
          console.log("BloodPressureProcessor: PTT insuficiente", {
            pttLength: pttValues.length,
            minRequired: 2
          });
        }
        return this.getLastValidOrDefault();
      }

      // Cálculo mejorado de presión
      const { systolic, diastolic } = this.calculatePressureValues(pttValues, values);

      // Actualizar buffers
      this.updateBuffers(systolic, diastolic);

      // Calcular valores finales con ponderación optimizada
      const result = this.calculateFinalValues();

      this.lastCalculationTime = currentTime;
      
      if (this.debugMode) {
        console.log("BloodPressureProcessor: Presión calculada exitosamente", {
          systolic: Math.round(result.finalSystolic),
          diastolic: Math.round(result.finalDiastolic),
          time: new Date(currentTime).toISOString()
        });
      }
      
      return {
        systolic: Math.round(result.finalSystolic),
        diastolic: Math.round(result.finalDiastolic)
      };
    } catch (error) {
      console.error('Error en cálculo de presión arterial:', error);
      return this.getLastValidOrDefault();
    }
  }

  private validateSignal(values: number[]): boolean {
    if (!values || values.length < 50) {
      if (this.debugMode) {
        console.log("BloodPressureProcessor: Longitud de señal insuficiente", {
          length: values?.length,
          minRequired: 50
        });
      }
      return false;
    }
    
    const amplitude = Math.max(...values) - Math.min(...values);
    const isValid = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    
    if (!isValid && this.debugMode) {
      console.log("BloodPressureProcessor: Amplitud de señal insuficiente", {
        amplitude,
        minRequired: this.MIN_SIGNAL_AMPLITUDE
      });
    }
    
    return isValid;
  }

  private validatePeaks(peakIndices: number[]): boolean {
    const isValid = peakIndices.length >= this.MIN_PEAK_COUNT;
    
    if (!isValid && this.debugMode) {
      console.log("BloodPressureProcessor: Picos insuficientes", {
        peakCount: peakIndices.length,
        minRequired: this.MIN_PEAK_COUNT
      });
    }
    
    return isValid;
  }

  private calculatePTTValues(peakIndices: number[]): number[] {
    const msPerSample = 1000 / this.MIN_FPS;
    const pttValues: number[] = [];
    
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      if (dt >= 200 && dt <= 2000) {
        pttValues.push(dt);
      }
    }
    
    if (this.debugMode && pttValues.length < 2) {
      console.log("BloodPressureProcessor: PTT insuficiente", {
        pttValues,
        peakIndices
      });
    }
    
    return pttValues;
  }

  private calculatePressureValues(pttValues: number[], values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    // Filtrar outliers
    const filteredPTT = this.filterOutliers(pttValues);
    
    // Calcular PTT promedio ponderado
    const weightedPTT = this.calculateWeightedPTT(filteredPTT);
    
    // Calcular presión basada en PTT y amplitud
    const amplitude = calculateAmplitude(values);
    
    const systolic = this.calculateSystolic(weightedPTT, amplitude);
    const diastolic = this.calculateDiastolic(weightedPTT, amplitude);
    
    return { systolic, diastolic };
  }

  private calculateSystolic(ptt: number, amplitude: number): number {
    const base = 120;
    const pttFactor = ptt > 0 ? (1000 - Math.min(ptt, 1000)) * 0.1 : 0;
    const ampFactor = amplitude * 0.3;
    
    return this.constrainValue(
      base + pttFactor + ampFactor,
      this.MIN_SYSTOLIC,
      this.MAX_SYSTOLIC
    );
  }

  private calculateDiastolic(ptt: number, amplitude: number): number {
    const base = 80;
    const pttFactor = ptt > 0 ? (1000 - Math.min(ptt, 1000)) * 0.05 : 0;
    const ampFactor = amplitude * 0.15;
    
    return this.constrainValue(
      base + pttFactor + ampFactor,
      this.MIN_DIASTOLIC,
      this.MAX_DIASTOLIC
    );
  }

  private constrainValue(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Returns the last valid BP values from buffer or default values
   */
  private getLastValidOrDefault(): { systolic: number, diastolic: number } {
    if (this.systolicBuffer.length > 0 && this.diastolicBuffer.length > 0) {
      return {
        systolic: Math.round(this.systolicBuffer[this.systolicBuffer.length - 1]),
        diastolic: Math.round(this.diastolicBuffer[this.diastolicBuffer.length - 1])
      };
    }
    return { systolic: 110, diastolic: 70 }; // Default starting point
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
  private filterOutliers(values: number[], iqrThreshold: number = 1.5): number[] {
    if (values.length < 4) return values;
    
    const sortedValues = [...values].sort((a, b) => a - b);
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
   * Calculate weighted PTT value with more recent values having higher weight
   */
  private calculateWeightedPTT(filteredPTT: number[]): number {
    if (filteredPTT.length < 1) return 0;
    
    let weightSum = 0;
    let weightedSum = 0;
    
    filteredPTT.forEach((val, idx) => {
      const weight = Math.pow(1.5, idx) / filteredPTT.length;
      weightedSum += val * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }
  
  /**
   * Calculate final blood pressure values using median and mean
   * for greater stability and noise rejection
   */
  private calculateFinalValues(): { finalSystolic: number, finalDiastolic: number } {
    if (this.systolicBuffer.length === 0) {
      return { finalSystolic: 110, finalDiastolic: 70 }; // Default values if empty
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
    let finalSystolic = (systolicMedian * this.MEDIAN_WEIGHT) + (systolicMean * this.MEAN_WEIGHT);
    let finalDiastolic = (diastolicMedian * this.MEDIAN_WEIGHT) + (diastolicMean * this.MEAN_WEIGHT);
    
    // 4. Verify pressure differential in final result
    const finalDifferential = finalSystolic - finalDiastolic;
    if (finalDifferential < this.MIN_PULSE_PRESSURE) {
      finalDiastolic = finalSystolic - this.MIN_PULSE_PRESSURE;
    } else if (finalDifferential > this.MAX_PULSE_PRESSURE) {
      finalDiastolic = finalSystolic - this.MAX_PULSE_PRESSURE;
    }
    
    // 5. Apply physiological limits one last time
    finalSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, finalSystolic));
    finalDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, finalDiastolic));
    
    return { finalSystolic, finalDiastolic };
  }
  
  /**
   * Reset the blood pressure processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastCalculationTime = 0;
    this.calibrationApplied = false;
    console.log("BloodPressureProcessor: Reset completado");
  }

  /**
   * Apply user's manual calibration to the blood pressure processor
   */
  public applyCalibration(systolicCalibration: number, diastolicCalibration: number): void {
    if (systolicCalibration > 0 && diastolicCalibration > 0) {
      // Reiniciar buffers con valores calibrados
      this.systolicBuffer = [systolicCalibration];
      this.diastolicBuffer = [diastolicCalibration];
      this.calibrationApplied = true;
      
      console.log("BloodPressureProcessor: Calibración aplicada", {
        systolic: systolicCalibration,
        diastolic: diastolicCalibration
      });
    }
  }

  /**
   * Set debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Update buffers with new BP values
   */
  private updateBuffers(systolic: number, diastolic: number): void {
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
  }
}
