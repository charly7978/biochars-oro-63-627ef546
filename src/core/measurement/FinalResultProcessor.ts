/**
 * Procesador de resultados finales para mediciones vitales
 * 
 * Aplica técnicas estadísticas robustas (mediana, promedio ponderado) a las
 * mediciones antes de mostrar el resultado final al usuario, mejorando
 * significativamente la estabilidad y precisión de las métricas reportadas.
 */
import { antiRedundancyGuard } from 'src/core/validation/CrossValidationSystem';
import { calculateMedian, calculateStandardDeviation } from '@/modules/vital-signs/utils/signal-processing-utils';

export class FinalResultProcessor {
  // Almacenamiento de mediciones para cada tipo
  private measurements: Record<string, {
    values: number[],
    timestamps: number[],
    qualities: number[]
  }> = {
    heartRate: { values: [], timestamps: [], qualities: [] },
    spo2: { values: [], timestamps: [], qualities: [] },
    systolic: { values: [], timestamps: [], qualities: [] },
    diastolic: { values: [], timestamps: [], qualities: [] },
    glucose: { values: [], timestamps: [], qualities: [] },
    hemoglobin: { values: [], timestamps: [], qualities: [] }
  };
  
  // Configuración
  private readonly MAX_HISTORY_SIZE = 30;  // Máximo número de valores a almacenar
  private readonly MIN_SAMPLES_REQUIRED = 5;  // Mínimo para cálculos estadísticos
  private readonly RECENT_WEIGHT_MULTIPLIER = 1.5;  // Peso extra para valores recientes
  private readonly QUALITY_THRESHOLD = 65;  // Calidad mínima para considerar valores
  
  /**
   * Añade un nuevo valor de medición
   */
  public addMeasurement(type: string, value: number, quality: number): void {
    if (!this.measurements[type]) {
      this.measurements[type] = { values: [], timestamps: [], qualities: [] };
    }
    
    // Añadir nueva medición
    this.measurements[type].values.push(value);
    this.measurements[type].timestamps.push(Date.now());
    this.measurements[type].qualities.push(quality);
    
    // Mantener tamaño limitado
    if (this.measurements[type].values.length > this.MAX_HISTORY_SIZE) {
      this.measurements[type].values.shift();
      this.measurements[type].timestamps.shift();
      this.measurements[type].qualities.shift();
    }
  }
  
  /**
   * Obtiene el resultado final procesado para una medición
   */
  public getFinalResult(type: string): {
    value: number, 
    confidence: number, 
    method: string,
    rawStats: {
      median: number,
      mean: number,
      weightedMean: number,
      stdDev: number,
      sampleCount: number
    }
  } {
    if (!this.measurements[type] || this.measurements[type].values.length < this.MIN_SAMPLES_REQUIRED) {
      // Si no hay suficientes muestras, devolver último valor o valor por defecto
      const defaultValue = this.getDefaultValue(type);
      const lastValue = this.measurements[type]?.values.length > 0 
        ? this.measurements[type].values[this.measurements[type].values.length - 1] 
        : defaultValue;
      
      return {
        value: lastValue,
        confidence: 0.6,
        method: "last_value",
        rawStats: {
          median: lastValue,
          mean: lastValue,
          weightedMean: lastValue,
          stdDev: 0,
          sampleCount: this.measurements[type]?.values.length || 0
        }
      };
    }
    
    // Filtrar valores por calidad
    const filteredIndices = this.measurements[type].qualities
      .map((q, i) => q >= this.QUALITY_THRESHOLD ? i : -1)
      .filter(i => i !== -1);
    
    const filteredValues = filteredIndices.map(i => this.measurements[type].values[i]);
    const filteredTimestamps = filteredIndices.map(i => this.measurements[type].timestamps[i]);
    const filteredQualities = filteredIndices.map(i => this.measurements[type].qualities[i]);
    
    // Si no quedan suficientes valores de alta calidad, usar todos
    let valuesToUse = filteredValues.length >= this.MIN_SAMPLES_REQUIRED 
      ? filteredValues 
      : this.measurements[type].values;
    
    let timestampsToUse = filteredValues.length >= this.MIN_SAMPLES_REQUIRED 
      ? filteredTimestamps 
      : this.measurements[type].timestamps;
    
    let qualitiesToUse = filteredValues.length >= this.MIN_SAMPLES_REQUIRED 
      ? filteredQualities 
      : this.measurements[type].qualities;
    
    // Calcular estadísticas
    const stats = this.calculateStatistics(valuesToUse, timestampsToUse, qualitiesToUse);
    
    // Determinar qué método usar para el valor final
    const { value, confidence, method } = this.selectBestResult(type, stats);
    
    return {
      value,
      confidence,
      method,
      rawStats: stats
    };
  }
  
