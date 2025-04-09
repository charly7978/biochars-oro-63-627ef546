
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Detector de arritmias basado en análisis de intervalos RR
 */
export class ArrhythmiaDetector {
  private readonly NORMAL_VARIATION_THRESHOLD = 0.15;
  private readonly MIN_INTERVALS = 5;
  private readonly MAX_INTERVALS = 20;
  
  private rrHistory: number[] = [];
  private arrhythmiaCounter: number = 0;
  private consistencyCounter: number = 0;
  
  constructor() {
    console.log("ArrhythmiaDetector: Initialized");
  }
  
  /**
   * Detecta arritmias basado en intervalos RR
   * 
   * @param timestamp Tiempo actual
   * @param intervals Intervalos RR recientes
   * @returns true si se detecta una arritmia, false en caso contrario
   */
  public detectArrhythmia(timestamp: number, intervals: number[]): boolean {
    if (!intervals || intervals.length < this.MIN_INTERVALS) {
      return false;
    }
    
    // Tomar los últimos N intervalos para análisis
    const recentIntervals = intervals.slice(-this.MIN_INTERVALS);
    
    // Actualizar historial de intervalos
    this.rrHistory.push(...recentIntervals);
    if (this.rrHistory.length > this.MAX_INTERVALS) {
      this.rrHistory.splice(0, this.rrHistory.length - this.MAX_INTERVALS);
    }
    
    // Calcular estadísticas básicas
    const mean = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    
    // Calcular variabilidad (desviación estándar / media)
    let varianceSum = 0;
    for (const interval of recentIntervals) {
      varianceSum += Math.pow(interval - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / recentIntervals.length);
    const variability = stdDev / mean;
    
    // Calcular diferencias sucesivas (RMSSD simplificado)
    let diffSum = 0;
    for (let i = 1; i < recentIntervals.length; i++) {
      diffSum += Math.pow(recentIntervals[i] - recentIntervals[i-1], 2);
    }
    const rmssd = Math.sqrt(diffSum / (recentIntervals.length - 1));
    const normalizedRmssd = rmssd / mean;
    
    // Determinar si hay arritmia basado en variabilidad y RMSSD
    const isHighVariability = variability > this.NORMAL_VARIATION_THRESHOLD;
    const isIrregular = normalizedRmssd > this.NORMAL_VARIATION_THRESHOLD * 1.2;
    
    // Actualizar contador de consistencia
    if (isHighVariability || isIrregular) {
      this.consistencyCounter = Math.max(0, this.consistencyCounter - 1);
    } else {
      this.consistencyCounter = Math.min(10, this.consistencyCounter + 1);
    }
    
    // Solo reportar arritmia si hay suficiente consistencia
    const isArrhythmia = (isHighVariability || isIrregular) && this.consistencyCounter < 5;
    
    if (isArrhythmia) {
      this.arrhythmiaCounter++;
    }
    
    return isArrhythmia;
  }
  
  /**
   * Reinicia el detector de arritmias
   */
  public reset(): void {
    this.rrHistory = [];
    this.arrhythmiaCounter = 0;
    this.consistencyCounter = 0;
  }
  
  /**
   * Obtiene el contador de arritmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
}
