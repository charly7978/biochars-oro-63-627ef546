
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsResult } from '../VitalSignsProcessor';

export interface MeasurementValidationResult {
  isValid: boolean;
  confidence: number;
  measuredValues: VitalSignsResult;
}

export interface CrossValidationConfig {
  minSamplesRequired: number;
  maxDeviation: {
    heartRate: number;
    spo2: number;
    systolic: number;
    diastolic: number;
  };
  minConfidenceThreshold: number;
}

export class CrossValidator {
  private config: CrossValidationConfig;
  private historicalMeasurements: VitalSignsResult[] = [];
  
  /**
   * Constructor para el validador cruzado
   */
  constructor(config?: Partial<CrossValidationConfig>) {
    this.config = {
      minSamplesRequired: 3,
      maxDeviation: {
        heartRate: 10,  // 10 BPM
        spo2: 3,        // 3%
        systolic: 15,   // 15 mmHg
        diastolic: 10   // 10 mmHg
      },
      minConfidenceThreshold: 0.7,
      ...config
    };
  }
  
  /**
   * Añadir una nueva medición para validación cruzada
   */
  public addMeasurement(measurement: VitalSignsResult): void {
    this.historicalMeasurements.push(measurement);
    
    // Limitar el histórico a las últimas 5 mediciones
    if (this.historicalMeasurements.length > 5) {
      this.historicalMeasurements.shift();
    }
  }
  
  /**
   * Validar una medición contra el histórico
   */
  public validateMeasurement(current: VitalSignsResult): MeasurementValidationResult {
    // Si no tenemos suficientes muestras previas, consideramos la medición válida
    if (this.historicalMeasurements.length < this.config.minSamplesRequired) {
      return {
        isValid: true,
        confidence: 0.5, // Confianza media por falta de datos históricos
        measuredValues: current
      };
    }
    
    // Extraer métricas para comparación
    const metrics = this.extractMetricsFromResults();
    
    // Calcular desviaciones de la medición actual respecto a las históricas
    const deviations = this.calculateDeviations(current, metrics);
    
    // Calcular puntuación de confianza
    const confidenceScore = this.calculateConfidenceScore(deviations);
    
    // Determinar si la medición es válida
    const isValid = confidenceScore >= this.config.minConfidenceThreshold;
    
    // Aplicar correcciones a valores fuera de rango
    const validatedMeasurement = isValid ? 
                               current : 
                               this.correctOutlierValues(current, metrics);
    
    return {
      isValid,
      confidence: confidenceScore,
      measuredValues: validatedMeasurement
    };
  }
  
  /**
   * Extraer métricas de los resultados históricos
   */
  private extractMetricsFromResults(): { 
    heartRates: number[], 
    spo2s: number[], 
    systolics: number[], 
    diastolics: number[] 
  } {
    const heartRates: number[] = [];
    const spo2s: number[] = [];
    const systolics: number[] = [];
    const diastolics: number[] = [];
    
    this.historicalMeasurements.forEach(result => {
      // Procesar frecuencia cardíaca
      const bpm = result.bpm || result.heartRate;
      if (typeof bpm === 'number' && bpm > 30 && bpm < 200) {
        heartRates.push(bpm);
      }
      
      // Procesar SpO2
      if (typeof result.spo2 === 'number' && result.spo2 >= 80 && result.spo2 <= 100) {
        spo2s.push(result.spo2);
      }
      
      // Procesar presión arterial
      if (result.pressure && result.pressure !== "--/--") {
        const [systolic, diastolic] = result.pressure.split('/').map(Number);
        if (systolic > 70 && systolic < 200) systolics.push(systolic);
        if (diastolic > 40 && diastolic < 120) diastolics.push(diastolic);
      }
    });
    
    return { heartRates, spo2s, systolics, diastolics };
  }
  
  /**
   * Calcular desviaciones de la medición actual respecto a las históricas
   */
  private calculateDeviations(
    current: VitalSignsResult, 
    metrics: { 
      heartRates: number[], 
      spo2s: number[], 
      systolics: number[], 
      diastolics: number[] 
    }
  ): { 
    heartRate: number, 
    spo2: number, 
    systolic: number, 
    diastolic: number 
  } {
    // Calcular medianas para cada métrica
    const medianHeartRate = this.calculateMedian(metrics.heartRates);
    const medianSpo2 = this.calculateMedian(metrics.spo2s);
    const medianSystolic = this.calculateMedian(metrics.systolics);
    const medianDiastolic = this.calculateMedian(metrics.diastolics);
    
    // Extraer valores actuales
    const currentBpm = current.bpm || current.heartRate || 0;
    const currentSpo2 = current.spo2 || 0;
    
    let currentSystolic = 0;
    let currentDiastolic = 0;
    if (current.pressure && current.pressure !== "--/--") {
      const [systolic, diastolic] = current.pressure.split('/').map(Number);
      currentSystolic = systolic;
      currentDiastolic = diastolic;
    }
    
    // Calcular desviaciones absolutas
    return {
      heartRate: medianHeartRate ? Math.abs(currentBpm - medianHeartRate) : 0,
      spo2: medianSpo2 ? Math.abs(currentSpo2 - medianSpo2) : 0,
      systolic: medianSystolic ? Math.abs(currentSystolic - medianSystolic) : 0,
      diastolic: medianDiastolic ? Math.abs(currentDiastolic - medianDiastolic) : 0
    };
  }
  
