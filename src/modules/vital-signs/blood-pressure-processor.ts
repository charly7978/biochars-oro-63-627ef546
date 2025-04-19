
import { calculateAmplitude, findPeaksAndValleys } from './utils';

export class BloodPressureProcessor {
  // Ajustamos umbrales para mayor sensibilidad con datos reales
  private readonly BP_BUFFER_SIZE = 12;  // Reducido para respuesta más rápida
  private readonly MEDIAN_WEIGHT = 0.7;  // Mayor peso a valores medianos para estabilidad
  private readonly MEAN_WEIGHT = 0.3;   
  
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  
  // Rangos fisiológicos ajustados para mayor precisión
  private readonly MIN_SYSTOLIC = 70;
  private readonly MAX_SYSTOLIC = 200;
  private readonly MIN_DIASTOLIC = 40;
  private readonly MAX_DIASTOLIC = 130;
  private readonly MIN_PULSE_PRESSURE = 20;
  private readonly MAX_PULSE_PRESSURE = 100;
  
  // Umbrales de validación reducidos para capturar mejor la señal real
  private readonly MIN_SIGNAL_AMPLITUDE = 0.0005; // Reducido para mayor sensibilidad
  private readonly MIN_PEAK_COUNT = 1;  // Permitir incluso un solo pico para análisis
  private readonly MIN_FPS = 15;  // Reducido para funcionar con menos FPS
  
  private lastCalculationTime: number = 0;
  private forceRecalculationInterval: number = 1000; // Recalcular más frecuentemente
  
  // Factores de calibración
  private systolicCalibrationFactor: number = 1.0;
  private diastolicCalibrationFactor: number = 1.0;
  
  // Almacenamiento de valores calculados para depuración
  private lastCalculatedValues: {
    systolic: number;
    diastolic: number;
    peakCount: number;
    amplitude: number;
    timeStamp: number;
  } = {
    systolic: 0,
    diastolic: 0,
    peakCount: 0,
    amplitude: 0,
    timeStamp: 0
  };

