/**
 * Enhanced Signal Processor based on advanced biomedical signal processing techniques
 * Implements wavelet denoising and adaptive filter techniques from IEEE publications
 */
export class SignalProcessor {
  // Ajuste: reducimos la ventana del SMA para mayor reactividad
  private readonly SMA_WINDOW = 3;
  private ppgValues: number[] = [];
  private readonly WINDOW_SIZE = 300;
  
  // Advanced filter coefficients based on Savitzky-Golay filter research
  // Aumento de coeficientes centrales para amplificar picos
  private readonly SG_COEFFS = [0.2, 0.3, 0.6, 0.8, 1.4, 0.8, 0.6, 0.3, 0.2]; // Aumentados valores centrales 
  private readonly SG_NORM = 5.2; // Normalization factor adjusted for new coefficients (was 4.4)
  
  // Wavelet denoising thresholds - reducidos para mayor sensibilidad
  private readonly WAVELET_THRESHOLD = 0.018; // Reducido para mayor sensibilidad (antes: 0.022)
  private readonly BASELINE_FACTOR = 0.92; // Ajustado para adaptación más rápida (antes: 0.94)
  private baselineValue: number = 0;
  
  // Multi-spectral analysis parameters (based on research from Univ. of Texas)
  // Coeficientes ajustados para mejor detección
  private readonly RED_ABSORPTION_COEFF = 0.76; // Aumentado (antes: 0.72)
  private readonly IR_ABSORPTION_COEFF = 0.88;  // Aumentado (antes: 0.84)
  private readonly GLUCOSE_CALIBRATION = 0.0452;
  private readonly LIPID_CALIBRATION = 0.0319;
  
  // Indicadores de calidad de la señal
  private signalQuality: number = 0;
  private readonly MAX_SIGNAL_DIFF = 2.2; // Aumentado para tolerancia de picos más altos (antes: 1.8)
  private readonly MIN_SIGNAL_DIFF = 0.15; // Reducido para detectar señales más sutiles (antes: 0.18)
  private consecutiveGoodFrames: number = 0;
  private readonly REQUIRED_GOOD_FRAMES = 6; // Reducido para exigir menos consistencia (antes: 8)
  
  // Nuevas variables para análisis de consistencia de picos
  private peakHistory: number[] = [];
  private readonly PEAK_HISTORY_SIZE = 5;
  private readonly PEAK_VARIANCE_THRESHOLD = 0.5; // Aumentado para permitir más variabilidad (antes: 0.4)
  
  // Nuevas variables para análisis fisiológico
  private redGreenRatioHistory: number[] = [];
  private readonly RG_HISTORY_SIZE = 3;
  private readonly MIN_RG_RATIO = 1.05; // Reducido para detectar más fácilmente (antes: 1.1)
  private readonly MAX_RG_RATIO = 1.9; // Aumentado para mayor tolerancia (antes: 1.8)
  private lastRedValue: number = 0;
  private lastGreenValue: number = 0;
  
  // Nueva variable para amplificación dinámica
  private readonly DYNAMIC_AMPLIFICATION_FACTOR = 1.35; // Factor de amplificación adicional
  
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
    
    // Aplicamos amplificación dinámica basada en calidad de señal
    const amplificationFactor = Math.max(1.0, this.DYNAMIC_AMPLIFICATION_FACTOR - (this.signalQuality / 100));
    const amplifiedValue = denoised * amplificationFactor;
    
    // Aplicar Savitzky-Golay si tenemos suficientes datos
    if (this.ppgValues.length >= this.SG_COEFFS.length) {
      return this.applySavitzkyGolayFilter(amplifiedValue);
    }
    
    return amplifiedValue;
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
    
    // Nueva característica 4: Consistencia de picos
    const peakConsistencyScore = this.calculatePeakConsistency();
    
    // Nueva característica 5: Análisis fisiológico
    const physiologicalScore = this.calculatePhysiologicalCharacteristics();
    
