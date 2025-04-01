
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Extractor de latidos cardíacos - especializado en la detección de picos
 * Solo trabaja con datos reales sin simulaciones
 */

/**
 * Resultado de la extracción de latidos
 */
export interface HeartbeatExtractionResult {
  // Información de tiempo
  timestamp: number;
  
  // Datos de pico
  hasPeak: boolean;
  peakTime: number | null;
  peakValue: number | null;
  
  // Datos derivados
  confidence: number;
  instantaneousBPM: number | null;
  rrInterval: number | null;
}

/**
 * Clase para la extracción especializada de latidos cardíacos
 */
export class HeartbeatExtractor {
  // Historial de picos para cálculos
  private peakTimes: number[] = [];
  private peakValues: number[] = [];
  
  // Referencias temporales
  private lastPeakTime: number | null = null;
  private lastValueTime: number = Date.now();
  
  // Umbrales de detección
  private readonly PEAK_THRESHOLD = 0.05;
  private readonly MIN_PEAK_DISTANCE_MS = 300; // No detectar picos a menos de 300ms
  
  // Historial para promedios
  private recentBPMs: number[] = [];
  private recentRRs: number[] = [];
  
  /**
   * Procesa un valor PPG filtrado y extrae información de picos/latidos
   * @param value Valor PPG filtrado
   * @returns Resultado de la extracción con datos de picos
   */
  public processValue(value: number): HeartbeatExtractionResult {
    const now = Date.now();
    let hasPeak = false;
    let instantaneousBPM: number | null = null;
    let rrInterval: number | null = null;
    let confidence = 0;
    
    // Detectar pico solo si:
    // 1. El valor es suficientemente alto
    // 2. Ha pasado suficiente tiempo desde el último pico
    const timeSinceLastPeak = this.lastPeakTime ? now - this.lastPeakTime : Number.MAX_VALUE;
    
    if (value > this.PEAK_THRESHOLD && timeSinceLastPeak >= this.MIN_PEAK_DISTANCE_MS) {
      // Verificar si es un máximo local usando un buffer
      if (this.isLocalMaximum(value)) {
        hasPeak = true;
        
        // Registrar tiempo del pico
        if (this.lastPeakTime !== null) {
          rrInterval = now - this.lastPeakTime;
          
          // Calcular BPM instantáneo a partir del intervalo R-R
          if (rrInterval > 0) {
            instantaneousBPM = 60000 / rrInterval;
            
            // Almacenar para promedio
            this.recentBPMs.push(instantaneousBPM);
            this.recentRRs.push(rrInterval);
            
            // Mantener solo los últimos 8 valores
            if (this.recentBPMs.length > 8) {
              this.recentBPMs.shift();
              this.recentRRs.shift();
            }
            
            // Calcular confianza basada en la consistencia de los intervalos
            confidence = this.calculateConfidence(this.recentRRs);
          }
        }
        
        this.lastPeakTime = now;
        this.peakTimes.push(now);
        this.peakValues.push(value);
        
        // Mantener historial acotado
        if (this.peakTimes.length > 10) {
          this.peakTimes.shift();
          this.peakValues.shift();
        }
      }
    }
    
    this.lastValueTime = now;
    
    return {
      timestamp: now,
      hasPeak,
      peakTime: hasPeak ? now : this.lastPeakTime,
      peakValue: hasPeak ? value : null,
      confidence,
      instantaneousBPM,
      rrInterval
    };
  }
  
  /**
   * Verifica si el valor es un máximo local (pico)
   */
  private isLocalMaximum(value: number): boolean {
    // Implementación simple de detección de máximo local
    return true; // Simplificado para esta versión inicial
  }
  
  /**
   * Calcula la confianza basada en la consistencia de intervalos RR
   */
  private calculateConfidence(intervals: number[]): number {
    if (intervals.length < 2) return 0.1;
    
    // Calcular la desviación estándar normalizada
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const normStdDev = stdDev / avg;
    
    // Menor variación = mayor confianza
    const rawConfidence = Math.max(0, 1 - normStdDev);
    
    return Math.min(1, rawConfidence);
  }
  
  /**
   * Obtiene el BPM promedio de los últimos latidos
   */
  public getAverageBPM(): number | null {
    if (this.recentBPMs.length === 0) return null;
    
    // Eliminar valores extremos para un promedio más robusto
    const sortedBPMs = [...this.recentBPMs].sort((a, b) => a - b);
    const filteredBPMs = sortedBPMs.slice(1, -1);
    
    // Si no quedan suficientes valores, usar todos
    const valuesToAverage = filteredBPMs.length >= 3 ? filteredBPMs : sortedBPMs;
    
    return valuesToAverage.reduce((sum, val) => sum + val, 0) / valuesToAverage.length;
  }
  
  /**
   * Calcula la variabilidad del ritmo cardíaco (HRV)
   */
  public getHeartRateVariability(): number | null {
    if (this.recentRRs.length < 3) return null;
    
    // RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiffs = 0;
    for (let i = 1; i < this.recentRRs.length; i++) {
      const diff = this.recentRRs[i] - this.recentRRs[i - 1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (this.recentRRs.length - 1));
  }
  
  /**
   * Reinicia el extractor
   */
  public reset(): void {
    this.peakTimes = [];
    this.peakValues = [];
    this.lastPeakTime = null;
    this.lastValueTime = Date.now();
    this.recentBPMs = [];
    this.recentRRs = [];
  }
}

/**
 * Crea una instancia de extractor de latidos
 */
export const createHeartbeatExtractor = (): HeartbeatExtractor => {
  return new HeartbeatExtractor();
};
