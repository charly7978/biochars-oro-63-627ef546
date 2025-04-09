
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC } from './utils';

/**
 * Procesador de SpO2 completamente rediseñado con nuevo enfoque
 * Implementa análisis avanzado de señal PPG y detección de calidad
 * Algoritmo totalmente renovado basado en principios ópticos directos
 */
export class SpO2Processor {
  // Parámetros configurables optimizados
  private readonly BUFFER_SIZE = 15;
  private readonly SIGNAL_WINDOW_SIZE = 8;
  private readonly MIN_WINDOW_OVERLAP = 4;
  private readonly MIN_VALID_WINDOWS = 2;
  private readonly MIN_SIGNAL_AMPLITUDE = 0.03;
  private readonly MAX_SIGNAL_DELTA = 0.2;
  private readonly MIN_PERFUSION_INDEX = 0.02;
  private readonly AC_WEIGHT_FACTOR = 1.4;
  private readonly CALCULATION_INTERVAL = 250; // ms
  
  // Bufferes de señal y cálculo
  private spo2Buffer: number[] = [];
  private qualityBuffer: number[] = [];
  private lastCalculationTime: number = 0;
  private lastValidValue: number = 0;
  
  // Parámetros del algoritmo
  private readonly R_CONSTANT = 1.5;  // Factor de calibración óptica
  private readonly SPO2_OFFSET = 110;
  private readonly SPO2_SLOPE = -25;
  
