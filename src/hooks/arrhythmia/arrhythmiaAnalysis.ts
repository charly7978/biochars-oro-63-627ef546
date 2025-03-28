
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
  
  // CAMBIO CRÍTICO: Aumentamos MUCHO más el umbral para reducir drásticamente 
  // los falsos positivos
  private consecutiveAbnormalIntervals: number = 0;
  // CAMBIO CRÍTICO: Aumentamos el umbral para hacer las arritmias más raras
  private readonly CONSECUTIVE_THRESHOLD = 8; // Aumentado a 8 para mayor robustez

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
    if (!rrData?.intervals || rrData.intervals.length < 9) { // Aumentado a 9 para más estabilidad
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
    
    // CAMBIO CRÍTICO: Usamos más intervalos para mayor estabilidad
    const lastIntervals = rrData.intervals.slice(-9);
    
    // Analizar intervalos RR para detectar posibles arritmias con umbral más estricto
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
      logRRAnalysis(analysisData, lastIntervals.slice(-3));
      
      // Si se detecta una posible arritmia, registrar detalles
      if (hasArrhythmia) {
        logPossibleArrhythmia(analysisData);
        
        // CAMBIO CRÍTICO: Análisis de continuidad mucho más estricto
        // Solo incrementamos si la variación es EXTREMADAMENTE alta
        if (analysisData.rrVariation > 0.45) { // Aumentado a 0.45 (45% de variación)
          this.consecutiveAbnormalIntervals++;
        } else {
          // CAMBIO CRÍTICO: Decrementamos activamente para hacer más difícil
          // alcanzar el umbral
          this.consecutiveAbnormalIntervals = Math.max(0, this.consecutiveAbnormalIntervals - 1);
        }
        
        // Verificar si debemos incrementar contador (con umbral mejorado)
        // CAMBIO CRÍTICO: Requerimos muchas más anomalías consecutivas
        if (shouldIncrementCounter && 
            (this.consecutiveAbnormalIntervals >= this.CONSECUTIVE_THRESHOLD)) {
          // Confirmamos la arritmia e incrementamos el contador
          this.hasDetectedArrhythmia = true;
          this.arrhythmiaCounter += 1;
          this.lastArrhythmiaTime = currentTime;
          this.consecutiveAbnormalIntervals = 0; // Reiniciar contador de anomalías
          
          // Registrar la arritmia confirmada
          logConfirmedArrhythmia(analysisData, lastIntervals.slice(-3), this.arrhythmiaCounter);

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
      } else {
        // CAMBIO CRÍTICO: Decrementamos activamente para hacer más difícil
        // alcanzar el umbral
        this.consecutiveAbnormalIntervals = Math.max(0, this.consecutiveAbnormalIntervals - 1);
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
    this.consecutiveAbnormalIntervals = 0;
  }
}
