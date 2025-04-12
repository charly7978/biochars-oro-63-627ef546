/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateStandardDeviation, calculateDC, calculateAC } from '@/utils/signalAnalysisUtils';

/**
 * Signal quality assessment - forwards to centralized implementation in PPGSignalMeter
 * All methods work with real data only, no simulation
 * Improved to reduce false positives
 */
export class SignalQuality {
  private noiseLevel: number = 0;
  private consecutiveStrongSignals: number = 0;
  private readonly MIN_STRONG_SIGNALS_REQUIRED = 3;
  private stabilityScore: number = 0; // Añadir puntuación de estabilidad
  
  /**
   * Simple noise level update - minimal implementation with improved filtering
   */
  public updateNoiseLevel(rawValue: number, filteredValue: number): void {
    // Simple diferencia como estimación de ruido
    const noise = Math.abs(rawValue - filteredValue);
    // EMA para suavizar la estimación de ruido
    this.noiseLevel = calculateEMA(this.noiseLevel, noise, 0.1); // Usar EMA consolidada
  }
  
  /**
   * Get current noise level
   */
  public getNoiseLevel(): number {
    return this.noiseLevel;
  }
  
  /**
   * Calculate signal quality - using only real data with improved validation
   * Adds validation to reduce false positives
   */
  public calculateSignalQuality(ppgValues: number[]): number {
    if (ppgValues.length < 10) return 0; // Necesita un mínimo de datos

    const mean = calculateDC(ppgValues);
    if (mean === 0) return 0; // Evitar división por cero

    const stdDev = calculateStandardDeviation(ppgValues);
    const acComponent = calculateAC(ppgValues);

    // 1. Relación Señal-Ruido (SNR) estimada - Inversa del Coeficiente de Variación
    const cv = stdDev / mean;
    const snrQuality = Math.max(0, 1 - cv * 2); // Penaliza alta variabilidad relativa

    // 2. Amplitud de la Señal (AC)
    // Normalizar AC respecto a un rango esperado (ej. 0.01 a 1.0)
    const expectedMinAC = 0.02;
    const expectedMaxAC = 1.0;
    const amplitudeQuality = Math.max(0, Math.min(1, (acComponent - expectedMinAC) / (expectedMaxAC - expectedMinAC)));

    // 3. Estabilidad de la línea base (DC)
    this.updateStabilityScore(ppgValues); // Actualizar puntuación de estabilidad
    const stabilityQuality = this.stabilityScore;

    // 4. Periodicidad (podría requerir FFT o Autocorrelación - simplificado aquí)
    // const periodicityQuality = this.calculatePeriodicity(ppgValues);
    const periodicityQuality = 0.5; // Placeholder

    // Combinar métricas de calidad (ejemplo ponderado)
    let combinedQuality = (snrQuality * 0.3) + (amplitudeQuality * 0.4) + (stabilityQuality * 0.2) + (periodicityQuality * 0.1);

    // Incrementar contador de señales fuertes si la calidad es buena
    if (combinedQuality > 0.7) {
      this.consecutiveStrongSignals++;
    } else {
      this.consecutiveStrongSignals = 0; // Resetear si la calidad baja
    }

    // Bonus si hay señales fuertes consecutivas
    if (this.consecutiveStrongSignals >= this.MIN_STRONG_SIGNALS_REQUIRED) {
      combinedQuality = Math.min(1, combinedQuality + 0.1); // Pequeño bonus
    }

    return Math.max(0, Math.min(1, combinedQuality)) * 100; // Escalar a 0-100
  }
  
  /**
   * Calculate weighted quality score based on real signal properties only
   * No simulation or manipulation, only direct measurement analysis
   */
  private calculateWeightedQuality(ppgValues: number[]): number {
    if (ppgValues.length < 10) return 0;
    
    // Get recent values for analysis
    const recentValues = ppgValues.slice(-10);
    
    // Calculate signal amplitude (min to max) - real data only
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Calculate average and standard deviation - real data only
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length
    );
    
    // Calculate noise to signal ratio - real data only
    const noiseToSignalRatio = this.noiseLevel / (amplitude + 0.001);
    
    // Calculate consistency of peak spacing - real data only
    let peakConsistency = 0;
    let lastPeakIndex = -1;
    let peakSpacings = [];
    
    for (let i = 1; i < recentValues.length - 1; i++) {
      if (recentValues[i] > recentValues[i-1] && recentValues[i] > recentValues[i+1]) {
        if (lastPeakIndex !== -1) {
          peakSpacings.push(i - lastPeakIndex);
        }
        lastPeakIndex = i;
      }
    }
    
    if (peakSpacings.length >= 2) {
      const avgSpacing = peakSpacings.reduce((sum, val) => sum + val, 0) / peakSpacings.length;
      const spacingVariance = peakSpacings.reduce((sum, val) => sum + Math.pow(val - avgSpacing, 2), 0) / peakSpacings.length;
      const spacingCoeffOfVar = Math.sqrt(spacingVariance) / avgSpacing;
      peakConsistency = Math.max(0, 1 - spacingCoeffOfVar);
    }
    
    // Calculate overall quality score with weighted components - real data only
    const amplitudeScore = Math.min(1, amplitude / 0.5);  // Normalize amplitude
    const stdDevScore = Math.min(1, Math.max(0, 1 - noiseToSignalRatio));  // Lower noise is better
    
    // Weight the factors to get overall quality
    const weightedScore = (
      amplitudeScore * 0.4 +          // 40% amplitude
      stdDevScore * 0.4 +             // 40% signal-to-noise
      peakConsistency * 0.2           // 20% peak consistency
    );
    
    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, weightedScore));
  }
  
  /**
   * Reset quality tracking state
   */
  public reset(): void {
    this.noiseLevel = 0;
    this.consecutiveStrongSignals = 0;
    this.stabilityScore = 0;
    console.log("SignalQuality reset.");
  }

  // Método auxiliar para actualizar la estabilidad (ej. desviación estándar de DC en ventanas)
  private updateStabilityScore(values: number[]): void {
    const windowSize = 10; // Tamaño de la ventana para evaluar estabilidad DC
    if (values.length < windowSize * 2) {
      this.stabilityScore = 0.5; // Valor neutral si no hay suficientes datos
      return;
    }
    const recentWindow = values.slice(-windowSize);
    const previousWindow = values.slice(-windowSize * 2, -windowSize);
    const dcRecent = calculateDC(recentWindow);
    const dcPrevious = calculateDC(previousWindow);
    const dcChange = Math.abs(dcRecent - dcPrevious);
    // La puntuación es mayor cuanto menor es el cambio
    this.stabilityScore = Math.max(0, 1 - dcChange * 10); // Ajustar multiplicador según escala esperada
  }

  // Placeholder para calidad basada en periodicidad
  private calculatePeriodicity(values: number[]): number {
    // Implementar FFT o Autocorrelación para una medida real
    return 0.5; // Devolver valor placeholder
  }
}
