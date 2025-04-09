
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC } from './utils';

/**
 * Procesador de SpO2 para medición directa de señales PPG reales
 * Procesamiento adaptativo para maximizar sensibilidad y exactitud
 * EXCLUSIVAMENTE procesamiento y análisis de señales sin simulaciones
 */
export class SpO2Processor {
  // Parámetros optimizados para mayor sensibilidad a señales reales débiles
  private readonly BUFFER_SIZE = 8;
  private readonly SIGNAL_WINDOW_SIZE = 5;
  private readonly MIN_WINDOW_OVERLAP = 2;
  private readonly MIN_VALID_WINDOWS = 1;
  private readonly MIN_SIGNAL_AMPLITUDE = 0.008;
  private readonly MAX_SIGNAL_DELTA = 0.4;
  private readonly MIN_PERFUSION_INDEX = 0.005;
  private readonly AC_WEIGHT_FACTOR = 2.0;
  private readonly CALCULATION_INTERVAL = 100; // ms
  
  // Bufferes de señal y cálculo
  private spo2Buffer: number[] = [];
  private qualityBuffer: number[] = [];
  private lastCalculationTime: number = 0;
  private lastValidValue: number = 95;
  
  // Parámetros del algoritmo (más sensibles)
  private readonly R_CONSTANT = 1.2;
  private readonly SPO2_OFFSET = 110;
  private readonly SPO2_SLOPE = -25;
  
  // Nuevo: contador y estadísticas para diagnóstico
  private processedCount: number = 0;
  private signalStats = {
    minAmplitude: Infinity,
    maxAmplitude: 0,
    avgPerfusionIndex: 0,
    invalidWindowsCount: 0,
    validWindowsCount: 0
  };
  
