
/**
 * ArrhythmiaDetector.ts
 * 
 * Sistema unificado de detección de arritmias con umbrales consistentes
 * y mejor precisión diagnóstica basada en investigación clínica.
 */

export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean;
  arrhythmiaCounter: number;
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  visualWindow?: {
    start: number;
    end: number;
  } | null;
}

export interface ArrhythmiaConfig {
  /** Tiempo mínimo entre arritmias (ms) */
  minTimeBetweenArrhythmias: number;
  /** Máximo número de arritmias por sesión */
  maxArrhythmiasPerSession: number;
  /** Umbral de calidad de señal mínimo para detección confiable */
  signalQualityThreshold: number;
  /** Período de aprendizaje inicial (ms) */
  learningPeriod: number;
}

export class ArrhythmiaDetector {
  // Configuración basada en estándares clínicos y estudios de validación
  private readonly DEFAULT_CONFIG: ArrhythmiaConfig = {
    minTimeBetweenArrhythmias: 3000,
    maxArrhythmiasPerSession: 10,
    signalQualityThreshold: 0.65,
    learningPeriod: 5000
  };

  // Umbrales de detección clínicamente relevantes
  private readonly NORMAL_VARIATION_THRESHOLD = 0.15; // 15% es variación normal
  private readonly MILD_ARRHYTHMIA_THRESHOLD = 0.25; // 25% indica posible arritmia
  private readonly CONFIRMED_ARRHYTHMIA_THRESHOLD = 0.35; // 35% arritmia confirmada
  private readonly CONSECUTIVE_ABNORMAL_THRESHOLD = 3; // Requiere confirmación múltiple
  private readonly RMSSD_MIN_THRESHOLD = 30; // Valor mínimo de RMSSD para considerar arritmia

  // Estado interno
  private config: ArrhythmiaConfig;
  private arrhythmiaCounter: number = 0;
  private lastArrhythmiaTime: number = 0;
  private consecutiveAbnormalCount: number = 0;
  private isInLearningPhase: boolean = true;
  private measurementStartTime: number = Date.now();
  private hasDetectedArrhythmia: boolean = false;
  private visualWindow: { start: number, end: number } | null = null;
  
  constructor(config?: Partial<ArrhythmiaConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.reset();
  }