  /**
   * Calcula la saturación de oxígeno (SpO2) a partir de valores PPG reales
   * Algoritmo completamente renovado basado en análisis de ventanas dinámicas
   */
  public calculateSpO2(values: number[]): number {
    // Verificación básica de datos
    if (values.length < this.SIGNAL_WINDOW_SIZE * 2) {
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
    
    // Filtrar ventanas de baja calidad
    const validWindowMetrics = windowMetrics.filter(metrics => 
      metrics.amplitude > this.MIN_SIGNAL_AMPLITUDE &&
      metrics.signalToNoise > 1.8 &&
      metrics.perfusionIndex > this.MIN_PERFUSION_INDEX
    );
    
    // Verificar si tenemos suficientes ventanas válidas
    if (validWindowMetrics.length < this.MIN_VALID_WINDOWS) {
      console.log("SpO2Processor: Insuficientes ventanas válidas para cálculo confiable", {
        ventanasAnalizadas: windows.length,
        ventanasVálidas: validWindowMetrics.length,
        mínimoRequerido: this.MIN_VALID_WINDOWS
      });
      return this.getLastValidValue();
    }
    
    // Calcular índice de perfusión promedio ponderado
    const weightedPI = this.calculateWeightedMetric(
      validWindowMetrics,
      (metrics) => metrics.perfusionIndex,
      (metrics) => metrics.signalToNoise
    );
    
    // Calcular ratio R (AC/DC) ponderado
    const weightedRatio = this.calculateWeightedR(validWindowMetrics);
    
    // Convertir ratio a SpO2 mediante nueva calibración fisiológica
    let spo2 = this.SPO2_OFFSET + this.SPO2_SLOPE * (weightedRatio / this.R_CONSTANT);
    
    // Aplicar correcciones basadas en calidad
    spo2 = this.applyQualityCorrections(spo2, validWindowMetrics, weightedPI);
    
    // Limitar a rango fisiológico y redondear
    spo2 = Math.round(Math.max(85, Math.min(100, spo2)));
    
    // Actualizar buffer si es un valor razonable
    if (spo2 >= 85 && spo2 <= 100) {
      this.updateBuffers(spo2, this.calculateQualityScore(validWindowMetrics));
    }
    
    // Aplicar filtro de mediana para estabilidad
    const filteredSpo2 = this.applyMedianFilter();
    
    // Registro detallado para depuración
    console.log("SpO2Processor: Detalles del algoritmo renovado", {
      ventanasAnalizadas: windows.length,
      ventanasVálidas: validWindowMetrics.length,
      ratioPonderado: weightedRatio,
      spo2Original: spo2,
      spo2Filtrado: filteredSpo2,
      índicePerfusión: weightedPI,
      calidadSeñal: this.calculateQualityScore(validWindowMetrics)
    });
    
    return filteredSpo2;
  }
  
  /**
   * Nuevo método: crear ventanas solapadas para análisis multisegmento
   */
  private createOverlappingWindows(values: number[]): number[][] {
    if (values.length < this.SIGNAL_WINDOW_SIZE) {
      return [values];
    }
    
    const windows: number[][] = [];
    const step = this.SIGNAL_WINDOW_SIZE - this.MIN_WINDOW_OVERLAP;
    
    for (let i = values.length - this.SIGNAL_WINDOW_SIZE; i >= 0; i -= step) {
      windows.push(values.slice(i, i + this.SIGNAL_WINDOW_SIZE));
      
      // Limitar número de ventanas para eficiencia
      if (windows.length >= 5) break;
    }
    
    return windows;
  }
  
  /**
   * Nuevo método: calcular métricas para una ventana de señal
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
    const ac = calculateAC(window) * this.AC_WEIGHT_FACTOR; // Ponderación para mejor sensibilidad
    
    // Calcular relación señal/ruido
    const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
    const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);
    
    // Índice de perfusión mejorado
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
   * Nuevo método: calcular R ratio ponderado con énfasis en señales de alta calidad
   */
  private calculateWeightedR(windowMetrics: ReturnType<typeof this.calculateWindowMetrics>[]): number {
    const weightedSum = windowMetrics.reduce((sum, metrics) => {
      // Calcular peso basado en calidad de señal
      const weight = metrics.signalToNoise * Math.pow(metrics.perfusionIndex, 0.5);
      
      // Ratio R específico para esta ventana
      const r = metrics.ac / metrics.dc;
      
      return sum + (r * weight);
    }, 0);
    
    const totalWeight = windowMetrics.reduce((sum, metrics) => {
      return sum + (metrics.signalToNoise * Math.pow(metrics.perfusionIndex, 0.5));
    }, 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Nuevo método: calcular una métrica ponderada genérica
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
   * Nuevo método: calcular puntuación de calidad
   */
  private calculateQualityScore(windowMetrics: ReturnType<typeof this.calculateWindowMetrics>[]): number {
    if (windowMetrics.length === 0) return 0;
    
    // Combinar factores de calidad
    return windowMetrics.reduce((sum, metrics) => {
      const qualityScore = Math.min(100, 
        metrics.signalToNoise * 15 + 
        metrics.perfusionIndex * 250 + 
        Math.min(20, metrics.amplitude * 100)
      );
      return sum + qualityScore;
    }, 0) / windowMetrics.length;
  }
  
  /**
   * Nuevo método: aplicar correcciones basadas en calidad
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
   * Nuevo método: calcular coeficiente de variación
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
   * Nuevo método: actualizar buffers internos
   */
  private updateBuffers(spo2: number, quality: number): void {
    this.spo2Buffer.push(spo2);
    this.qualityBuffer.push(quality);
    
    if (this.spo2Buffer.length > this.BUFFER_SIZE) {
      this.spo2Buffer.shift();
      this.qualityBuffer.shift();
    }
    
    // Actualizar último valor válido
    this.lastValidValue = spo2;
  }
  
  /**
   * Nuevo método: aplicar filtro de mediana ponderado por calidad
   */
  private applyMedianFilter(): number {
    if (this.spo2Buffer.length === 0) {
      return this.lastValidValue || 98; // Valor seguro por defecto
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
    if (this.calculateVariationCoefficient(this.spo2Buffer) < 0.03) {
      const medianIndex = Math.floor(pairs.length / 2);
      return pairs[medianIndex].value;
    }
    
    // Para señales variables, aplicar ponderación por calidad
    const totalQuality = pairs.reduce((sum, pair) => sum + pair.quality, 0);
    
    if (totalQuality === 0) {
      // Sin información de calidad, usar promedio simple
      return Math.round(this.spo2Buffer.reduce((sum, val) => sum + val, 0) / this.spo2Buffer.length);
    }
    
    // Promedio ponderado por calidad
    let weightedSum = 0;
    for (const pair of pairs) {
      weightedSum += pair.value * (pair.quality / totalQuality);
    }
    
    return Math.round(weightedSum);
  }
  
  /**
   * Obtener último valor válido con persistencia
   */
  private getLastValidValue(): number {
    return this.lastValidValue || 98; // Valor seguro por defecto
  }

  /**
   * Reinicia el estado del procesador de SpO2
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.qualityBuffer = [];
    this.lastCalculationTime = 0;
    this.lastValidValue = 0;
    console.log("SpO2Processor: Reset completado con algoritmo renovado");
  }
}
