
/**
 * Enhanced Arrhythmia Detector Module
 * Implements multiple algorithms for improved detection accuracy
 */
export class ArrhythmiaDetector {
  private readonly RMSSD_THRESHOLD = 12; // Reducido para mejor sensibilidad
  private readonly RR_VARIATION_THRESHOLD = 0.12; // Reducido para detectar variaciones más sutiles
  private readonly MIN_TIME_BETWEEN_DETECTIONS = 1500; // Aumentado para reducir falsos positivos
  
  private lastArrhythmiaTime: number = 0;
  private lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null = null;
  
  constructor() {
    console.log("ArrhythmiaDetector: Initialized with enhanced sensitivity");
  }
  
  /**
   * Process RR intervals to detect arrhythmias with multiple algorithms
   */
  public processRRIntervals(intervals: number[]): {
    isArrhythmia: boolean;
    rmssd: number;
    rrVariation: number;
  } {
    // Need at least 3 intervals for analysis
    if (intervals.length < 3) {
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0 };
    }
    
    // Use the most recent intervals for analysis
    const recentIntervals = intervals.slice(-5);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let rmssd = this.calculateRMSSD(recentIntervals);
    
    // Calculate average RR interval with más peso a los intervalos recientes
    let avgRR = 0;
    let weightSum = 0;
    for (let i = 0; i < recentIntervals.length; i++) {
      const weight = i + 1; // Mayor peso a valores más recientes
      avgRR += recentIntervals[i] * weight;
      weightSum += weight;
    }
    avgRR = avgRR / weightSum;
    
    // Calculate variation from the last interval to the average
    const lastRR = recentIntervals[recentIntervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Check if enough time has passed since last detection
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.lastArrhythmiaTime;
    
    // Multi-criteria detection algorithm
    const isArrhythmiaRMSSD = rmssd > this.RMSSD_THRESHOLD;
    const isArrhythmiaVariation = rrVariation > this.RR_VARIATION_THRESHOLD;
    
    // Detección de taquicardia y bradicardia severas (umbrales más permisivos)
    const isExtremeTachycardia = lastRR < 0.7 * avgRR; // 30% más rápido que promedio
    const isExtremeBradycardia = lastRR > 1.3 * avgRR; // 30% más lento que promedio
    
    // Combined detection logic - Lógica combinada más sensible
    const isArrhythmia = 
      (isArrhythmiaRMSSD || isArrhythmiaVariation) || 
      isExtremeTachycardia || 
      isExtremeBradycardia;
    
    // Solo registrar si pasó suficiente tiempo desde la última detección
    if (isArrhythmia && timeSinceLastDetection >= this.MIN_TIME_BETWEEN_DETECTIONS) {
      this.lastArrhythmiaTime = currentTime;
      this.lastArrhythmiaData = {
        timestamp: currentTime,
        rmssd,
        rrVariation
      };
      
      // Log detallado para diagnóstico
      console.log("ArrhythmiaDetector: Arritmia detectada", {
        rmssd,
        rrVariation,
        isExtremeTachycardia,
        isExtremeBradycardia,
        avgRR,
        lastRR,
        ultimosIntervalos: recentIntervals
      });
    }
    
    return { isArrhythmia, rmssd, rrVariation };
  }
  
  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences)
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiffs = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (intervals.length - 1));
  }
  
  /**
   * Get information about the last detected arrhythmia
   */
  public getLastArrhythmiaData(): {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null {
    return this.lastArrhythmiaData;
  }
  
  /**
   * Reset the detector state
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.lastArrhythmiaData = null;
  }
}