  /**
   * Analiza intervalos RR para detectar arritmias con criterios médicos
   */
  public analyzeRRIntervals(
    rrIntervals: number[] | undefined,
    currentTime: number = Date.now(),
    signalQuality: number = 1.0
  ): ArrhythmiaDetectionResult {
    // Verificar si estamos en fase de aprendizaje
    if (currentTime - this.measurementStartTime < this.config.learningPeriod) {
      this.isInLearningPhase = true;
      return this.getResult("CALIBRANDO...");
    }
    
    this.isInLearningPhase = false;
    
    // Validar calidad de señal y datos suficientes
    if (!rrIntervals || rrIntervals.length < 5 || signalQuality < this.config.signalQualityThreshold) {
      // Reducir contador de anomalías en condiciones subóptimas
      this.consecutiveAbnormalCount = Math.max(0, this.consecutiveAbnormalCount - 1);
      return this.getResult(this.hasDetectedArrhythmia ? 
        `ARRITMIA DETECTADA|${this.arrhythmiaCounter}` : 
        `SIN ARRITMIAS|${this.arrhythmiaCounter}`);
    }
    
    // Analizar los últimos 5 intervalos para mayor estabilidad
    const recentIntervals = rrIntervals.slice(-5);
    const avgRR = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
    const lastRR = recentIntervals[recentIntervals.length - 1];
    
    // Calcular variación relativa al promedio (indicador clave de arritmia)
    const variation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Calcular RMSSD (Root Mean Square of Successive Differences)
    // Métrica estándar en cardiología para variabilidad del ritmo cardíaco
    let rmssd = 0;
    for (let i = 1; i < recentIntervals.length; i++) {
      rmssd += Math.pow(recentIntervals[i] - recentIntervals[i-1], 2);
    }
    rmssd = Math.sqrt(rmssd / (recentIntervals.length - 1));
    
    // Calcular desviación estándar (medida de variabilidad general)
    const rrSD = Math.sqrt(
      recentIntervals.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / 
      recentIntervals.length
    );
    
    // Comprobar si el latido actual cumple criterios de arritmia
    // Un latido es arrítmico si:
    // 1. Es significativamente más corto que el promedio (prematuro)
    // 2. Es significativamente más largo que el promedio (bloqueado)
    // 3. La variación respecto al promedio excede el umbral
    const isPrematureBeat = lastRR < 0.7 * avgRR;
    const isDelayedBeat = lastRR > 1.3 * avgRR;
    const isHighVariation = variation > this.CONFIRMED_ARRHYTHMIA_THRESHOLD;
    
    // Determinar si hay arritmia basado en múltiples criterios
    const currentBeatIsArrhythmic = 
      (isPrematureBeat || isDelayedBeat || isHighVariation) && 
      rmssd > this.RMSSD_MIN_THRESHOLD;
    
    // Actualizar contador de latidos anormales consecutivos
    if (currentBeatIsArrhythmic) {
      this.consecutiveAbnormalCount++;
      console.log("ArrhythmiaDetector: Posible arritmia detectada", {
        consecutiveCount: this.consecutiveAbnormalCount,
        variation,
        rmssd,
        isPremature: isPrematureBeat,
        isDelayed: isDelayedBeat,
        timestamp: new Date().toISOString()
      });
    } else {
      // Decrementar gradualmente para evitar falsos positivos
      this.consecutiveAbnormalCount = Math.max(0, this.consecutiveAbnormalCount - 1);
    }
    
    // Verificar condiciones para registrar una nueva arritmia confirmada
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canRegisterNewArrhythmia = 
      timeSinceLastArrhythmia >= this.config.minTimeBetweenArrhythmias && 
      this.arrhythmiaCounter < this.config.maxArrhythmiasPerSession;
    
    // Una arritmia se confirma solo cuando hay múltiples latidos anómalos consecutivos
    // y ha pasado suficiente tiempo desde la última arritmia registrada
    if (this.consecutiveAbnormalCount >= this.CONSECUTIVE_ABNORMAL_THRESHOLD && 
        canRegisterNewArrhythmia) {
      
      // Registrar nueva arritmia
      this.arrhythmiaCounter++;
      this.lastArrhythmiaTime = currentTime;
      this.hasDetectedArrhythmia = true;
      this.consecutiveAbnormalCount = 0;
      
      // Crear ventana visual para la arritmia (1 segundo en total)
      this.visualWindow = {
        start: currentTime - 500,
        end: currentTime + 500
      };
      
      console.log("ArrhythmiaDetector: Arritmia confirmada", {
        counter: this.arrhythmiaCounter,
        rmssd,
        variation,
        timestamp: new Date().toISOString()
      });
      
      // Devolver resultado con datos de arritmia
      return {
        isArrhythmia: true,
        arrhythmiaCounter: this.arrhythmiaCounter,
        arrhythmiaStatus: `ARRITMIA DETECTADA|${this.arrhythmiaCounter}`,
        lastArrhythmiaData: {
          timestamp: currentTime,
          rmssd,
          rrVariation: variation
        },
        visualWindow: this.visualWindow
      };
    }
    
    // No hay nueva arritmia confirmada
    return this.getResult(this.hasDetectedArrhythmia ? 
      `ARRITMIA DETECTADA|${this.arrhythmiaCounter}` : 
      `SIN ARRITMIAS|${this.arrhythmiaCounter}`);
  }
  
  /**
   * Verifica si un latido en un momento específico es arrítmico
   */
  public isHeartbeatArrhythmic(timestamp: number): boolean {
    if (!this.visualWindow) return false;
    
    // Un latido es arrítmico si está dentro de la ventana visual de arritmia
    return timestamp >= this.visualWindow.start && timestamp <= this.visualWindow.end;
  }
  
  /**
   * Construye un resultado estándar
   */
  private getResult(status: string): ArrhythmiaDetectionResult {
    return {
      isArrhythmia: this.hasDetectedArrhythmia,
      arrhythmiaCounter: this.arrhythmiaCounter,
      arrhythmiaStatus: status,
      lastArrhythmiaData: null,
      visualWindow: this.visualWindow
    };
  }
  
  /**
   * Obtiene contador actual de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Establece contador de arritmias
   */
  public setArrhythmiaCounter(count: number): void {
    this.arrhythmiaCounter = count;
  }
  
  /**
   * Reinicia el detector de arritmias
   */
  public reset(): void {
    this.arrhythmiaCounter = 0;
    this.lastArrhythmiaTime = 0;
    this.consecutiveAbnormalCount = 0;
    this.isInLearningPhase = true;
    this.measurementStartTime = Date.now();
    this.hasDetectedArrhythmia = false;
    this.visualWindow = null;
    
    console.log("ArrhythmiaDetector: Sistema reiniciado", {
      timestamp: new Date().toISOString()
    });
  }
}