  /**
   * Calcular puntuación de confianza basada en desviaciones
   */
  private calculateConfidenceScore(deviations: { 
    heartRate: number, 
    spo2: number, 
    systolic: number, 
    diastolic: number 
  }): number {
    // Normalizar cada desviación respecto a su máximo permitido
    const heartRateScore = 1 - Math.min(1, deviations.heartRate / this.config.maxDeviation.heartRate);
    const spo2Score = 1 - Math.min(1, deviations.spo2 / this.config.maxDeviation.spo2);
    const systolicScore = deviations.systolic > 0 ? 
                       1 - Math.min(1, deviations.systolic / this.config.maxDeviation.systolic) : 1;
    const diastolicScore = deviations.diastolic > 0 ? 
                        1 - Math.min(1, deviations.diastolic / this.config.maxDeviation.diastolic) : 1;
    
    // Calcular puntuación ponderada
    // Damos más peso a frecuencia cardíaca y SpO2 que son más estables
    const weightedScore = (
      heartRateScore * 0.4 + 
      spo2Score * 0.3 + 
      systolicScore * 0.15 + 
      diastolicScore * 0.15
    );
    
    return weightedScore;
  }
  
  /**
   * Corregir valores fuera de rango con medianas históricas
   */
  private correctOutlierValues(
    measurement: VitalSignsResult, 
    metrics: { 
      heartRates: number[], 
      spo2s: number[], 
      systolics: number[], 
      diastolics: number[] 
    }
  ): VitalSignsResult {
    const corrected = {...measurement};
    
    // Calcular medianas
    const medianHeartRate = this.calculateMedian(metrics.heartRates);
    const medianSpo2 = this.calculateMedian(metrics.spo2s);
    const medianSystolic = this.calculateMedian(metrics.systolics);
    const medianDiastolic = this.calculateMedian(metrics.diastolics);
    
    // Corregir frecuencia cardíaca si está fuera de rango
    const currentBpm = measurement.bpm || measurement.heartRate || 0;
    if (medianHeartRate && Math.abs(currentBpm - medianHeartRate) > this.config.maxDeviation.heartRate) {
      if ("bpm" in corrected) corrected.bpm = medianHeartRate;
      if ("heartRate" in corrected) corrected.heartRate = medianHeartRate;
    }
    
    // Corregir SpO2 si está fuera de rango
    if (medianSpo2 && Math.abs(measurement.spo2 - medianSpo2) > this.config.maxDeviation.spo2) {
      corrected.spo2 = medianSpo2;
    }
    
    // Corregir presión arterial si está fuera de rango
    if (measurement.pressure && measurement.pressure !== "--/--") {
      let [systolic, diastolic] = measurement.pressure.split('/').map(Number);
      let needsCorrection = false;
      
      if (medianSystolic && Math.abs(systolic - medianSystolic) > this.config.maxDeviation.systolic) {
        systolic = medianSystolic;
        needsCorrection = true;
      }
      
      if (medianDiastolic && Math.abs(diastolic - medianDiastolic) > this.config.maxDeviation.diastolic) {
        diastolic = medianDiastolic;
        needsCorrection = true;
      }
      
      if (needsCorrection) {
        corrected.pressure = `${systolic}/${diastolic}`;
      }
    }
    
    return corrected;
  }
  
  /**
   * Calcular la mediana de un array de números
   */
  private calculateMedian(values: number[]): number | null {
    if (!values.length) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }
  
  /**
   * Reiniciar el validador
   */
  public reset(): void {
    this.historicalMeasurements = [];
  }
}

/**
 * Función utilitaria para validar un valor está en un rango fisiológico
 * @param value Valor a validar
 * @param min Mínimo fisiológico
 * @param max Máximo fisiológico
 * @param fallback Valor predeterminado si está fuera de rango
 */
export function validatePhysiologicalValue(
  value: number, 
  min: number, 
  max: number, 
  fallback?: number
): number {
  if (value >= min && value <= max) {
    return value;
  }
  
  return fallback !== undefined ? fallback : (min + max) / 2;
}