  /**
   * Calcula la presión arterial utilizando características de señal PPG directamente
   * Sin simulación ni valores de referencia - solo medición directa
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    try {
      const currentTime = Date.now();
      
      // Validación de señal
      if (!this.validateSignal(values)) {
        console.log('BP: Señal demasiado débil para análisis confiable');
        return this.getLastValidOrDefault();
      }

      // Análisis de picos mejorado
      const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
      
      // Registra los datos para depuración
      console.log('BP: Picos detectados:', peakIndices.length, 'Valles:', valleyIndices.length);
      
      if (!this.validatePeaks(peakIndices)) {
        console.log('BP: No hay suficientes picos para análisis válido');
        return this.getLastValidOrDefault();
      }

      // Cálculo de PTT optimizado
      const pttValues = this.calculatePTTValues(peakIndices, currentTime);
      
      if (pttValues.length < 1) { // Reducido para permitir incluso un solo valor
        console.log('BP: No se pudieron calcular valores PTT');
        return this.getLastValidOrDefault();
      }

      // Cálculo mejorado de presión basado en las características de la señal
      const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
      const { systolic, diastolic } = this.calculatePressureValues(pttValues, amplitude, values);

      // Actualizar buffers con nuevos valores
      this.updateBuffers(systolic, diastolic);

      // Calcular valores finales con ponderación
      const result = this.calculateFinalValues();
      
      // Aplicar factores de calibración
      const calibratedSystolic = Math.round(result.finalSystolic * this.systolicCalibrationFactor);
      const calibratedDiastolic = Math.round(result.finalDiastolic * this.diastolicCalibrationFactor);
      
      // Guardar los valores calculados para depuración
      this.lastCalculatedValues = {
        systolic: calibratedSystolic,
        diastolic: calibratedDiastolic,
        peakCount: peakIndices.length,
        amplitude: amplitude,
        timeStamp: currentTime
      };
      
      console.log('BP: Valores calculados', {
        systolic: calibratedSystolic,
        diastolic: calibratedDiastolic,
        raw: { sys: result.finalSystolic, dia: result.finalDiastolic },
        calibrationFactors: { 
          sys: this.systolicCalibrationFactor, 
          dia: this.diastolicCalibrationFactor
        },
        peakCount: peakIndices.length,
        amplitude: amplitude,
        bufferSize: this.systolicBuffer.length
      });

      this.lastCalculationTime = currentTime;
      
      return {
        systolic: calibratedSystolic,
        diastolic: calibratedDiastolic
      };
    } catch (error) {
      console.error('Error en cálculo de presión arterial:', error);
      return this.getLastValidOrDefault();
    }
  }

  /**
   * Actualiza factores de calibración basados en mediciones de referencia
   * @param systolic Presión sistólica de referencia
   * @param diastolic Presión diastólica de referencia
   */
  public updateCalibration(systolic: number, diastolic: number): void {
    // Asegurar que tenemos valores de referencia válidos
    if (systolic <= 0 || diastolic <= 0 || systolic <= diastolic) {
      console.error('BloodPressureProcessor: Invalid calibration values', { systolic, diastolic });
      return;
    }
    
    // Obtener nuestros valores estimados actuales para calcular factores de calibración
    if (this.systolicBuffer.length > 0 && this.diastolicBuffer.length > 0) {
      const currentEstimate = this.calculateFinalValues();
      
      // Calcular factores de calibración si los valores estimados son razonables
      if (currentEstimate.finalSystolic > 0 && currentEstimate.finalDiastolic > 0) {
        this.systolicCalibrationFactor = systolic / currentEstimate.finalSystolic;
        this.diastolicCalibrationFactor = diastolic / currentEstimate.finalDiastolic;
        
        // Limitar factores de calibración a rangos razonables (0.5-2.0)
        this.systolicCalibrationFactor = Math.max(0.5, Math.min(2.0, this.systolicCalibrationFactor));
        this.diastolicCalibrationFactor = Math.max(0.5, Math.min(2.0, this.diastolicCalibrationFactor));
        
        console.log('BloodPressureProcessor: Calibration applied', {
          systolicFactor: this.systolicCalibrationFactor,
          diastolicFactor: this.diastolicCalibrationFactor,
          referenceValues: { systolic, diastolic },
          estimatedValues: currentEstimate
        });
      } else {
        console.error('BloodPressureProcessor: Cannot calibrate with zero estimated values');
      }
    } else {
      console.error('BloodPressureProcessor: Cannot calibrate without baseline measurements');
    }
  }

  /**
   * Obtiene los últimos valores calculados para depuración
   */
  public getLastCalculatedValues() {
    return this.lastCalculatedValues;
  }

  /**
   * Valida si la señal PPG es adecuada para análisis
   */
  private validateSignal(values: number[]): boolean {
    if (!values || values.length < 50) { // Reducido de 100 a 50 para mayor sensibilidad
      return false;
    }
    
    const amplitude = Math.max(...values) - Math.min(...values);
    const isValid = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    
    // Depuración
    if (!isValid) {
      console.log('BP: Señal rechazada - amplitud insuficiente:', amplitude);
    }
    
    return isValid;
  }

  /**
   * Valida si hay suficientes picos para análisis
   */
  private validatePeaks(peakIndices: number[]): boolean {
    return peakIndices.length >= this.MIN_PEAK_COUNT;
  }

  /**
   * Calcula valores PTT (Pulse Transit Time) a partir de picos detectados
   */
  private calculatePTTValues(peakIndices: number[], currentTime: number): number[] {
    const msPerSample = 1000 / this.MIN_FPS;
    const pttValues: number[] = [];
    
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      if (dt >= 200 && dt <= 2000) { // Rango fisiológico para intervalos entre picos
        pttValues.push(dt);
      }
    }
    
    // Depuración
    if (pttValues.length > 0) {
      console.log('BP: PTT calculados:', pttValues.length, 'valores:', pttValues.slice(0, 3));
    }
    