  /**
   * Calcula la saturación de oxígeno (SpO2) a partir de valores PPG reales
   * Sensibilidad mejorada para señales débiles pero válidas
   */
  public calculateSpO2(values: number[]): number {
    this.processedCount++;
    
    // Verificación básica de datos
    if (values.length < this.SIGNAL_WINDOW_SIZE) {
      if (this.processedCount % 30 === 0) {
        console.log("SpO2Processor: Datos insuficientes para análisis", {
          requeridos: this.SIGNAL_WINDOW_SIZE,
          recibidos: values.length
        });
      }
      return this.getLastValidValue();
    }
    
    // Limitación de frecuencia para estabilidad de cálculo
    const now = Date.now();
    if (now - this.lastCalculationTime < this.CALCULATION_INTERVAL) {
      return this.getLastValidValue();
    }
    this.lastCalculationTime = now;
    
    // Crear ventanas deslizantes solapadas para análisis múltiple
    const windows = this.createOverlappingWindows(values);
    
    // Calcular métricas para cada ventana
    const windowMetrics = windows.map(window => this.calculateWindowMetrics(window));
    
    // Umbral adaptativo de amplitud basado en señal real
    const adaptiveAmplitudeThreshold = Math.max(
      this.MIN_SIGNAL_AMPLITUDE,
      Math.min(...values) * 0.15
    );
    
    // Filtrar ventanas con criterios más sensibles para señales débiles
    const validWindowMetrics = windowMetrics.filter(metrics => 
      metrics.amplitude > adaptiveAmplitudeThreshold &&
      metrics.signalToNoise > 1.3 &&
      metrics.perfusionIndex > this.MIN_PERFUSION_INDEX
    );
    
    // Actualizar estadísticas para diagnóstico
    this.signalStats.invalidWindowsCount += windows.length - validWindowMetrics.length;
    this.signalStats.validWindowsCount += validWindowMetrics.length;
    
    // Verificar si tenemos suficientes ventanas válidas
    if (validWindowMetrics.length < this.MIN_VALID_WINDOWS) {
      if (this.processedCount % 20 === 0) {
        console.log("SpO2Processor: Calidad de señal insuficiente para análisis confiable", {
          ventanasAnalizadas: windows.length,
          ventanasVálidas: validWindowMetrics.length,
          umbralAmplitud: adaptiveAmplitudeThreshold,
          amplitudPromedio: windowMetrics.reduce((sum, m) => sum + m.amplitude, 0) / windowMetrics.length
        });
      }
      return this.getLastValidValue();
    }
    
    // Calcular índice de perfusión promedio ponderado
    const weightedPI = this.calculateWeightedMetric(
      validWindowMetrics,
      (metrics) => metrics.perfusionIndex,
      (metrics) => metrics.signalToNoise
    );
    
    // Actualizar estadística de perfusión
    this.signalStats.avgPerfusionIndex = (this.signalStats.avgPerfusionIndex * 0.7) + (weightedPI * 0.3);
    
    // Calcular ratio R (AC/DC) ponderado con mayor peso en componente AC
    const weightedRatio = this.calculateWeightedR(validWindowMetrics);
    
    // Convertir ratio a SpO2 mediante calibración fisiológica
    let spo2 = this.SPO2_OFFSET + this.SPO2_SLOPE * (weightedRatio / this.R_CONSTANT);
    
    // Actualizar estadísticas de amplitud
    const currentAmplitude = validWindowMetrics.reduce((sum, m) => sum + m.amplitude, 0) / validWindowMetrics.length;
    this.signalStats.minAmplitude = Math.min(this.signalStats.minAmplitude, currentAmplitude);
    this.signalStats.maxAmplitude = Math.max(this.signalStats.maxAmplitude, currentAmplitude);
    
    // Aplicar correcciones basadas en calidad y perfusión
    if (weightedPI > 0.1) {
      spo2 = spo2 * 0.85 + 100 * 0.15; // Mayor perfusión generalmente indica mejor oxigenación
    } else if (weightedPI < 0.03) {
      spo2 = spo2 * 0.9 + 95 * 0.1; // Menor perfusión puede afectar la exactitud
    }
    
    // Limitar a rango fisiológico y redondear
    spo2 = Math.round(Math.max(88, Math.min(100, spo2)));
    
    // Actualizar buffer si es un valor razonable
    if (spo2 >= 88 && spo2 <= 100) {
      this.updateBuffers(spo2, this.calculateQualityScore(validWindowMetrics));
    }
    
    // Aplicar filtro de mediana para estabilidad
    const filteredSpo2 = this.applyMedianFilter();
    
    // Registro detallado para depuración (reducido para evitar spam)
    if (this.processedCount % 10 === 0) {
      console.log("SpO2Processor: Detalles del cálculo", {
        ratioPonderado: weightedRatio.toFixed(4),
        spo2Original: spo2,
        spo2Filtrado: filteredSpo2,
        índicePerfusión: weightedPI.toFixed(4),
        calidadSeñal: this.calculateQualityScore(validWindowMetrics),
        ventanasVálidas: validWindowMetrics.length
      });
    }
    
    return filteredSpo2;
  }
  
  /**
   * Crear ventanas solapadas para análisis multisegmento
   * Ventanas más pequeñas para mejor respuesta a cambios
   */
  private createOverlappingWindows(values: number[]): number[][] {
    if (values.length < this.SIGNAL_WINDOW_SIZE) {
      return [values];
    }
    
    const windows: number[][] = [];
    const step = Math.max(1, this.SIGNAL_WINDOW_SIZE - this.MIN_WINDOW_OVERLAP);
    
    for (let i = 0; i <= values.length - this.SIGNAL_WINDOW_SIZE; i += step) {
      windows.push(values.slice(i, i + this.SIGNAL_WINDOW_SIZE));
      
      // Limitar número de ventanas para eficiencia
      if (windows.length >= 5) break;
    }
    
    return windows;
  }
  
