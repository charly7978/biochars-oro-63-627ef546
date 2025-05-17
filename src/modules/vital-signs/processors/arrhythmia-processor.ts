
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Procesador para detección de arritmias cardíacas
 * Utiliza análisis de variabilidad de intervalos RR
 * Sin simulación - solo análisis directo de la señal real
 */
export class ArrhythmiaProcessor extends BaseProcessor {
  private rrIntervals: number[] = [];
  private readonly MAX_RR_INTERVALS = 20;
  private arrhythmiaCounter: number = 0;
  private lastArrhythmiaTime: number = 0;
  
  // Umbrales para detección de arritmias
  private readonly RR_VARIABILITY_THRESHOLD = 0.2; // 20% de variación para detectar arritmia
  private readonly PNNX_THRESHOLD = 0.15; // 15% de intervalos con diferencia > 50ms
  private readonly CONSECUTIVE_IRREGULAR_THRESHOLD = 3; // Número de latidos irregulares consecutivos
  
  constructor() {
    super();
    console.log("ArrhythmiaProcessor: Initialized");
  }
  
  /**
   * Detecta arritmias basadas en análisis de señal PPG
   * @param filteredValue Valor filtrado de señal PPG
   * @returns Estado de detección de arritmias
   */
  public detectArrhythmia(filteredValue: number): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: {
      timestamp: number;
      type: string;
      confidence: number;
    } | null;
  } {
    // Inicializar resultado
    let result = {
      arrhythmiaStatus: "Normal",
      lastArrhythmiaData: null as {
        timestamp: number;
        type: string;
        confidence: number;
      } | null
    };
    
    // Si no hay suficientes valores en el buffer, no hay análisis
    if (this.ppgValues.length < 30) {
      return result;
    }
    
    // Analizar forma de onda para detectar patrones arrítmicos
    // Detectar picos en la señal
    const peaks = this.detectPeaks(this.ppgValues);
    
    // Calcular intervalos RR (tiempo entre picos)
    if (peaks.length >= 2) {
      for (let i = 1; i < peaks.length; i++) {
        const rrInterval = peaks[i] - peaks[i - 1];
        
        // Filtrar intervalos fisiológicamente plausibles (250-1500ms)
        if (rrInterval >= 250 && rrInterval <= 1500) {
          this.rrIntervals.push(rrInterval);
          
          // Mantener tamaño máximo del buffer
          if (this.rrIntervals.length > this.MAX_RR_INTERVALS) {
            this.rrIntervals.shift();
          }
        }
      }
    }
    
    // Si no hay suficientes intervalos, no podemos analizar
    if (this.rrIntervals.length < 5) {
      return result;
    }
    
    // Calcular métricas de variabilidad
    const variabilityMetrics = this.calculateRRVariability();
    
    // Detectar arritmias basadas en variabilidad
    let arrhythmiaDetected = false;
    let arrhythmiaType = "Indeterminada";
    let confidence = 0.0;
    
    // Verificar variación RMSSD elevada (posible fibrilación auricular)
    if (variabilityMetrics.rmssd > 120) {
      arrhythmiaDetected = true;
      arrhythmiaType = "Posible fibrilación auricular";
      confidence = Math.min(1.0, (variabilityMetrics.rmssd - 120) / 80);
    }
    // Verificar variación extrema en intervalos consecutivos (arritmia)
    else if (variabilityMetrics.maxRRRatio > (1 + this.RR_VARIABILITY_THRESHOLD) || 
             variabilityMetrics.minRRRatio < (1 - this.RR_VARIABILITY_THRESHOLD)) {
      arrhythmiaDetected = true;
      arrhythmiaType = "Latidos irregulares";
      confidence = Math.min(1.0, Math.abs(variabilityMetrics.maxRRRatio - 1) / this.RR_VARIABILITY_THRESHOLD);
    }
    // Verificar pNN50 elevado (alta variabilidad)
    else if (variabilityMetrics.pnn50 > this.PNNX_THRESHOLD) {
      arrhythmiaDetected = true;
      arrhythmiaType = "Variabilidad elevada";
      confidence = Math.min(1.0, variabilityMetrics.pnn50 / (this.PNNX_THRESHOLD * 2));
    }
    
    // Si se detectó arritmia
    if (arrhythmiaDetected) {
      const now = Date.now();
      
      // Incrementar contador solo si ha pasado suficiente tiempo desde la última detección
      if (now - this.lastArrhythmiaTime > 5000) {
        this.arrhythmiaCounter++;
        this.lastArrhythmiaTime = now;
        
        result = {
          arrhythmiaStatus: `ARRHYTHMIA DETECTED (${arrhythmiaType})`,
          lastArrhythmiaData: {
            timestamp: now,
            type: arrhythmiaType,
            confidence: confidence
          }
        };
        
        console.log("ArrhythmiaProcessor: Arritmia detectada", {
          tipo: arrhythmiaType,
          confianza: confidence,
          contador: this.arrhythmiaCounter,
          metricas: variabilityMetrics
        });
      }
    }
    
    return result;
  }
  
  /**
   * Detecta picos en la señal PPG
   * @param values Valores de señal PPG
   * @returns Array con timestamps de picos detectados
   */
  private detectPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    const now = Date.now();
    const sampleInterval = 33; // ~30Hz (33ms entre muestras)
    
    // Usar un algoritmo simple para detectar picos
    // En un sistema real, usaríamos un algoritmo más robusto
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && 
          values[i] > values[i-2] && 
          values[i] > values[i+1] && 
          values[i] > values[i+2]) {
        
        // Calcular timestamp aproximado para este pico
        const timestamp = now - ((values.length - i) * sampleInterval);
        peaks.push(timestamp);
      }
    }
    
    return peaks;
  }
  
  /**
   * Calcula métricas de variabilidad de intervalos RR
   * @returns Métricas calculadas
   */
  private calculateRRVariability(): {
    rmssd: number;
    sdnn: number;
    pnn50: number;
    maxRRRatio: number;
    minRRRatio: number;
  } {
    // Preparar resultado
    const result = {
      rmssd: 0,  // Root Mean Square of Successive Differences
      sdnn: 0,   // Standard Deviation of NN intervals
      pnn50: 0,  // Percentage of successive RR intervals > 50ms
      maxRRRatio: 1.0, // Ratio máximo entre intervalos RR consecutivos
      minRRRatio: 1.0  // Ratio mínimo entre intervalos RR consecutivos
    };
    
    // Si hay menos de 5 intervalos, retornar valores por defecto
    if (this.rrIntervals.length < 5) {
      return result;
    }
    
    // Calcular diferencias sucesivas
    const diffs: number[] = [];
    let nn50 = 0;
    
    let maxRatio = 0;
    let minRatio = Number.MAX_VALUE;
    
    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i-1];
      diffs.push(diff);
      
      // Contar intervalos > 50ms para pNN50
      if (Math.abs(diff) > 50) {
        nn50++;
      }
      
      // Calcular ratio para detección de arritmias
      const ratio = this.rrIntervals[i] / this.rrIntervals[i-1];
      maxRatio = Math.max(maxRatio, ratio);
      minRatio = Math.min(minRatio, ratio);
    }
    
    // Calcular RMSSD
    const squareDiffs = diffs.map(d => d * d);
    const meanSquare = squareDiffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    result.rmssd = Math.sqrt(meanSquare);
    
    // Calcular SDNN
    const mean = this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;
    const variance = this.rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.rrIntervals.length;
    result.sdnn = Math.sqrt(variance);
    
    // Calcular pNN50
    result.pnn50 = nn50 / diffs.length;
    
    // Asignar ratios
    result.maxRRRatio = maxRatio;
    result.minRRRatio = minRatio;
    
    return result;
  }
  
  /**
   * Obtiene contador de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    super.reset();
    this.rrIntervals = [];
    this.lastArrhythmiaTime = 0;
    console.log("ArrhythmiaProcessor: Reset complete");
  }
  
  /**
   * Reinicio completo incluyendo contador de arritmias
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaCounter = 0;
    console.log("ArrhythmiaProcessor: Full reset complete");
  }
}