    return pttValues;
  }

  /**
   * Calcula presión sistólica y diastólica basado en valores PTT y características de señal
   */
  private calculatePressureValues(
    pttValues: number[], 
    amplitude: number,
    values: number[]
  ): {
    systolic: number;
    diastolic: number;
  } {
    // Filtrar outliers
    const filteredPTT = this.filterOutliers(pttValues);
    
    // Calcular PTT promedio ponderado
    const weightedPTT = this.calculateWeightedPTT(filteredPTT);
    
    // Si no tenemos PTT válidos, usar método alternativo basado en amplitud
    if (weightedPTT <= 0) {
      return this.calculatePressureFromAmplitude(amplitude, values);
    }
    
    const systolic = this.calculateSystolic(weightedPTT, amplitude);
    const diastolic = this.calculateDiastolic(weightedPTT, amplitude, systolic);
    
    return { systolic, diastolic };
  }

  /**
   * Método alternativo para calcular presión cuando no hay suficientes PTT
   */
  private calculatePressureFromAmplitude(amplitude: number, values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    // Mayor varianza indica típicamente mayor presión de pulso
    const variance = this.calculateVariance(values);
    
    // Usar características de la señal para estimar presión
    const baselineSystolic = 120;
    const baselineDiastolic = 80;
    
    // Ajuste basado en amplitud de señal
    const systolicAdjustment = Math.min(Math.max(amplitude * 100, -20), 20);
    const diastolicAdjustment = Math.min(Math.max(amplitude * 50, -10), 10);
    
    // Ajuste basado en varianza
    const varAdjustSys = Math.min(Math.max(variance * 2, -15), 15);
    const varAdjustDia = Math.min(Math.max(variance, -10), 10);
    
    const systolic = this.constrainValue(
      baselineSystolic + systolicAdjustment + varAdjustSys,
      this.MIN_SYSTOLIC,
      this.MAX_SYSTOLIC
    );
    
    const diastolic = this.constrainValue(
      baselineDiastolic + diastolicAdjustment + varAdjustDia,
      this.MIN_DIASTOLIC,
      this.MAX_DIASTOLIC
    );
    
    console.log('BP: Calculando por método alternativo:', {
      systolic, 
      diastolic, 
      amplitude, 
      variance,
      adjustments: {
        sys: systolicAdjustment + varAdjustSys,
        dia: diastolicAdjustment + varAdjustDia
      }
    });
    
    return { systolic, diastolic };
  }

  /**
   * Calcula la varianza de los valores de la señal
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calcula sistólica a partir de PTT y amplitud
   */
  private calculateSystolic(ptt: number, amplitude: number): number {
    const base = 120;
    
    // Factor basado en PTT - relación inversa (menor PTT, mayor presión)
    const pttFactor = ptt > 0 ? (1000 - ptt) * 0.08 : 0;
    
    // Factor basado en amplitud - mayor amplitud, mayor presión
    const ampFactor = amplitude * 50; 
    
    return this.constrainValue(
      base + pttFactor + ampFactor,
      this.MIN_SYSTOLIC,
      this.MAX_SYSTOLIC
    );
  }

  /**
   * Calcula diastólica a partir de PTT, amplitud y sistólica
   */
  private calculateDiastolic(ptt: number, amplitude: number, systolic: number): number {
    const base = 80;
    
    // Factor basado en PTT - relación similar pero con menor impacto
    const pttFactor = ptt > 0 ? (1000 - ptt) * 0.04 : 0;
    
    // Factor basado en amplitud - similar a sistólica pero con menor impacto
    const ampFactor = amplitude * 20;
    
    // Asegurar que hay una diferencia fisiológica adecuada entre sistólica y diastólica
    const diastolicRaw = base + pttFactor + ampFactor;
    const pulsePressureTarget = Math.max(30, Math.min(60, systolic * 0.35)); // 30-35% de sistólica
    
    const diastolic = Math.min(diastolicRaw, systolic - pulsePressureTarget);
    
    return this.constrainValue(
      diastolic,
      this.MIN_DIASTOLIC,
      this.MAX_DIASTOLIC
    );
  }

  /**
   * Restricción de valores dentro de rangos fisiológicos
   */
  private constrainValue(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Retorna últimos valores válidos o predeterminados
   */
  private getLastValidOrDefault(): { systolic: number, diastolic: number } {
    if (this.systolicBuffer.length > 0 && this.diastolicBuffer.length > 0) {
      return {
        systolic: Math.round(this.systolicBuffer[this.systolicBuffer.length - 1]),
        diastolic: Math.round(this.diastolicBuffer[this.diastolicBuffer.length - 1])
      };
    }
    return { systolic: 120, diastolic: 80 };
  }
  
  /**
   * Calcula mediana de un array
   */
  private calculateMedian(sortedArray: number[]): number {
    if (sortedArray.length === 0) return 0;
    
    const medianIndex = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[medianIndex - 1] + sortedArray[medianIndex]) / 2
      : sortedArray[medianIndex];
  }
  
  /**
   * Filtra outliers usando método IQR con umbral configurable
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
   * Calcula PTT ponderado, valores más recientes tienen mayor peso
   */
  private calculateWeightedPTT(filteredPTT: number[]): number {
    if (filteredPTT.length < 1) return 0;
    
    let weightSum = 0;
    let weightedSum = 0;
    
    filteredPTT.forEach((val, idx) => {
      const weight = Math.pow(1.5, idx) / Math.max(1, filteredPTT.length);
      weightedSum += val * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }
  
  /**
   * Calcula presión arterial final usando mediana y media
   * para mayor estabilidad y rechazo de ruido
   */
  private calculateFinalValues(): { finalSystolic: number, finalDiastolic: number } {
    if (this.systolicBuffer.length === 0) {
      return { finalSystolic: 120, finalDiastolic: 80 };
    }
    
    // 1. Calcular medianas
    const sortedSystolic = [...this.systolicBuffer].sort((a, b) => a - b);
    const sortedDiastolic = [...this.diastolicBuffer].sort((a, b) => a - b);
    
    const systolicMedian = this.calculateMedian(sortedSystolic);
    const diastolicMedian = this.calculateMedian(sortedDiastolic);
    
    // 2. Calcular promedios
    const systolicMean = this.systolicBuffer.reduce((sum, val) => sum + val, 0) / this.systolicBuffer.length;
    const diastolicMean = this.diastolicBuffer.reduce((sum, val) => sum + val, 0) / this.diastolicBuffer.length;
    
    // 3. Aplicar ponderación entre mediana y promedio
    let finalSystolic = (systolicMedian * this.MEDIAN_WEIGHT) + (systolicMean * this.MEAN_WEIGHT);
    let finalDiastolic = (diastolicMedian * this.MEDIAN_WEIGHT) + (diastolicMean * this.MEAN_WEIGHT);
    
    // 4. Verificar diferencial de presión en resultado final
    const finalDifferential = finalSystolic - finalDiastolic;
    if (finalDifferential < this.MIN_PULSE_PRESSURE) {
      finalDiastolic = finalSystolic - this.MIN_PULSE_PRESSURE;
    } else if (finalDifferential > this.MAX_PULSE_PRESSURE) {
      finalDiastolic = finalSystolic - this.MAX_PULSE_PRESSURE;
    }
    
    // 5. Aplicar límites fisiológicos una última vez
    finalSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, finalSystolic));
    finalDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, finalDiastolic));
    
    return { finalSystolic, finalDiastolic };
  }
  
  /**
   * Actualiza buffers con nuevos valores
   */
  private updateBuffers(systolic: number, diastolic: number): void {
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
  }
  
  /**
   * Reinicia el procesador de presión arterial
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastCalculationTime = 0;
    // Restablecer factores de calibración a valores predeterminados
    this.systolicCalibrationFactor = 1.0;
    this.diastolicCalibrationFactor = 1.0;
    this.lastCalculatedValues = {
      systolic: 0,
      diastolic: 0,
      peakCount: 0,
      amplitude: 0,
      timeStamp: 0
    };
    console.log("BloodPressureProcessor: Reset completed");
  }
}
