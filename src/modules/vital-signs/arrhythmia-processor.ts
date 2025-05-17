
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { ArrhythmiaPatternDetector } from './arrhythmia/pattern-detector';
import { RRIntervalData } from './arrhythmia/types';

/**
 * Procesador para detección de arritmias cardíacas - versión optimizada
 * Utiliza análisis de variabilidad de intervalos RR
 * Sin simulación - solo análisis directo de la señal real
 */
export class ArrhythmiaProcessor extends BaseProcessor {
  private rrIntervals: number[] = [];
  private readonly MAX_RR_INTERVALS = 20;
  private arrhythmiaCounter: number = 0;
  private lastArrhythmiaTime: number = 0;
  private patternDetector: ArrhythmiaPatternDetector;
  
  // Umbrales para detección de arritmias con mayor sensibilidad
  private readonly RR_VARIABILITY_THRESHOLD = 0.15; // Reducido para máxima sensibilidad
  private readonly PNNX_THRESHOLD = 0.10; // Reducido para máxima sensibilidad
  private readonly MIN_DETECTION_PERIOD = 1500; // Reducido - mínimo 1.5 segundos entre detecciones
  
  constructor() {
    super();
    this.patternDetector = new ArrhythmiaPatternDetector();
    console.log("ArrhythmiaProcessor: Initialized with maximum sensitivity");
  }
  
  /**
   * Procesa datos RR para detectar arritmias
   * @param rrData Datos de intervalos RR
   * @returns Estado de detección de arritmias y datos asociados
   */
  public processRRData(rrData: RRIntervalData): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: {
      timestamp: number;
      rmssd: number;
      rrVariation: number;
    } | null;
  } {
    const { intervals } = rrData;
    
    // Inicializar resultado
    let result = {
      arrhythmiaStatus: "Normal",
      lastArrhythmiaData: null as {
        timestamp: number;
        rmssd: number;
        rrVariation: number;
      } | null
    };
    
    // Si no hay suficientes intervalos, no podemos analizar
    if (!intervals || intervals.length < 2) {
      return result;
    }
    
    console.log("ArrhythmiaProcessor: Procesando datos RR", {
      intervalosRecibidos: intervals.length,
      intervalos: intervals
    });
    
    // Actualizar nuestro buffer de intervalos RR
    this.rrIntervals = [...this.rrIntervals, ...intervals].slice(-this.MAX_RR_INTERVALS);
    
    // Calcular métricas de variabilidad
    const variabilityMetrics = this.calculateRRVariability();
    
    // Calcular variaciones RR para el detector de patrones
    if (intervals.length >= 2) {
      for (let i = 1; i < intervals.length; i++) {
        const interval1 = intervals[i-1];
        const interval2 = intervals[i];
        if (interval1 > 0 && interval2 > 0) {
          const variation = Math.abs((interval2 - interval1) / interval1);
          this.patternDetector.updatePatternBuffer(variation);
        }
      }
    }
    
    // Detectar patrones usando el detector especializado
    const patternDetected = this.patternDetector.detectArrhythmiaPattern();
    
    console.log("ArrhythmiaProcessor: Métricas de variabilidad", {
      rmssd: variabilityMetrics.rmssd,
      sdnn: variabilityMetrics.sdnn,
      pnn50: variabilityMetrics.pnn50,
      maxRRRatio: variabilityMetrics.maxRRRatio,
      minRRRatio: variabilityMetrics.minRRRatio,
      patternDetected
    });
    
    // Detectar arritmias basadas en variabilidad o patrones
    let arrhythmiaDetected = false;
    let arrhythmiaType = "Indeterminada";
    
    // Verificar variación RMSSD elevada (posible fibrilación auricular)
    if (variabilityMetrics.rmssd > 80) { // Umbral reducido para mayor sensibilidad
      arrhythmiaDetected = true;
      arrhythmiaType = "Posible fibrilación auricular";
    }
    // Verificar variación extrema en intervalos consecutivos (arritmia)
    else if (variabilityMetrics.maxRRRatio > (1 + this.RR_VARIABILITY_THRESHOLD) || 
             variabilityMetrics.minRRRatio < (1 - this.RR_VARIABILITY_THRESHOLD)) {
      arrhythmiaDetected = true;
      arrhythmiaType = "Latidos irregulares";
    }
    // Verificar pNN50 elevado (alta variabilidad)
    else if (variabilityMetrics.pnn50 > this.PNNX_THRESHOLD) {
      arrhythmiaDetected = true;
      arrhythmiaType = "Variabilidad elevada";
    }
    // Verificar detector de patrones
    else if (patternDetected) {
      arrhythmiaDetected = true;
      arrhythmiaType = "Patrón arrítmico detectado";
    }
    
    // Si se detectó arritmia
    if (arrhythmiaDetected) {
      const now = Date.now();
      
      // Incrementar contador si ha pasado suficiente tiempo desde la última detección
      if (now - this.lastArrhythmiaTime > this.MIN_DETECTION_PERIOD) {
        this.arrhythmiaCounter++;
        this.lastArrhythmiaTime = now;
        
        console.log("ArrhythmiaProcessor: ¡ARRITMIA DETECTADA!", {
          tipo: arrhythmiaType,
          contador: this.arrhythmiaCounter,
          metricas: variabilityMetrics
        });
        
        // Actualizar resultado con datos de arritmia
        result = {
          arrhythmiaStatus: `ARRHYTHMIA DETECTED (${arrhythmiaType})`,
          lastArrhythmiaData: {
            timestamp: now,
            rmssd: variabilityMetrics.rmssd,
            rrVariation: variabilityMetrics.maxRRRatio - variabilityMetrics.minRRRatio
          }
        };
      }
    }
    
    return result;
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
    
    // Si hay menos de 2 intervalos, retornar valores por defecto
    if (this.rrIntervals.length < 2) {
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
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    super.reset();
    this.rrIntervals = [];
    this.lastArrhythmiaTime = 0;
    this.patternDetector.resetPatternBuffer();
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
