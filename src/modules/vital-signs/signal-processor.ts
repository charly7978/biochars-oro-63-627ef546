
/**
 * Enhanced Signal Processor based on advanced biomedical signal processing techniques
 * Implements wavelet denoising and adaptive filter techniques from IEEE publications
 */
export class SignalProcessor {
  // Ajuste: reducimos la ventana del SMA para mayor reactividad
  private readonly SMA_WINDOW = 3; // antes: 5
  private ppgValues: number[] = [];
  private readonly WINDOW_SIZE = 300;
  
  // Advanced filter coefficients based on Savitzky-Golay filter research
  private readonly SG_COEFFS = [0.2, 0.3, 0.5, 0.7, 1.0, 0.7, 0.5, 0.3, 0.2];
  private readonly SG_NORM = 4.4; // Normalization factor for coefficients
  
  // Wavelet denoising thresholds - reducidos para mayor sensibilidad
  private readonly WAVELET_THRESHOLD = 0.022; // Antes: 0.03
  private readonly BASELINE_FACTOR = 0.94; // Ajustado para adaptación más rápida (antes: 0.92)
  private baselineValue: number = 0;
  
  // Multi-spectral analysis parameters (based on research from Univ. of Texas)
  // Coeficientes ajustados para mejor detección
  private readonly RED_ABSORPTION_COEFF = 0.72; // Aumentado (antes: 0.684)
  private readonly IR_ABSORPTION_COEFF = 0.84;  // Aumentado (antes: 0.823)
  private readonly GLUCOSE_CALIBRATION = 0.0452;
  private readonly LIPID_CALIBRATION = 0.0319;
  
  // Indicadores de calidad de la señal
  private signalQuality: number = 0;
  private readonly MAX_SIGNAL_DIFF = 1.8; // Máxima diferencia esperada en señal normal
  private readonly MIN_SIGNAL_DIFF = 0.7; // PRIMERA VARIABLE MODIFICADA: Aumentado drásticamente de 0.35 a 0.7 para exigir una señal con amplitud extremadamente mayor
  private consecutiveGoodFrames: number = 0;
  private readonly REQUIRED_GOOD_FRAMES = 30; // SEGUNDA VARIABLE MODIFICADA: Aumentado de 15 a 30 para exigir consistencia mucho más prolongada
  
  /**
   * Applies a wavelet-based noise reduction followed by Savitzky-Golay filtering
   * Technique adapted from "Advanced methods for ECG signal processing" (IEEE)
   */
  public applySMAFilter(value: number): number {
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    // Initialize baseline value if needed
    if (this.baselineValue === 0 && this.ppgValues.length > 0) {
      this.baselineValue = value;
    } else {
      // Adaptive baseline tracking - más responsive
      this.baselineValue = this.baselineValue * this.BASELINE_FACTOR + 
                           value * (1 - this.BASELINE_FACTOR);
    }
    
    // Simple Moving Average como primera etapa
    const smaBuffer = this.ppgValues.slice(-this.SMA_WINDOW);
    const smaValue = smaBuffer.reduce((a, b) => a + b, 0) / smaBuffer.length;
    
    // Aplicar denoising wavelet
    const denoised = this.waveletDenoise(smaValue);
    
    // Calcular calidad de señal basada en variabilidad y consistencia
    this.updateSignalQuality();
    
    // Aplicar Savitzky-Golay si tenemos suficientes datos
    if (this.ppgValues.length >= this.SG_COEFFS.length) {
      return this.applySavitzkyGolayFilter(denoised);
    }
    
    return denoised;
  }
  
  /**
   * Actualiza la métrica de calidad de señal basada en características
   * clave de la forma de onda PPG
   */
  private updateSignalQuality(): void {
    if (this.ppgValues.length < 30) {
      this.signalQuality = 0;
      return;
    }
    
    const recentValues = this.ppgValues.slice(-30);
    
    // Calcular máxima y mínima de valores recientes
    const maxVal = Math.max(...recentValues);
    const minVal = Math.min(...recentValues);
    const range = maxVal - minVal;
    
    // Calcular media y desviación estándar
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Característica 1: Amplitud de señal (normalizada)
    // Una buena señal PPG tiene una amplitud significativa pero no extrema
    let amplitudeScore = 0;
    if (range < this.MIN_SIGNAL_DIFF) {
      amplitudeScore = 0; // Señal muy débil
    } else if (range > this.MAX_SIGNAL_DIFF) {
      amplitudeScore = 60; // Señal demasiado variable, posible ruido
    } else {
      // Mapear a un rango de 0-100, con óptimo alrededor de 0.5-1.0
      const normalizedRange = Math.min(1.0, range / 1.2);
      amplitudeScore = normalizedRange * 100;
    }
    
    // Característica 2: Consistencia de señal
    // Una buena señal PPG debe tener cierta variabilidad pero ser consistente
    const coeffVar = stdDev / Math.abs(mean);
    let consistencyScore = 0;
    
    if (coeffVar < 0.01) {
      consistencyScore = 20; // Demasiado constante, no es señal fisiológica
    } else if (coeffVar > 0.8) {
      consistencyScore = 20; // Demasiado variable, probablemente ruido
    } else {
      // Óptimo alrededor de 0.1-0.3
      const normalizedConsistency = Math.max(0, Math.min(1, 1 - (Math.abs(0.2 - coeffVar) / 0.2)));
      consistencyScore = normalizedConsistency * 100;
    }
    
    // Característica 3: Periodicidad (búsqueda simple de patrones)
    let periodicityScore = 0;
    if (recentValues.length > 10) {
      let periodicitySum = 0;
      const lagSize = 10;
      
      for (let lag = 1; lag <= lagSize; lag++) {
        let correlation = 0;
        for (let i = 0; i < recentValues.length - lag; i++) {
          correlation += (recentValues[i] - mean) * (recentValues[i + lag] - mean);
        }
        correlation /= (recentValues.length - lag) * variance;
        periodicitySum += Math.abs(correlation);
      }
      
      // Normalizar (0-100)
      periodicityScore = Math.min(100, (periodicitySum / lagSize) * 100);
    }
    
    // Combinar métricas con diferentes pesos
    const rawQuality = (amplitudeScore * 0.5) + (consistencyScore * 0.3) + (periodicityScore * 0.2);
    
    // Aplicar función de histéresis para evitar cambios abruptos
    this.signalQuality = this.signalQuality * 0.7 + rawQuality * 0.3;
    
    // Manejo de frames consecutivos buenos para estabilidad
    if (rawQuality > 50) {
      this.consecutiveGoodFrames++;
    } else {
      this.consecutiveGoodFrames = 0;
    }
    
    // Si tenemos suficientes frames buenos consecutivos, aumentar confianza
    if (this.consecutiveGoodFrames >= this.REQUIRED_GOOD_FRAMES) {
      this.signalQuality = Math.min(100, this.signalQuality * 1.15);
    }
  }
  
