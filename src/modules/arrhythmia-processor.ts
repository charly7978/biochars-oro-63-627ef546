
/**
 * Algoritmo ultra-simple para detección de arritmias
 * Diseñado para minimizar falsos positivos
 */
export class ArrhythmiaProcessor {
  // Umbrales extremadamente conservadores
  private readonly MIN_RR_INTERVALS = 20; // Necesitamos muchos datos para detectar
  private readonly MIN_INTERVAL_MS = 600; // 100 BPM máximo 
  private readonly MAX_INTERVAL_MS = 1200; // 50 BPM mínimo
  private readonly MIN_VARIATION_PERCENT = 70; // Variación extrema (70%)
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 20000; // 20 segundos entre arritmias
  
  // Estado
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private calibrationTime: number = 20000; // 20 segundos de calibración
  private isCalibrating = true;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Secuencia de confirmación de arritmias
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 15; // Muy alto para evitar falsos positivos

  /**
   * Procesa datos RR para detección ultra-conservadora de arritmias
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    const currentTime = Date.now();
    
    // Establecer período de calibración
    if (this.isCalibrating && currentTime - this.startTime >= this.calibrationTime) {
      this.isCalibrating = false;
      console.log("ArrhythmiaProcessor: Calibración completada", {
        tiempoTranscurrido: currentTime - this.startTime,
        threshold: this.calibrationTime
      });
    }
    
    // Durante calibración, solo reportamos estado
    if (this.isCalibrating) {
      return {
        arrhythmiaStatus: "CALIBRANDO...",
        lastArrhythmiaData: null
      };
    }
    
    // Actualizar intervalos RR si hay datos
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Solo proceder si tenemos suficientes intervalos
      if (this.rrIntervals.length >= this.MIN_RR_INTERVALS) {
        this.detectArrhythmia(currentTime);
      }
    }

    // Construir mensaje de estado
    const arrhythmiaStatusMessage = 
      this.arrhythmiaCount > 0 
        ? `ARRITMIA DETECTADA|${this.arrhythmiaCount}` 
        : `SIN ARRITMIAS|${this.arrhythmiaCount}`;
    
    // Información adicional solo si hay arritmia activa
    const lastArrhythmiaData = this.arrhythmiaDetected 
      ? {
          timestamp: currentTime,
          rmssd: 0, // Simplificado
          rrVariation: 0 // Simplificado
        } 
      : null;
    
    return {
      arrhythmiaStatus: arrhythmiaStatusMessage,
      lastArrhythmiaData
    };
  }

  /**
   * Algoritmo ultra-conservador para detección de arritmias
   * Diseñado para minimizar falsos positivos
   */
  private detectArrhythmia(currentTime: number): void {
    if (this.rrIntervals.length < this.MIN_RR_INTERVALS) return;
    
    // Tomar últimos intervalos para análisis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filtrar solo intervalos válidos (dentro de límites fisiológicos conservadores)
    const validIntervals = recentRR.filter(interval => 
      interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
    );
    
    // Si no hay suficientes intervalos válidos, no podemos analizar
    if (validIntervals.length < this.MIN_RR_INTERVALS * 0.8) {
      this.consecutiveAbnormalBeats = 0;
      return;
    }
    
    // Calcular promedio de intervalos válidos
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    
    // Obtener el último intervalo
    const lastRR = validIntervals[validIntervals.length - 1];
    
    // Calcular variación porcentual
    const variation = Math.abs(lastRR - avgRR) / avgRR * 100;
    
    // Detectar latido prematuro solo si la variación es extrema
    const prematureBeat = variation > this.MIN_VARIATION_PERCENT;
    
    // Actualizar contador de anomalías consecutivas
    if (prematureBeat) {
      this.consecutiveAbnormalBeats++;
      
      // Registrar detección
      console.log("ArrhythmiaProcessor: Posible latido prematuro", {
        variaciónPorcentual: variation,
        umbral: this.MIN_VARIATION_PERCENT,
        consecutivos: this.consecutiveAbnormalBeats,
        avgRR,
        lastRR,
        timestamp: currentTime
      });
    } else {
      this.consecutiveAbnormalBeats = 0;
    }
    
    // Verificar si se confirma una arritmia
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_ARRHYTHMIA_INTERVAL_MS;
    
    if (this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD && canDetectNewArrhythmia) {
      this.arrhythmiaCount++;
      this.arrhythmiaDetected = true;
      this.lastArrhythmiaTime = currentTime;
      this.consecutiveAbnormalBeats = 0;
      
      console.log("ArrhythmiaProcessor: ARRITMIA CONFIRMADA", {
        contadorArritmias: this.arrhythmiaCount,
        tiempoDesdeÚltima: timeSinceLastArrhythmia,
        timestamp: currentTime
      });
    }
  }

  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.isCalibrating = true;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTime = 0;
    this.startTime = Date.now();
    this.consecutiveAbnormalBeats = 0;
    
    console.log("ArrhythmiaProcessor: Procesador reiniciado", {
      timestamp: new Date().toISOString()
    });
  }
}