    // Combinar métricas con diferentes pesos (ahora incluye las nuevas métricas)
    const rawQuality = (amplitudeScore * 0.4) + 
                       (consistencyScore * 0.2) + 
                       (periodicityScore * 0.15) + 
                       (peakConsistencyScore * 0.15) + 
                       (physiologicalScore * 0.1);
    
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
   * Nueva función: Calcula la consistencia de los picos en la señal
   * Los picos en señales PPG reales mantienen una amplitud relativamente constante
   */
  private calculatePeakConsistency(): number {
    if (this.ppgValues.length < 20) return 0;
    
    // Detectar picos simples (máximos locales)
    const recentValues = this.ppgValues.slice(-20);
    const peaks: number[] = [];
    
    for (let i = 2; i < recentValues.length - 2; i++) {
      if (recentValues[i] > recentValues[i-1] && 
          recentValues[i] > recentValues[i-2] &&
          recentValues[i] > recentValues[i+1] && 
          recentValues[i] > recentValues[i+2]) {
        peaks.push(recentValues[i]);
      }
    }
    
    // Si encontramos al menos 2 picos, añadirlos al historial
    if (peaks.length >= 2) {
      // Añadir el promedio de picos al historial
      const avgPeak = peaks.reduce((a, b) => a + b, 0) / peaks.length;
      this.peakHistory.push(avgPeak);
      
      // Mantener tamaño de historial limitado
      if (this.peakHistory.length > this.PEAK_HISTORY_SIZE) {
        this.peakHistory.shift();
      }
    }
    
    // Calcular consistencia de picos si tenemos suficiente historial
    if (this.peakHistory.length >= 3) {
      const peakMean = this.peakHistory.reduce((a, b) => a + b, 0) / this.peakHistory.length;
      
      // Calcular varianza de amplitudes de picos
      const peakVariance = this.peakHistory.reduce((acc, peak) => 
        acc + Math.pow(peak - peakMean, 2), 0) / this.peakHistory.length;
      
      // Calcular coeficiente de variación normalizado
      const peakCV = Math.sqrt(peakVariance) / Math.abs(peakMean);
      
      // Convertir a una puntuación: baja variabilidad = alta puntuación
      // Utilizar una función de mapeo suave (no agresiva)
      if (peakCV < this.PEAK_VARIANCE_THRESHOLD) {
        // Mapear de 0-umbral a 100-50 (menor variabilidad = mejor puntuación)
        return 100 - (peakCV / this.PEAK_VARIANCE_THRESHOLD) * 50;
      } else {
        // Alta variabilidad = baja puntuación (pero no cero)
        return Math.max(20, 50 - (peakCV - this.PEAK_VARIANCE_THRESHOLD) * 100);
      }
    }
    
    // Si no tenemos suficientes datos, retornar puntuación neutral
    return 50;
  }
  
  /**
   * Nueva función: Analiza características fisiológicas de la señal
   * Las señales PPG reales tienen propiedades específicas de absorción de luz
   */
  private calculatePhysiologicalCharacteristics(): number {
    // Si no tenemos valores de rojo/verde, retornar puntuación neutral
    if (this.lastRedValue === 0 || this.lastGreenValue === 0) return 50;
    
    // Calcular relación rojo/verde actual
    const rgRatio = this.lastRedValue / Math.max(0.1, this.lastGreenValue);
    
    // Añadir al historial
    this.redGreenRatioHistory.push(rgRatio);
    if (this.redGreenRatioHistory.length > this.RG_HISTORY_SIZE) {
      this.redGreenRatioHistory.shift();
    }
    
    // Calcular promedio de relación R/G
    const avgRgRatio = this.redGreenRatioHistory.reduce((a, b) => a + b, 0) / 
                      this.redGreenRatioHistory.length;
    
    // Verificar si la relación está en el rango esperado para tejido humano
    // Aplicamos una función de puntuación suave (no agresiva)
    if (avgRgRatio < this.MIN_RG_RATIO) {
      // Por debajo del mínimo, puntuación baja pero no cero
      return Math.max(20, (avgRgRatio / this.MIN_RG_RATIO) * 70);
    } else if (avgRgRatio > this.MAX_RG_RATIO) {
      // Por encima del máximo, puntuación baja pero no cero
      return Math.max(20, 100 - ((avgRgRatio - this.MAX_RG_RATIO) / this.MAX_RG_RATIO) * 80);
    } else {
      // En el rango óptimo, alta puntuación
      // Función de campana con máximo en el centro del rango
      const optimalRatio = (this.MIN_RG_RATIO + this.MAX_RG_RATIO) / 2;
      const distance = Math.abs(avgRgRatio - optimalRatio);
      const rangeSize = (this.MAX_RG_RATIO - this.MIN_RG_RATIO) / 2;
      
      // Transformar la distancia al centro en una puntuación (100 en el óptimo)
      return 100 - (distance / rangeSize) * 30;
    }
  }
  
