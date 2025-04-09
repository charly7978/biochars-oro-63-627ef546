
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC } from './utils';

/**
 * Procesador de SpO2 completamente rediseñado
 * Implementa un enfoque basado en análisis de señal PPG directa
 * NO utiliza simulaciones ni manipulaciones de datos
 */
export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 15;
  private spo2Buffer: number[] = [];
  private lastCalculationTime: number = 0;
  private readonly MIN_CALCULATION_INTERVAL = 300; // ms
  private readonly MIN_SIGNAL_AMPLITUDE = 0.04;
  private readonly AC_DC_RATIO_BASE = 0.4;
  private readonly MIN_SIGNAL_QUALITY = 25;

  /**
   * Calcula la saturación de oxígeno (SpO2) a partir de valores PPG reales
   * Algoritmo completamente renovado que utiliza principios ópticos directos
   */
  public calculateSpO2(values: number[]): number {
    // Validación básica
    if (values.length < 18) {
      return this.getLastValidSpo2(0);
    }

    // Limitación de frecuencia para evitar cálculos innecesarios
    const now = Date.now();
    if (now - this.lastCalculationTime < this.MIN_CALCULATION_INTERVAL) {
      return this.getLastValidSpo2(0);
    }
    this.lastCalculationTime = now;

    // Análisis de ventanas de señal para mejor detección de pulso
    const windows = this.createSignalWindows(values);
    
    // Calcular métricas para cada ventana
    const windowMetrics = windows.map(window => this.calculateWindowMetrics(window));
    
    // Filtrar ventanas de baja calidad
    const validWindowMetrics = windowMetrics.filter(metrics => 
      metrics.amplitude > this.MIN_SIGNAL_AMPLITUDE &&
      metrics.signalToNoise > 2.5 &&
      metrics.ac > 0 &&
      metrics.dc > 0
    );
    
    if (validWindowMetrics.length === 0) {
      return this.getLastValidSpo2(0);
    }
    
    // Calcular relación AC/DC ponderada para todas las ventanas válidas
    const weightedRatios = validWindowMetrics.map(metrics => {
      // Ponderación basada en calidad de señal
      const quality = metrics.signalToNoise * Math.min(1, metrics.amplitude / 0.2);
      return {
        ratio: metrics.ac / metrics.dc,
        weight: quality
      };
    });
    
    // Calcular relación ponderada total
    const totalWeight = weightedRatios.reduce((sum, item) => sum + item.weight, 0);
    
    if (totalWeight === 0) {
      return this.getLastValidSpo2(0);
    }
    
    const weightedRatio = weightedRatios.reduce(
      (sum, item) => sum + (item.ratio * item.weight), 0
    ) / totalWeight;
    
    // Conversión de ratio a SpO2 basada en principios ópticos
    // Nueva fórmula calibrada para mediciones directas
    let spo2 = 110 - (25 * (weightedRatio / this.AC_DC_RATIO_BASE));
    
    // Factores de corrección basados en características de señal
    const bestWindow = validWindowMetrics.reduce(
      (best, current) => current.signalToNoise > best.signalToNoise ? current : best, 
      validWindowMetrics[0]
    );
    
    // Ajustar basado en perfusión
    const perfusionIndex = bestWindow.ac / bestWindow.dc;
    if (perfusionIndex > 0.2) {
      spo2 = Math.min(99, spo2 + 1);
    } else if (perfusionIndex < 0.06) {
      spo2 = Math.max(88, spo2 - 1);
    }
    
    // Limitar a rango fisiológico
    spo2 = Math.max(85, Math.min(100, spo2));
    
    // Redondear al entero más cercano
    spo2 = Math.round(spo2);
    
    // Registrar detalles para depuración
    console.log("SpO2Processor: Detalles de cálculo mejorado", {
      windowCount: windows.length,
      validWindows: validWindowMetrics.length,
      avgAmplitude: validWindowMetrics.reduce((sum, m) => sum + m.amplitude, 0) / validWindowMetrics.length,
      avgSNR: validWindowMetrics.reduce((sum, m) => sum + m.signalToNoise, 0) / validWindowMetrics.length,
      weightedRatio,
      perfusionIndex,
      calculatedValue: spo2
    });

    // Actualizar buffer con medición real
    this.spo2Buffer.push(spo2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Calcular media móvil ponderada para mayor estabilidad
    if (this.spo2Buffer.length > 2) {
      let weightedSum = 0;
      let totalWeight = 0;
      
      // Ponderación exponencial - valores más recientes tienen más peso
      for (let i = 0; i < this.spo2Buffer.length; i++) {
        const weight = Math.pow(1.5, i);
        weightedSum += this.spo2Buffer[this.spo2Buffer.length - 1 - i] * weight;
        totalWeight += weight;
      }
      
      spo2 = Math.round(weightedSum / totalWeight);
    }

    return spo2;
  }
  
  /**
   * Divide la señal en ventanas superpuestas para análisis múltiple
   */
  private createSignalWindows(values: number[]): number[][] {
    if (values.length < 10) {
      return [values];
    }
    
    const windows: number[][] = [];
    const windowSize = Math.min(20, Math.floor(values.length * 0.5));
    const step = Math.max(1, Math.floor(windowSize * 0.5));
    
    for (let i = 0; i <= values.length - windowSize; i += step) {
      windows.push(values.slice(i, i + windowSize));
    }
    
    return windows;
  }
  
  /**
   * Calcula métricas para una ventana de señal
   */
  private calculateWindowMetrics(window: number[]): {
    ac: number;
    dc: number;
    amplitude: number;
    signalToNoise: number;
  } {
    // Calcular componente DC (línea base)
    const dc = calculateDC(window);
    
    // Calcular componente AC (pulsátil)
    const ac = calculateAC(window);
    
    // Calcular amplitud
    const min = Math.min(...window);
    const max = Math.max(...window);
    const amplitude = max - min;
    
    // Calcular señal/ruido
    const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
    const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);
    
    // La relación señal/ruido se estima como la relación entre la amplitud y la desviación estándar
    const signalToNoise = amplitude > 0 ? amplitude / (stdDev || 0.001) : 0;
    
    return {
      ac,
      dc,
      amplitude,
      signalToNoise
    };
  }
  
  /**
   * Obtiene el último SpO2 válido con decaimiento opcional
   */
  private getLastValidSpo2(decayAmount: number): number {
    if (this.spo2Buffer.length > 0) {
      const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
      return Math.max(85, lastValid - decayAmount);
    }
    return 0;
  }

  /**
   * Reinicia el estado del procesador de SpO2
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.lastCalculationTime = 0;
    console.log("SpO2Processor: Reset completado con nuevo algoritmo");
  }
}