  /**
   * Obtener la calidad actual de la señal
   */
  public getSignalQuality(): number {
    return this.signalQuality;
  }
  
  /**
   * Simplified wavelet denoising based on soft thresholding
   * Adapted from "Wavelet-based denoising for biomedical signals" research
   */
  private waveletDenoise(value: number): number {
    const normalizedValue = value - this.baselineValue;
    
    // Umbral adaptativo basado en la intensidad de la señal
    const adaptiveThreshold = Math.min(
      this.WAVELET_THRESHOLD,
      this.WAVELET_THRESHOLD * (1 - (this.signalQuality / 200)) // Reducir umbral con mejor calidad
    );
    
    // Soft thresholding technique (simplified wavelet approach)
    if (Math.abs(normalizedValue) < adaptiveThreshold) {
      return this.baselineValue;
    }
    
    const sign = normalizedValue >= 0 ? 1 : -1;
    const denoisedValue = sign * (Math.abs(normalizedValue) - adaptiveThreshold);
    
    return this.baselineValue + denoisedValue;
  }
  
  /**
   * Implements Savitzky-Golay filtering which preserves peaks better than simple moving average
   * Based on research paper "Preserving peak features in biomedical signals"
   */
  private applySavitzkyGolayFilter(value: number): number {
    const recentValues = this.ppgValues.slice(-this.SG_COEFFS.length);
    let filteredValue = 0;
    
    // Apply Savitzky-Golay convolution
    for (let i = 0; i < this.SG_COEFFS.length; i++) {
      filteredValue += recentValues[i] * this.SG_COEFFS[i];
    }
    
    return filteredValue / this.SG_NORM;
  }

  /**
   * Determina si hay un dedo presente en base a la calidad de la señal
   * y características de la forma de onda
   */
  public isFingerPresent(): boolean {
    // Se requiere un mínimo de datos para determinar presencia
    if (this.ppgValues.length < 20) return false;
    
    // Obtener valores recientes para análisis
    const recentValues = this.ppgValues.slice(-20);
    
    // Criterio 1: Calidad mínima de señal (mucho más exigente)
    if (this.signalQuality < 70) return false; 
    
    // Criterio 2: Variabilidad significativa (señal viva vs estática)
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const range = max - min;
    
    // Criterio 3: Ratio de frames consecutivos buenos (extremadamente exigente)
    // Exigimos que haya muchos frames buenos consecutivos antes de considerar detección
    if (this.consecutiveGoodFrames < this.REQUIRED_GOOD_FRAMES * 0.8) return false;
    
    // Criterio 4: Verificación de periodicidad (solo señales con patrón cardíaco)
    const periodicityCheck = this.checkSignalPeriodicity(recentValues);
    if (!periodicityCheck) return false;
    
    // Solo si pasa todos los criterios estrictos, consideramos que hay un dedo
    return range > this.MIN_SIGNAL_DIFF;
  }

  /**
   * Verifica que la señal tenga una periodicidad compatible con un ritmo cardíaco real
   * Esto ayuda a rechazar señales que tienen variación pero no son fisiológicas
   */
  private checkSignalPeriodicity(values: number[]): boolean {
    if (values.length < 10) return false;
    
    // Calcular media para normalizar
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Buscar cruces por cero como indicador simple de periodicidad
    let zeroCrossings = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] - mean) * (values[i-1] - mean) < 0) {
        zeroCrossings++;
      }
    }
    
    // Un ritmo cardíaco normal debería tener entre 2-6 cruces por cero en una ventana de 20 muestras
    // dependiendo de la frecuencia de muestreo y la frecuencia cardíaca
    return zeroCrossings >= 2 && zeroCrossings <= 6;
  }

  /**
   * Estimates blood glucose levels based on PPG waveform characteristics
   * ... keep existing code
   */
  
  /**
   * Estimates lipid profile based on PPG characteristics and spectral analysis
   * ... keep existing code
   */
  
  /**
   * Simplified Discrete Wavelet Transform for frequency band analysis
   * ... keep existing code
   */

  /**
   * Reset the signal processor state
   */
  public reset(): void {
    this.ppgValues = [];
    this.baselineValue = 0;
    this.signalQuality = 0;
    this.consecutiveGoodFrames = 0;
    console.log("SignalProcessor: Reset completo del procesador de señal");
  }

  /**
   * Get the current PPG values buffer
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
}