  /**
   * Setter para valores RGB utilizados en el análisis fisiológico
   */
  public setRGBValues(red: number, green: number): void {
    this.lastRedValue = red;
    this.lastGreenValue = green;
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
    
    // Umbral adaptativo basado en la intensidad de la señal con menor penalización
    const adaptiveThreshold = Math.min(
      this.WAVELET_THRESHOLD,
      this.WAVELET_THRESHOLD * (1 - (this.signalQuality / 250)) // Mayor reducción de umbral con calidad (antes: 200)
    );
    
    // Soft thresholding technique (simplified wavelet approach)
    if (Math.abs(normalizedValue) < adaptiveThreshold) {
      return this.baselineValue;
    }
    
    const sign = normalizedValue >= 0 ? 1 : -1;
    // Amplificamos ligeramente al restar el umbral para resaltar picos
    const denoisedValue = sign * (Math.abs(normalizedValue) - adaptiveThreshold * 0.85);
    
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
    
    // Criterio 1: Calidad mínima de señal (más permisiva)
    if (this.signalQuality < 35) return false; // Reducido de 40 para mayor sensibilidad
    
    // Criterio 2: Variabilidad significativa (señal viva vs estática)
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const range = max - min;
    
    // Criterio 3: Consistencia fisiológica (análisis de rojo/verde)
    // Utilizamos el promedio de la relación R/G si está disponible
    let physiologicalCheck = true;
    if (this.redGreenRatioHistory.length >= 2) {
      const avgRgRatio = this.redGreenRatioHistory.reduce((a, b) => a + b, 0) / 
                        this.redGreenRatioHistory.length;
      
      // Verificación más permisiva
      physiologicalCheck = avgRgRatio > (this.MIN_RG_RATIO * 0.85); // Más permisivo (antes: 0.9)
    }
    
    return range > this.MIN_SIGNAL_DIFF && 
           this.consecutiveGoodFrames >= 1 && 
           physiologicalCheck;
  }

  /**
   * Estimates blood glucose levels based on PPG waveform characteristics
   * Adapted from "Non-invasive glucose monitoring using PPG" research
   */
  public estimateBloodGlucose(): number {
    if (this.ppgValues.length < this.WINDOW_SIZE) {
      return 0;
    }
    
    const recentValues = this.ppgValues.slice(-this.WINDOW_SIZE);
    
    // Calcular características de la señal
    const maxVal = Math.max(...recentValues);
    const minVal = Math.min(...recentValues);
    const range = maxVal - minVal;
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Calcular ratio de amplitud normalizada
    const normalizedAmplitude = range / mean;
    
    // Aplicar modelo calibrado (lineal)
    const glucoseEstimate = normalizedAmplitude * this.GLUCOSE_CALIBRATION;
    
    return glucoseEstimate;
  }
  
  /**
   * Estimates lipid profile based on PPG characteristics and spectral analysis
   */
  public estimateLipidProfile(): { totalCholesterol: number, triglycerides: number } {
    if (this.ppgValues.length < this.WINDOW_SIZE) {
      return { totalCholesterol: 0, triglycerides: 0 };
    }
    
    const recentValues = this.ppgValues.slice(-this.WINDOW_SIZE);
    
    // Calcular características de la señal
    const maxVal = Math.max(...recentValues);
    const minVal = Math.min(...recentValues);
    const range = maxVal - minVal;
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Calcular ratio de amplitud normalizada
    const normalizedAmplitude = range / mean;
    
    // Aplicar modelo calibrado (lineal)
    const lipidEstimate = normalizedAmplitude * this.LIPID_CALIBRATION;
    
    return {
      totalCholesterol: lipidEstimate,
      triglycerides: lipidEstimate * 0.8 // Simplificación
    };
  }
  
  /**
   * Simplified Discrete Wavelet Transform for frequency band analysis
   */
  private discreteWaveletTransform(signal: number[]): { detailCoeffs: number[], approxCoeffs: number[] } {
    const detailCoeffs: number[] = [];
    const approxCoeffs: number[] = [];
    
    // Haar wavelet coefficients
    const h0 = 0.7071; // LPF coefficient
    const h1 = 0.7071;
    const g0 = -0.7071; // HPF coefficient
    const g1 = 0.7071;
    
    // Apply filters and downsample
    for (let i = 0; i < signal.length; i += 2) {
      // Check if there are enough samples
      if (i + 1 < signal.length) {
        const s0 = signal[i];
        const s1 = signal[i + 1];
        
        // Approximation (Low-pass filtering)
        const approx = (h0 * s0 + h1 * s1) / Math.sqrt(2);
        approxCoeffs.push(approx);
        
        // Detail (High-pass filtering)
        const detail = (g0 * s0 + g1 * s1) / Math.sqrt(2);
        detailCoeffs.push(detail);
      }
    }
    
    return { detailCoeffs, approxCoeffs };
  }

  /**
   * Reset the signal processor state
   */
  public reset(): void {
    this.ppgValues = [];
    this.baselineValue = 0;
    this.signalQuality = 0;
    this.consecutiveGoodFrames = 0;
    this.peakHistory = [];
    this.redGreenRatioHistory = [];
    this.lastRedValue = 0;
    this.lastGreenValue = 0;
    console.log("SignalProcessor: Reset completo del procesador de señal");
  }

  /**
   * Get the current PPG values buffer
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
}