  /**
   * Calcula estadísticas para un conjunto de valores
   */
  private calculateStatistics(
    values: number[], 
    timestamps: number[], 
    qualities: number[]
  ): {
    median: number,
    mean: number,
    weightedMean: number,
    stdDev: number,
    sampleCount: number
  } {
    // Calcular mediana
    const median = calculateMedian(values);
    // Calcular media
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    // Calcular desviación estándar
    const stdDev = calculateStandardDeviation(values);
    // Calcular media ponderada basada en tiempo y calidad
    const now = Date.now();
    const maxTimeDiff = Math.max(...timestamps.map(t => now - t));
    const weights = values.map((_, i) => {
      // Factor de tiempo: más reciente = mayor peso
      const timeFactor = 1 - ((now - timestamps[i]) / maxTimeDiff) * 0.5;
      // Factor de calidad: mejor calidad = mayor peso
      const qualityFactor = qualities[i] / 100;
      // Peso combinado
      return timeFactor * qualityFactor * (i >= values.length - 3 ? this.RECENT_WEIGHT_MULTIPLIER : 1);
    });
    // Normalizar pesos
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);
    // Calcular media ponderada
    const weightedMean = values.reduce((sum, v, i) => sum + v * normalizedWeights[i], 0);
    return {
      median,
      mean,
      weightedMean,
      stdDev,
      sampleCount: values.length
    };
  }
  
  /**
   * Selecciona el mejor método para el resultado final
   */
  private selectBestResult(
    type: string, 
    stats: {
      median: number,
      mean: number,
      weightedMean: number,
      stdDev: number,
      sampleCount: number
    }
  ): { value: number, confidence: number, method: string } {
    // Coeficiente de variación (normalizado)
    const cv = stats.stdDev / (stats.mean || 1);
    // Si hay alta variabilidad, preferir la mediana (más robusta a outliers)
    if (cv > 0.15) {
      return {
        value: this.applyRangeConstraints(type, stats.median),
        confidence: Math.max(0.5, 1 - cv), // Solo basado en variabilidad real
        method: "median"
      };
    }
    // Si hay baja variabilidad, preferir promedio ponderado (más precisión)
    return {
      value: this.applyRangeConstraints(type, stats.weightedMean),
      confidence: Math.max(0.5, 1 - cv), // Solo basado en variabilidad real
      method: "weighted_mean"
    };
  }
  
  /**
   * Aplica restricciones de rango fisiológico a los valores
   */
  private applyRangeConstraints(type: string, value: number): number {
    switch (type) {
      case 'heartRate':
        return Math.max(40, Math.min(200, value));
      case 'spo2':
        return Math.max(85, Math.min(100, value));
      case 'systolic':
        return Math.max(90, Math.min(180, value));
      case 'diastolic':
        return Math.max(50, Math.min(110, value));
      case 'glucose':
        return Math.max(70, Math.min(200, value));
      case 'hemoglobin':
        return Math.max(8, Math.min(20, value));
      default:
        return value;
    }
  }
  
  /**
   * Obtiene un valor por defecto para cada tipo de medición
   */
  private getDefaultValue(type: string): number {
    // Prohibido: No se permiten valores por defecto ni simulados
    return 0;
  }
  
  /**
   * Limpia el historial de mediciones
   */
  public clear(type?: string): void {
    if (type) {
      if (this.measurements[type]) {
        this.measurements[type] = { values: [], timestamps: [], qualities: [] };
      }
    } else {
      // Limpiar todos los tipos
      Object.keys(this.measurements).forEach(key => {
        this.measurements[key] = { values: [], timestamps: [], qualities: [] };
      });
    }
  }
}

// Registrar el archivo y la tarea única globalmente (fuera de la clase)
antiRedundancyGuard.registerFile('src/core/measurement/FinalResultProcessor.ts');
antiRedundancyGuard.registerTask('FinalResultProcessorSingleton');

/**
 * Instancia singleton para uso global
 */
export const finalResultProcessor = new FinalResultProcessor();
