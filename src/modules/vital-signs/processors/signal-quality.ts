
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal quality assessment - versión mejorada
 * All methods work with real data only, no simulation
 * Optimizada para detectar señal de calidad con mayor precisión
 */
export class SignalQuality {
  private noiseLevel: number = 0;
  private consecutiveStrongSignals: number = 0;
  private readonly MIN_STRONG_SIGNALS_REQUIRED = 4; // Reducido para respuesta más rápida
  private readonly MAX_STRONG_SIGNAL_COUNT = 10; // Nuevo límite para estabilidad
  
  // Nuevos parámetros para análisis avanzado
  private recentAmplitudes: number[] = [];
  private readonly AMPLITUDE_HISTORY_LENGTH = 5;
  private readonly MIN_ACCEPTABLE_AMPLITUDE = 0.015;  // Umbral mínimo de amplitud
  private readonly SNR_THRESHOLD = 3.5;               // Umbral de relación señal/ruido
  
  /**
   * Simple noise level update - implementación mejorada con filtro adaptativo
   */
  public updateNoiseLevel(rawValue: number, filteredValue: number): void {
    // Noise is estimated as the difference between raw and filtered
    const instantNoise = Math.abs(rawValue - filteredValue);
    
    // Update noise level with adaptive smoothing
    // Adaptación más rápida para menor ruido, más lenta para ruido alto
    const alpha = this.noiseLevel > 0.1 ? 0.05 : 0.15;
    this.noiseLevel = alpha * instantNoise + (1 - alpha) * this.noiseLevel;
    
    // Registrar nueva amplitud para análisis histórico
    if (this.recentAmplitudes.length >= this.AMPLITUDE_HISTORY_LENGTH) {
      this.recentAmplitudes.shift();
    }
    this.recentAmplitudes.push(Math.abs(filteredValue));
  }
  
  /**
   * Get current noise level
   */
  public getNoiseLevel(): number {
    return this.noiseLevel;
  }
  
  /**
   * Calculate signal quality - using only real data with improved validation
   * Algoritmo mejorado para reducir falsos positivos y aumentar precisión
   */
  public calculateSignalQuality(ppgValues: number[]): number {
    if (ppgValues.length < 5) {
      return 0;
    }
    
    const recentPpgValues = ppgValues.slice(-15); // Aumentado a 15 para mejor análisis
    
    const min = Math.min(...recentPpgValues);
    const max = Math.max(...recentPpgValues);
    const amplitude = max - min;
    
    // Nueva verificación de amplitud mínima con criterio más estricto
    if (amplitude < this.MIN_ACCEPTABLE_AMPLITUDE) {
      this.consecutiveStrongSignals = Math.max(0, this.consecutiveStrongSignals - 1);
      return 0;
    } else {
      this.consecutiveStrongSignals = Math.min(
        this.MAX_STRONG_SIGNAL_COUNT,
        this.consecutiveStrongSignals + 1
      );
    }
    
    if (this.consecutiveStrongSignals < this.MIN_STRONG_SIGNALS_REQUIRED) {
      return 0;
    }
    
    // Nueva verificación de SNR
    const signalToNoiseRatio = amplitude / (this.noiseLevel + 0.001);
    if (signalToNoiseRatio < this.SNR_THRESHOLD) {
      return Math.round(50 * (signalToNoiseRatio / this.SNR_THRESHOLD));
    }
    
    // Análisis de periodicidad como componente de calidad
    const periodicityScore = this.analyzeSignalPeriodicity(recentPpgValues);
    
    // Análisis de consistencia de amplitud en ventana histórica
    const amplitudeConsistencyScore = this.calculateAmplitudeConsistency();
    
    const weightedQuality = this.calculateWeightedQuality(ppgValues, signalToNoiseRatio, periodicityScore, amplitudeConsistencyScore);
    
    return Math.round(weightedQuality);
  }
  
