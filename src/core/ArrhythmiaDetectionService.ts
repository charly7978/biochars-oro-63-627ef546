
import { VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';

/**
 * Configuración unificada para detección de arritmias
 */
export interface ArrhythmiaConfig {
  MIN_TIME_BETWEEN_ARRHYTHMIAS: number;
  MAX_ARRHYTHMIAS_PER_SESSION: number;
  SIGNAL_QUALITY_THRESHOLD: number;
}

/**
 * Servicio unificado para detección de arritmias
 * Consolida la funcionalidad duplicada en múltiples archivos
 */
export class ArrhythmiaDetectionService {
  // Configuración estándar
  private readonly DEFAULT_CONFIG: ArrhythmiaConfig = {
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 3500,
    MAX_ARRHYTHMIAS_PER_SESSION: 40,
    SIGNAL_QUALITY_THRESHOLD: 0.45
  };
  
  private config: ArrhythmiaConfig;
  
  // Estado de detección
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaDetected: boolean = false;
  private arrhythmiaCounter: number = 0;
  
  // Variables para detección de patrones
  private patternBuffer: number[] = [];
  private consecutiveAnomalies: number = 0;
  private readonly PATTERN_BUFFER_SIZE = 15;
  private readonly CONSECUTIVE_THRESHOLD = 6;
  private readonly PATTERN_MATCH_THRESHOLD = 0.65;

  constructor(config?: Partial<ArrhythmiaConfig>) {
    this.config = {
      ...this.DEFAULT_CONFIG,
      ...config
    };
    
    console.log("ArrhythmiaDetectionService: Initialized with config:", {
      minTimeBetween: this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS,
      maxPerSession: this.config.MAX_ARRHYTHMIAS_PER_SESSION,
      qualityThreshold: this.config.SIGNAL_QUALITY_THRESHOLD,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Analiza datos RR para detectar arritmias
   */
  public analyzeRRData(
    rrData: { intervals: number[], lastPeakTime: number | null } | undefined,
    result: VitalSignsResult
  ): VitalSignsResult {
    const currentTime = Date.now();
    
    // Verificar datos suficientes
    if (!rrData?.intervals || rrData.intervals.length < 12) {
      return this.getStatePreservingResult(result);
    }
    
    // Extraer intervalos para análisis
    const intervals = rrData.intervals.slice(-16);
    
    // Análisis de intervalos RR
    const analysisData = this.analyzeRRIntervals(intervals);
    if (!analysisData) {
      return this.getStatePreservingResult(result);
    }
    
    // Verificar límites de tiempo entre arritmias
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canRegisterNewArrhythmia = 
      timeSinceLastArrhythmia > this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS &&
      this.arrhythmiaCounter < this.config.MAX_ARRHYTHMIAS_PER_SESSION;
    
    // Detección de arritmia
    const hasArrhythmia = this.isArrhythmia(analysisData);
    
    if (hasArrhythmia) {
      // Actualizar buffer de patrones
      this.updatePatternBuffer(analysisData.rrVariation);
      
      // Verificar patrón de arritmia
      if (this.detectArrhythmiaPattern()) {
        this.consecutiveAnomalies++;
        
        console.log("ArrhythmiaDetectionService: Pattern detected", {
          consecutiveAnomalies: this.consecutiveAnomalies,
          threshold: this.CONSECUTIVE_THRESHOLD,
          variation: analysisData.rrVariation,
          timestamp: currentTime
        });
      } else {
        this.consecutiveAnomalies = 0;
      }
      
      // Confirmar arritmia con anomalías consecutivas
      if (canRegisterNewArrhythmia && this.consecutiveAnomalies >= this.CONSECUTIVE_THRESHOLD) {
        return this.confirmArrhythmia(result, currentTime, analysisData);
      }
    } else {
      // Reset de anomalías para negativos claros
      this.consecutiveAnomalies = 0;
    }
    
    return this.getStatePreservingResult(result);
  }
  
  /**
   * Determina si hay arritmia basado en análisis de intervalo RR
   */
  private isArrhythmia(analysisData: any): boolean {
    return analysisData.rrVariation > 0.12;
  }
  
  /**
   * Analiza intervalos RR para detectar anomalías
   */
  private analyzeRRIntervals(intervals: number[]): any {
    if (intervals.length < 3) return null;
    
    // Calcular estadísticas básicas
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Calcular variación de intervalo RR (indicador principal de arritmia)
    let sumSquares = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquares += diff * diff;
    }
    
    // RMSSD (Root Mean Square of Successive Differences)
    const rmssd = Math.sqrt(sumSquares / (intervals.length - 1));
    const rrVariation = rmssd / avgInterval;
    
    return {
      rmssd,
      rrVariation,
      avgInterval
    };
  }
  
  /**
   * Actualiza buffer de patrones para análisis temporal
   */
  private updatePatternBuffer(value: number): void {
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
  }
  
  /**
   * Resetea buffer de patrones
   */
  private resetPatternBuffer(): void {
    this.patternBuffer = [];
  }
  
  /**
   * Detecta patrones de arritmia usando análisis temporal
   */
  private detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < 5) return false;
    
    // Analizar patrón reciente
    const recentPattern = this.patternBuffer.slice(-5);
    
    // Característica 1: Variaciones significativas
    const significantVariations = recentPattern.filter(v => v > 0.1).length;
    const variationRatio = significantVariations / recentPattern.length;
    
    return variationRatio > this.PATTERN_MATCH_THRESHOLD;
  }
  
  /**
   * Confirma arritmia y actualiza estado
   */
  private confirmArrhythmia(
    result: VitalSignsResult, 
    currentTime: number,
    analysisData: any
  ): VitalSignsResult {
    this.arrhythmiaDetected = true;
    this.arrhythmiaCounter++;
    this.lastArrhythmiaTime = currentTime;
    this.consecutiveAnomalies = 0;
    this.resetPatternBuffer();
    
    console.log("ArrhythmiaDetectionService: Arrhythmia confirmed", {
      counter: this.arrhythmiaCounter,
      timestamp: new Date(currentTime).toISOString(),
      rmssd: analysisData.rmssd,
      rrVariation: analysisData.rrVariation
    });
    
    return {
      ...result,
      arrhythmiaStatus: `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`,
      lastArrhythmiaData: {
        timestamp: currentTime,
        rmssd: analysisData.rmssd,
        rrVariation: analysisData.rrVariation
      }
    };
  }
  
  /**
   * Obtiene resultado que preserva estado actual de arritmia
   */
  private getStatePreservingResult(result: VitalSignsResult): VitalSignsResult {
    if (this.arrhythmiaDetected) {
      return {
        ...result,
        arrhythmiaStatus: `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`,
        lastArrhythmiaData: null
      };
    }
    
    return {
      ...result,
      arrhythmiaStatus: `NO ARRHYTHMIAS|${this.arrhythmiaCounter}`
    };
  }
  
  /**
   * Obtiene contador actual de arritmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Resetea estado del analizador completamente
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCounter = 0;
    this.consecutiveAnomalies = 0;
    this.patternBuffer = [];
    
    console.log("ArrhythmiaDetectionService: Reset complete", {
      timestamp: new Date().toISOString()
    });
  }
}

// Instancia singleton para uso global
export const arrhythmiaDetectionService = new ArrhythmiaDetectionService();