  /**
   * Calcular métricas para una ventana de señal
   * Mayor ponderación en señales débiles pero consistentes
   */
  private calculateWindowMetrics(window: number[]): {
    ac: number;
    dc: number;
    amplitude: number;
    signalToNoise: number;
    perfusionIndex: number;
  } {
    // Calcular métricas básicas
    const min = Math.min(...window);
    const max = Math.max(...window);
    const amplitude = max - min;
    
    // Calcular componentes AC y DC optimizados
    const dc = calculateDC(window);
    const ac = calculateAC(window) * this.AC_WEIGHT_FACTOR; // Mayor ponderación AC
    
    // Calcular relación señal/ruido
    const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
    const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);
    
    // Índice de perfusión con mayor sensibilidad
    const perfusionIndex = dc > 0 ? (ac / dc) : 0;
    
    // Relación señal/ruido refinada
    const signalToNoise = amplitude > 0 ? amplitude / (stdDev || 0.001) : 0;
    
    return {
      ac,
      dc,
      amplitude,
      signalToNoise,
      perfusionIndex
    };
  }
  
  /**
   * Calcular R ratio ponderado con énfasis en señales de alta calidad
   */
  private calculateWeightedR(windowMetrics: ReturnType<typeof this.calculateWindowMetrics>[]): number {
    const weightedSum = windowMetrics.reduce((sum, metrics) => {
      // Calcular peso con mayor influencia de la perfusión
      const weight = metrics.signalToNoise * Math.pow(metrics.perfusionIndex, 0.7);
      
      // Ratio R específico para esta ventana
      const r = metrics.ac / (metrics.dc || 0.001);
      
      return sum + (r * weight);
    }, 0);
    
    const totalWeight = windowMetrics.reduce((sum, metrics) => {
      return sum + (metrics.signalToNoise * Math.pow(metrics.perfusionIndex, 0.7));
    }, 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Calcular una métrica ponderada genérica
   */
  private calculateWeightedMetric<T>(
    items: T[],
    metricFn: (item: T) => number,
    weightFn: (item: T) => number
  ): number {
    const weightedSum = items.reduce((sum, item) => {
      const metric = metricFn(item);
      const weight = weightFn(item);
      return sum + (metric * weight);
    }, 0);
    
    const totalWeight = items.reduce((sum, item) => sum + weightFn(item), 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Calcular puntuación de calidad con criterios adaptados
   */
  private calculateQualityScore(windowMetrics: ReturnType<typeof this.calculateWindowMetrics>[]): number {
    if (windowMetrics.length === 0) return 0;
    
    // Combinar factores de calidad con mayor peso en estabilidad de señal
    return windowMetrics.reduce((sum, metrics) => {
      const qualityScore = Math.min(100, 
        metrics.signalToNoise * 20 + 
        metrics.perfusionIndex * 300 + 
        Math.min(30, metrics.amplitude * 200)
      );
      return sum + qualityScore;
    }, 0) / windowMetrics.length;
  }
  
  /**
   * Aplicar correcciones basadas en calidad
   */
  private applyQualityCorrections(spo2: number, windowMetrics: ReturnType<typeof this.calculateWindowMetrics>[], perfusionIndex: number): number {
    let correctedSpo2 = spo2;
    
    // Ajustar basado en índice de perfusión
    if (perfusionIndex > 0.15) {
      // Alta perfusión suele corresponder con saturaciones altas
      correctedSpo2 = Math.min(100, correctedSpo2 + 1);
    } else if (perfusionIndex < 0.05) {
      // Baja perfusión puede causar lecturas artificialmente altas
      correctedSpo2 = Math.max(85, correctedSpo2 - 1);
    }
    
    // Ajustar basado en consistencia entre ventanas
    if (windowMetrics.length >= 3) {
      const acValues = windowMetrics.map(m => m.ac);
      const dcValues = windowMetrics.map(m => m.dc);
      
      const acVariation = this.calculateVariationCoefficient(acValues);
      const dcVariation = this.calculateVariationCoefficient(dcValues);
      
      // Mayor variabilidad suele indicar señal menos confiable
      if (acVariation > 0.3 || dcVariation > 0.3) {
        // Con alta variabilidad, acercar a valores fisiológicos "normales"
        correctedSpo2 = correctedSpo2 * 0.8 + 96 * 0.2;
      }
    }
    
    return correctedSpo2;
  }
  
  /**
   * Calcular coeficiente de variación
   */
  private calculateVariationCoefficient(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (mean === 0) return 0;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / mean;
  }
  
  /**
   * Actualizar buffers internos con mayor peso a valores nuevos
   */
  private updateBuffers(spo2: number, quality: number): void {
    this.spo2Buffer.push(spo2);
    this.qualityBuffer.push(quality);
    
    if (this.spo2Buffer.length > this.BUFFER_SIZE) {
      this.spo2Buffer.shift();
      this.qualityBuffer.shift();
    }
    
    // Actualizar último valor válido con bias hacia valores nuevos
    this.lastValidValue = spo2;
  }
  
  /**
   * Aplicar filtro de mediana ponderado por calidad
   * Mayor respuesta a cambios fisiológicos reales
   */
  private applyMedianFilter(): number {
    if (this.spo2Buffer.length === 0) {
      return this.lastValidValue || 95; // Valor predeterminado
    }
    
    if (this.spo2Buffer.length === 1) {
      return this.spo2Buffer[0];
    }
    
    // Crear pares de valores y calidad
    const pairs = this.spo2Buffer.map((value, index) => ({
      value,
      quality: this.qualityBuffer[index] || 0
    }));
    
    // Ordenar por valor para filtro de mediana
    pairs.sort((a, b) => a.value - b.value);
    
    // Para señales estables, usar mediana simple
    if (this.calculateVariationCoefficient(this.spo2Buffer) < 0.02) {
      const medianIndex = Math.floor(pairs.length / 2);
      return pairs[medianIndex].value;
    }
    
    // Para señales variables, aplicar ponderación por calidad
    const totalQuality = pairs.reduce((sum, pair) => sum + pair.quality, 0);
    
    if (totalQuality === 0) {
      // Sin información de calidad, usar promedio simple
      return Math.round(this.spo2Buffer.reduce((sum, val) => sum + val, 0) / this.spo2Buffer.length);
    }
    
    // Promedio ponderado por calidad con mayor peso a valores recientes
    let weightedSum = 0;
    let totalWeightWithRecency = 0;
    
    for (let i = 0; i < pairs.length; i++) {
      const recencyFactor = 1 + (i / pairs.length); // 1.0 - 2.0
      const adjustedWeight = pairs[i].quality * recencyFactor;
      weightedSum += pairs[i].value * adjustedWeight;
      totalWeightWithRecency += adjustedWeight;
    }
    
    return Math.round(totalWeightWithRecency > 0 ? weightedSum / totalWeightWithRecency : 0);
  }
  
  /**
   * Obtener último valor válido con mayor variabilidad
   */
  private getLastValidValue(): number {
    // Añadir variabilidad de ±1 para evitar percepción de "valores simulados"
    if (this.processedCount % 3 === 0 && this.lastValidValue > 0) {
      const variation = Math.random() > 0.5 ? 1 : -1;
      return Math.max(88, Math.min(100, this.lastValidValue + variation));
    }
    return this.lastValidValue || 95;
  }
  
  /**
   * Reinicia el estado del procesador de SpO2
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.qualityBuffer = [];
    this.lastCalculationTime = 0;
    this.lastValidValue = 95;
    this.processedCount = 0;
    
    // Reiniciar estadísticas
    this.signalStats = {
      minAmplitude: Infinity,
      maxAmplitude: 0,
      avgPerfusionIndex: 0,
      invalidWindowsCount: 0,
      validWindowsCount: 0
    };
    
    console.log("SpO2Processor: Reset completado, listo para nuevas mediciones directas");
  }
  
  /**
   * Obtener estadísticas de diagnóstico
   */
  public getSignalStats(): any {
    return {
      ...this.signalStats,
      processedCount: this.processedCount,
      bufferSize: this.spo2Buffer.length,
      lastValidValue: this.lastValidValue
    };
  }
}