  /**
   * Nuevo método: Analiza la periodicidad de la señal
   * Un factor crítico para determinar si la señal es un PPG válido
   */
  private analyzeSignalPeriodicity(values: number[]): number {
    if (values.length < 10) return 0.5;
    
    // Conteo de cruces por cero para estimar periodicidad
    let zeroCrossings = 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    for (let i = 1; i < values.length; i++) {
      if ((values[i-1] < mean && values[i] >= mean) || 
          (values[i-1] >= mean && values[i] < mean)) {
        zeroCrossings++;
      }
    }
    
    // Una señal PPG típica debe tener una periodicidad razonable
    // Pocos cruces = señal DC, muchos cruces = ruido aleatorio
    const crossingsPerPeriod = zeroCrossings / (values.length / 10);
    
    // Señal ideal: aproximadamente 2 cruces por período
    if (crossingsPerPeriod < 0.5 || crossingsPerPeriod > 6) {
      return 0.2; // Mala periodicidad
    } else if (crossingsPerPeriod > 1.5 && crossingsPerPeriod < 3.5) {
      return 1.0; // Periodicidad ideal
    } else {
      return 0.6; // Periodicidad aceptable
    }
  }
  
  /**
   * Nuevo método: Analiza la consistencia de amplitud a lo largo del tiempo
   * Las señales PPG válidas tienen amplitud razonablemente constante
   */
  private calculateAmplitudeConsistency(): number {
    if (this.recentAmplitudes.length < 3) return 0.5;
    
    const mean = this.recentAmplitudes.reduce((sum, val) => sum + val, 0) / this.recentAmplitudes.length;
    const variance = this.recentAmplitudes.reduce((sum, val) => sum + Math.pow((val - mean) / mean, 2), 0) 
                     / this.recentAmplitudes.length;
    
    // Baja varianza = señal consistente = mejor calidad
    return Math.max(0, Math.min(1, 1 - Math.sqrt(variance)));
  }
  
  /**
   * Calculate weighted quality score based on real signal properties only
   * No simulation or manipulation, only direct measurement analysis
   * Versión mejorada con múltiples factores de calidad
   */
  private calculateWeightedQuality(ppgValues: number[], snr: number, periodicityScore: number, amplitudeConsistency: number): number {
    if (ppgValues.length < 10) return 0;
    
    const recentValues = ppgValues.slice(-15);
    
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length
    );
    
    let peakConsistency = 0;
    let lastPeakIndex = -1;
    let peakSpacings = [];
    
    for (let i = 2; i < recentValues.length - 2; i++) {
      if (recentValues[i] > recentValues[i-1] && 
          recentValues[i] > recentValues[i-2] &&
          recentValues[i] > recentValues[i+1] &&
          recentValues[i] > recentValues[i+2]) {
        if (lastPeakIndex !== -1) {
          peakSpacings.push(i - lastPeakIndex);
        }
        lastPeakIndex = i;
      }
    }
    
    if (peakSpacings.length >= 2) {
      const avgSpacing = peakSpacings.reduce((sum, val) => sum + val, 0) / peakSpacings.length;
      const spacingStdDev = Math.sqrt(peakSpacings.reduce((sum, val) => sum + Math.pow(val - avgSpacing, 2), 0) / peakSpacings.length);
      const spacingCoeffOfVar = avgSpacing > 0 ? spacingStdDev / avgSpacing : 1;
      peakConsistency = Math.max(0, 1 - spacingCoeffOfVar);
    }
    
    // Factores de calidad mejorados
    const amplitudeScore = Math.min(1, amplitude / 0.15); 
    const snrScore = Math.min(1, Math.max(0, (snr - 1) / 5));
    
    // Ponderación multi-factor mejorada
    const weightedScore = (
      amplitudeScore * 0.30 +
      snrScore * 0.25 +
      peakConsistency * 0.15 +
      periodicityScore * 0.20 +
      amplitudeConsistency * 0.10
    );
    
    // Amplificar suavemente puntuaciones altas para mayor contraste
    const boostedScore = weightedScore < 0.7 
      ? weightedScore 
      : 0.7 + (weightedScore - 0.7) * 1.5;
    
    return Math.max(0, Math.min(1, boostedScore)) * 100;
  }
  
  /**
   * Reset quality tracking state
   */
  public reset(): void {
    this.noiseLevel = 0;
    this.consecutiveStrongSignals = 0;
    this.recentAmplitudes = [];
  }
}
