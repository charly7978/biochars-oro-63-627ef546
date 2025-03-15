
import { 
  analyzeRRIntervals, 
  logRRAnalysis, 
  logPossibleArrhythmia, 
  logConfirmedArrhythmia, 
  logIgnoredArrhythmia 
} from '../../utils/rrAnalysisUtils';
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';

/**
 * Configuración para detección de arritmias
 */
export interface ArrhythmiaConfig {
  MIN_TIME_BETWEEN_ARRHYTHMIAS: number;
  MAX_ARRHYTHMIAS_PER_SESSION: number;
  SIGNAL_QUALITY_THRESHOLD: number;
}

/**
 * Procesador especializado para análisis de arritmias
 */
export class ArrhythmiaAnalyzer {
  private lastArrhythmiaTime: number = 0;
  private hasDetectedArrhythmia: boolean = false;
  private arrhythmiaCounter: number = 0;
  private config: ArrhythmiaConfig;

  constructor(config: ArrhythmiaConfig) {
    this.config = config;
  }

  /**
   * Procesa datos de arritmia basado en intervalos RR
   */
  public processArrhythmiaData(
    rrData: { intervals: number[], lastPeakTime: number | null } | undefined,
    result: VitalSignsResult
  ): VitalSignsResult {
    const currentTime = Date.now();
    
    // Si no hay datos RR válidos, retornar el resultado sin cambios
    if (!rrData?.intervals || rrData.intervals.length < 3) {
      // Si previamente detectamos una arritmia, mantener ese estado
      if (this.hasDetectedArrhythmia) {
        return {
          ...result,
          arrhythmiaStatus: `ARRITMIA DETECTADA|${this.arrhythmiaCounter}`,
          lastArrhythmiaData: null
        };
      }
      
      return {
        ...result,
        arrhythmiaStatus: `SIN ARRITMIAS|${this.arrhythmiaCounter}`
      };
    }
    
    const lastThreeIntervals = rrData.intervals.slice(-3);
    
    // Analizar intervalos RR para detectar posibles arritmias
    const { hasArrhythmia, shouldIncrementCounter, analysisData } = 
      analyzeRRIntervals(
        rrData, 
        currentTime, 
        this.lastArrhythmiaTime, 
        this.arrhythmiaCounter,
        this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS,
        this.config.MAX_ARRHYTHMIAS_PER_SESSION
      );
    
    if (analysisData) {
      // Registrar análisis RR para depuración
      logRRAnalysis(analysisData, lastThreeIntervals);
      
      // Si se detecta una posible arritmia, registrar detalles
      if (hasArrhythmia) {
        logPossibleArrhythmia(analysisData);
        
        if (shouldIncrementCounter) {
          // Confirmamos la arritmia e incrementamos el contador
          this.hasDetectedArrhythmia = true;
          this.arrhythmiaCounter += 1;
          this.lastArrhythmiaTime = currentTime;
          
          // Registrar la arritmia confirmada
          logConfirmedArrhythmia(analysisData, lastThreeIntervals, this.arrhythmiaCounter);

          return {
            ...result,
            arrhythmiaStatus: `ARRITMIA DETECTADA|${this.arrhythmiaCounter}`,
            lastArrhythmiaData: {
              timestamp: currentTime,
              rmssd: analysisData.rmssd,
              rrVariation: analysisData.rrVariation
            }
          };
        } else {
          // Arritmia detectada pero ignorada (demasiado reciente o máximo alcanzado)
          logIgnoredArrhythmia(
            currentTime - this.lastArrhythmiaTime,
            this.config.MAX_ARRHYTHMIAS_PER_SESSION,
            this.arrhythmiaCounter
          );
        }
      }
    }
    
    // Si previamente detectamos una arritmia, mantener ese estado
    if (this.hasDetectedArrhythmia) {
      return {
        ...result,
        arrhythmiaStatus: `ARRITMIA DETECTADA|${this.arrhythmiaCounter}`,
        lastArrhythmiaData: null
      };
    }
    
    // No se detectaron arritmias
    return {
      ...result,
      arrhythmiaStatus: `SIN ARRITMIAS|${this.arrhythmiaCounter}`
    };
  }

  /**
   * Obtiene el contador actual de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }

  /**
   * Establece un nuevo contador de arritmias
   */
  public setArrhythmiaCounter(count: number): void {
    this.arrhythmiaCounter = count;
  }

  /**
   * Reinicia el analizador de arritmias
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.hasDetectedArrhythmia = false;
    this.arrhythmiaCounter = 0;
  }
}
