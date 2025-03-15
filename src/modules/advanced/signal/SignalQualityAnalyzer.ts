
/**
 * Analizador de calidad de señal que evalúa genuinamente las características de la onda PPG
 */
export class SignalQualityAnalyzer {
  private signalQuality: number = 0;
  private perfusionIndex: number = 0;
  private pressureArtifactLevel: number = 0;
  
  /**
   * Analiza la calidad de la señal basada en estadísticas y características de la onda
   */
  public analyzeSignalQuality(values: number[]): number {
    if (values.length < 30) {
      return 0;
    }
    
    // Calcular estadísticas básicas de la señal
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Calcular variabilidad de la señal (desviación estándar)
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Calcular coeficiente de variación
    const cv = stdDev / mean;
    
    // Detectar picos y valles para análisis morfológico
    const peaks = this.detectPeaks(values);
    const valleys = this.detectValleys(values);
    
    // Evaluar amplitud de pulso
    let pulseAmplitude = 0;
    if (peaks.length > 0 && valleys.length > 0) {
      // Calcular amplitud promedio entre picos y valles adyacentes
      const amplitudes = [];
      for (let i = 0; i < Math.min(peaks.length, valleys.length); i++) {
        if (peaks[i] > 0 && valleys[i] > 0) {
          const amplitude = values[peaks[i]] - values[valleys[i]];
          if (amplitude > 0) {
            amplitudes.push(amplitude);
          }
        }
      }
      
      if (amplitudes.length > 0) {
        pulseAmplitude = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
      }
    }
    
    // Evaluar periodicidad (consistencia entre intervalos de picos)
    let periodicityScore = 0;
    if (peaks.length >= 3) {
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i-1]);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const intervalVariation = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
      const intervalCV = Math.sqrt(intervalVariation) / avgInterval;
      
      // Mejor periodicidad = menor coeficiente de variación
      periodicityScore = Math.max(0, 100 * (1 - Math.min(1, intervalCV)));
    }
    
    // Combinar métricas para calidad final
    let qualityScore = 0;
    
    // 1. Amplitud suficiente (30%)
    const amplitudeScore = Math.min(100, pulseAmplitude * 40);
    
    // 2. Variabilidad adecuada (30%)
    // Una señal PPG debe tener cierta variabilidad, pero no demasiada
    let variabilityScore = 0;
    if (cv < 0.01) {
      variabilityScore = 10; // Muy poca variabilidad
    } else if (cv > 0.5) {
      variabilityScore = 20; // Demasiada variabilidad
    } else {
      // Óptimo alrededor de 0.1-0.3
      variabilityScore = 100 - Math.abs(0.2 - cv) * 200;
      variabilityScore = Math.max(0, Math.min(100, variabilityScore));
    }
    
    // 3. Periodicidad (40%)
    // La calidad final combina todas las métricas
    qualityScore = (
      amplitudeScore * 0.3 +
      variabilityScore * 0.3 +
      periodicityScore * 0.4
    );
    
    // Aplicar suavizado para evitar cambios bruscos
    this.signalQuality = this.signalQuality * 0.7 + qualityScore * 0.3;
    
    return this.signalQuality;
  }
  
  /**
   * Detecta artefactos causados por variaciones de presión
   */
  public detectPressureArtifacts(values: number[]): number {
    if (values.length < 30) {
      return 0;
    }
    
    // Analizar cambios bruscos en la señal
    const recentValues = values.slice(-30);
    const diffValues = recentValues.slice(1).map((v, i) => Math.abs(v - recentValues[i]));
    const avgDiff = diffValues.reduce((a, b) => a + b, 0) / diffValues.length;
    
    // Detectar cambios de línea base
    const firstThird = values.slice(0, Math.floor(values.length / 3)).reduce((a, b) => a + b, 0) / Math.floor(values.length / 3);
    const lastThird = values.slice(-Math.floor(values.length / 3)).reduce((a, b) => a + b, 0) / Math.floor(values.length / 3);
    const baselineShift = Math.abs(lastThird - firstThird);
    
    // Calcular nivel de artefacto (0-1)
    const rawArtifactLevel = Math.min(1, (avgDiff * 3 + baselineShift * 2) / 5);
    
    // Aplicar suavizado
    this.pressureArtifactLevel = this.pressureArtifactLevel * 0.8 + rawArtifactLevel * 0.2;
    
    return this.pressureArtifactLevel;
  }
  
  /**
   * Actualiza el índice de perfusión basado en características de la onda
   */
  public updatePerfusionIndex(perfusion: number): void {
    // Aplicar un límite inferior realista y suavizado
    const newPerfusionIndex = Math.max(0.01, perfusion);
    this.perfusionIndex = this.perfusionIndex * 0.8 + newPerfusionIndex * 0.2;
  }
  
  /**
   * Getters para varias métricas de calidad
   */
  public getSignalQuality(): number {
    return this.signalQuality;
  }
  
  public getPerfusionIndex(): number {
    return this.perfusionIndex;
  }
  
  public getPressureArtifactLevel(): number {
    return this.pressureArtifactLevel;
  }
  
  /**
   * Reinicia todas las métricas de calidad
   */
  public reset(): void {
    this.signalQuality = 0;
    this.perfusionIndex = 0;
    this.pressureArtifactLevel = 0;
  }
  
  /**
   * Detecta picos en la señal
   */
  private detectPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    // Necesitamos al menos 5 puntos para detectar un pico
    if (values.length < 5) return peaks;
    
    // Buscar picos (máximos locales)
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && 
          values[i] > values[i-2] && 
          values[i] > values[i+1] && 
          values[i] > values[i+2]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Detecta valles en la señal
   */
  private detectValleys(values: number[]): number[] {
    const valleys: number[] = [];
    
    // Necesitamos al menos 5 puntos para detectar un valle
    if (values.length < 5) return valleys;
    
    // Buscar valles (mínimos locales)
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] < values[i-1] && 
          values[i] < values[i-2] && 
          values[i] < values[i+1] && 
          values[i] < values[i+2]) {
        valleys.push(i);
      }
    }
    
    return valleys;
  }
}
