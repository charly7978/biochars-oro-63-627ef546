
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

export interface SignalQualityOptions {
  minQualityThreshold?: number; 
  minConsistentReadings?: number;
  stabilizationPeriod?: number;
}

/**
 * Clase para evaluar la calidad de la señal de PPG
 * Utiliza solo mediciones reales, sin simulación
 */
export class SignalQuality {
  private readonly MIN_QUALITY_THRESHOLD: number;
  private readonly MIN_CONSISTENT_READINGS: number;
  private readonly STABILIZATION_PERIOD: number;
  
  private qualityHistory: number[] = [];
  private noiseLevel: number = 0;
  private consecutiveStrongSignals: number = 0;
  private lastEvalTime: number = 0;
  
  constructor(options?: SignalQualityOptions) {
    this.MIN_QUALITY_THRESHOLD = options?.minQualityThreshold || 50;
    this.MIN_CONSISTENT_READINGS = options?.minConsistentReadings || 5;
    this.STABILIZATION_PERIOD = options?.stabilizationPeriod || 2000;
  }
  
  /**
   * Actualiza el nivel de ruido basado en la diferencia entre señal cruda y filtrada
   */
  public updateNoiseLevel(rawValue: number, filteredValue: number): void {
    const instantNoise = Math.abs(rawValue - filteredValue);
    this.noiseLevel = 0.8 * this.noiseLevel + 0.2 * instantNoise;
  }
  
  /**
   * Calcula la calidad de la señal actual (0-100)
   */
  public calculateQuality(values: number[]): number {
    if (values.length < 5) {
      return 0;
    }
    
    const recentValues = values.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    if (amplitude < 0.02) {
      this.consecutiveStrongSignals = 0;
      return 0;
    } else {
      this.consecutiveStrongSignals = Math.min(
        this.MIN_CONSISTENT_READINGS + 2,
        this.consecutiveStrongSignals + 1
      );
    }
    
    if (this.consecutiveStrongSignals < this.MIN_CONSISTENT_READINGS) {
      return 0;
    }
    
    // Calcular calidad ponderando múltiples factores
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calcular desviación estándar
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Evaluar periodicidad 
    const peakCount = countPeaks(recentValues);
    const periodicityScore = peakCount >= 2 && peakCount <= 5 ? 1 : 0.2;
    
    // Relación señal/ruido
    const signalToNoise = amplitude / (this.noiseLevel + 0.001);
    
    // Calcular calidad final (0-100)
    const quality = Math.min(100, Math.max(0, 
      (
        (amplitude / 0.2) * 30 +     // 30% por amplitud adecuada
        (1 / (stdDev + 0.001)) * 20 + // 20% por estabilidad
        signalToNoise * 30 +         // 30% por baja relación ruido
        periodicityScore * 20        // 20% por periodicidad adecuada
      )
    ));
    
    // Actualizar historial de calidad
    const now = Date.now();
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > 10) {
      this.qualityHistory.shift();
    }
    
    this.lastEvalTime = now;
    
    return Math.round(quality);
  }
  
  /**
   * Obtiene el nivel de ruido actual
   */
  public getNoiseLevel(): number {
    return this.noiseLevel;
  }
  
  /**
   * Verifica si la calidad es suficiente para mediciones confiables
   */
  public isQualitySufficient(): boolean {
    if (this.qualityHistory.length < 5) {
      return false;
    }
    
    const avgQuality = this.qualityHistory.reduce((sum, q) => sum + q, 0) / this.qualityHistory.length;
    return avgQuality >= this.MIN_QUALITY_THRESHOLD;
  }
  
  /**
   * Reinicia el estado de la evaluación de calidad
   */
  public reset(): void {
    this.qualityHistory = [];
    this.noiseLevel = 0;
    this.consecutiveStrongSignals = 0;
    this.lastEvalTime = 0;
  }
}

/**
 * Cuenta los picos en una serie de valores
 * Ayuda a determinar si hay un patrón cardíaco
 */
function countPeaks(values: number[]): number {
  let peakCount = 0;
  
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && values[i] > values[i+1]) {
      peakCount++;
    }
  }
  
  return peakCount;
}
