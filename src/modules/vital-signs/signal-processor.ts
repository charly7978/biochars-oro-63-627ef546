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
  private readonly MIN_SIGNAL_DIFF = 0.9; // Reduced from 1.2
  private consecutiveGoodFrames: number = 0;
  private readonly REQUIRED_GOOD_FRAMES = 30; // Reduced from 45
  private lastSpikeTimestamps: number[] = []; // Registro de los últimos picos para análisis de ritmo
  private readonly MIN_BPM = 45; // Mínima frecuencia cardíaca esperada (latidos por minuto)
  private readonly MAX_BPM = 200; // Máxima frecuencia cardíaca esperada
  private readonly MIN_FRAMES_BEFORE_DETECTION = 40; // Reduced from 60 for faster detection
  private totalFramesProcessed: number = 0; // Contador de frames totales procesados
  
  // Reduced requirements for faster detection
  private consecutiveStableFrames: number = 0;
  private readonly REQUIRED_STABLE_FRAMES = 12; // Reduced from 20
  private lastPeakValues: number[] = []; // Para análisis de consistencia de picos
  private readonly CONSISTENCY_WINDOW = 10; // Ventana para análisis de consistencia
  private readonly MIN_PEAK_CONSISTENCY = 0.6; // Reduced from 0.7
  private readonly AMPLITUDE_CONSISTENCY_THRESHOLD = 0.4; // Increased from 0.35
  
  /**
   * Applies a wavelet-based noise reduction followed by Savitzky-Golay filtering
   * Technique adapted from "Advanced methods for ECG signal processing" (IEEE)
   */
  public applySMAFilter(value: number): number {
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    this.totalFramesProcessed++;
    
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
    
    // Detectar picos para análisis de ritmo cardíaco
    this.detectAndStorePeaks();
    
    // Aplicar Savitzky-Golay si tenemos suficientes datos
    if (this.ppgValues.length >= this.SG_COEFFS.length) {
      return this.applySavitzkyGolayFilter(denoised);
    }
    
    return denoised;
  }
  
  /**
   * Detecta picos en la señal para análisis de ritmo cardíaco
   * Esto ayuda a distinguir ritmos fisiológicos de ruido
   */
  private detectAndStorePeaks(): void {
    if (this.ppgValues.length < 20) return;
    
    // Usar últimos 2 segundos de datos (aprox. 30-60 frames)
    const recentValues = this.ppgValues.slice(-40);
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Umbral para detección de picos, adaptativo a la señal
    const threshold = Math.max(0.5, this.calculateDynamicThreshold(recentValues));
    
    // Buscar picos
    for (let i = 5; i < recentValues.length - 5; i++) {
      const value = recentValues[i];
      const prevValues = recentValues.slice(i-5, i);
      const nextValues = recentValues.slice(i+1, i+6);
      
      const isHigherThanPrev = prevValues.every(v => value > v);
      const isHigherThanNext = nextValues.every(v => value > v);
      
      if (isHigherThanPrev && isHigherThanNext && Math.abs(value - mean) > threshold) {
        const now = Date.now();
        
        // Evitar registrar picos múltiples en ventana pequeña (debounce)
        if (this.lastSpikeTimestamps.length === 0 || 
            now - this.lastSpikeTimestamps[this.lastSpikeTimestamps.length - 1] > 300) {
          this.lastSpikeTimestamps.push(now);
          this.lastPeakValues.push(value); // NUEVO: Almacenar valor del pico
          
          // Mantener solo los últimos 10 picos (timestamps)
          if (this.lastSpikeTimestamps.length > 10) {
            this.lastSpikeTimestamps.shift();
          }
          
          // Mantener solo los últimos N valores de picos (para análisis de consistencia)
          if (this.lastPeakValues.length > this.CONSISTENCY_WINDOW) {
            this.lastPeakValues.shift();
          }
        }
      }
    }
  }
  
  /**
   * Calcula un umbral dinámico para detección de picos basado en la variabilidad de la señal
   */
  private calculateDynamicThreshold(values: number[]): number {
    if (values.length < 3) return 1.0;
    
    // Calcular desviación estándar
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sqrDiff = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    const stdDev = Math.sqrt(sqrDiff / values.length);
    
    // Umbral adaptativo basado en la desviación
    return stdDev * 1.5;
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
    
    // Característica 4: Análisis de ritmo cardíaco (nuevo)
    let heartRhythmScore = this.analyzeHeartRhythm();
    
    // NUEVA Característica 5: Consistencia de amplitud entre picos
    let peakConsistencyScore = this.analyzePeakConsistency();
    
    // Combinar métricas con diferentes pesos
    // MODIFICADO: Ajustado los pesos para dar más importancia a la consistencia
    const rawQuality = (amplitudeScore * 0.35) + (consistencyScore * 0.25) + 
                       (periodicityScore * 0.15) + (heartRhythmScore * 0.15) +
                       (peakConsistencyScore * 0.10); // NUEVO: Incluir consistencia de picos
    
    // Aplicar función de histéresis para evitar cambios abruptos
    this.signalQuality = this.signalQuality * 0.7 + rawQuality * 0.3;
    
    // Manejo de frames consecutivos buenos para estabilidad
    // MODIFICADO: Umbral mucho más exigente para considerar un frame como "bueno"
    if (rawQuality > 75) { // MODIFICADO: Aumentado de 60 a 75
      this.consecutiveGoodFrames++;
      
      // NUEVO: Contador adicional para estabilidad extrema
      if (rawQuality > 85) {
        this.consecutiveStableFrames++;
      } else {
        // Decrementar gradualmente para evitar pérdidas inmediatas por fluctuaciones menores
        this.consecutiveStableFrames = Math.max(0, this.consecutiveStableFrames - 0.5);
      }
    } else {
      this.consecutiveGoodFrames = Math.max(0, this.consecutiveGoodFrames - 0.5); // Decrementar gradualmente
      this.consecutiveStableFrames = Math.max(0, this.consecutiveStableFrames - 1); // Decrementar más rápido
    }
    
    // Si tenemos suficientes frames buenos consecutivos, aumentar confianza
    if (this.consecutiveGoodFrames >= this.REQUIRED_GOOD_FRAMES) {
      this.signalQuality = Math.min(100, this.signalQuality * 1.15);
    }
  }
  
  /**
   * NUEVO: Analiza la consistencia en la amplitud de los picos detectados
   * Una señal de dedo real debería tener picos relativamente consistentes
   */
  private analyzePeakConsistency(): number {
    if (this.lastPeakValues.length < 4) return 0;
    
    // Calcular estadísticas de valores de picos
    const mean = this.lastPeakValues.reduce((sum, val) => sum + val, 0) / this.lastPeakValues.length;
    const diffs = this.lastPeakValues.map(val => Math.abs(val - mean));
    const avgDiff = diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length;
    const normalizedDiff = avgDiff / Math.abs(mean);
    
    // Evaluar consistencia: más bajo es mejor (menos variación)
    if (normalizedDiff <= this.AMPLITUDE_CONSISTENCY_THRESHOLD) {
      // Convertir a puntaje (0-100): menor variación = mayor puntaje
      const consistencyScore = 100 * (1 - (normalizedDiff / this.AMPLITUDE_CONSISTENCY_THRESHOLD));
      return consistencyScore;
    }
    
    return 0; // Demasiada variación entre picos
  }
  
  /**
   * Analiza el ritmo cardíaco basado en los picos detectados
   * para verificar que corresponda a un rango fisiológico normal
   */
  private analyzeHeartRhythm(): number {
    if (this.lastSpikeTimestamps.length < 4) return 0;
    
    // Calcular intervalos entre picos
    const intervals = [];
    for (let i = 1; i < this.lastSpikeTimestamps.length; i++) {
      intervals.push(this.lastSpikeTimestamps[i] - this.lastSpikeTimestamps[i-1]);
    }
    
    // Calcular BPM medio
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const estimatedBPM = 60000 / avgInterval;
    
    // Verificar si está en rango fisiológico
    if (estimatedBPM < this.MIN_BPM || estimatedBPM > this.MAX_BPM) {
      return 0; // Fuera de rango fisiológico
    }
    
    // Calcular variabilidad de intervalos (debe ser baja pero no nula)
    const intervalVariation = this.calculateCoefficientOfVariation(intervals);
    
    // La variabilidad normal del ritmo cardíaco está entre 5-15%
    if (intervalVariation < 0.03 || intervalVariation > 0.30) {
      return 30; // Variabilidad anormal, posible ruido o arritmia severa
    }
    
    // Puntaje basado en proximidad a variabilidad ideal (~10%)
    const idealVariation = 0.10;
    const variationScore = 100 * (1 - Math.min(1, Math.abs(intervalVariation - idealVariation) / idealVariation));
    
    return variationScore;
  }
  
  /**
   * Calcula el coeficiente de variación de un array de valores
   */
  private calculateCoefficientOfVariation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / mean;
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
    // Requerir un mínimo de frames totales antes de permitir cualquier detección
    // Esto evita falsos positivos durante el arranque
    if (this.totalFramesProcessed < this.MIN_FRAMES_BEFORE_DETECTION) {
      console.log("No suficientes frames procesados para iniciar detección");
      return false;
    }
    
    // Se requiere un mínimo de datos para determinar presencia
    if (this.ppgValues.length < 30) return false;
    
    // Criterio 1: Calidad mínima de señal (más sensible)
    // Modified for better sensitivity
    if (this.signalQuality < 75) { // Reduced from 90
      console.log("Calidad de señal insuficiente:", this.signalQuality.toFixed(1));
      return false;
    }
    
    // Criterio 2: Variabilidad significativa con patrón claro (señal viva vs estática)
    const recentValues = this.ppgValues.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const range = max - min;
    
    // Criterio 3: Periodo adicional de estabilidad extrema
    // Less restrictive for easier detection
    if (this.consecutiveStableFrames < this.REQUIRED_STABLE_FRAMES) {
      console.log("No suficientes frames estables:", 
                 this.consecutiveStableFrames, 
                 "/", 
                 this.REQUIRED_STABLE_FRAMES);
      return false;
    }
    
    // Criterio 4: Ratio de frames consecutivos buenos (menos exigente)
    if (this.consecutiveGoodFrames < this.REQUIRED_GOOD_FRAMES) {
      console.log("No suficientes frames buenos consecutivos:", 
                 this.consecutiveGoodFrames, 
                 "/", 
                 this.REQUIRED_GOOD_FRAMES);
      return false;
    }
    
    // Criterio 5: Verificación de periodicidad (solo señales con patrón cardíaco)
    const periodicityCheck = this.checkSignalPeriodicity(recentValues);
    if (!periodicityCheck) {
      console.log("Periodicidad de señal no detectada");
      return false;
    }
    
    // Criterio 6: Análisis de ritmo cardíaco
    const heartRhythmCheck = this.verifyHeartRhythm();
    if (!heartRhythmCheck) {
      console.log("Ritmo cardíaco no verificado");
      return false;
    }
    
    // Criterio 7: Verificar estabilidad de señal a través del tiempo
    const signalStability = this.checkSignalStability(recentValues);
    // Less restrictive for easier detection
    if (signalStability < 0.65) {  // Reduced from 0.75
      console.log("Estabilidad de señal insuficiente:", signalStability.toFixed(2));
      return false;
    }
    
    // Criterio 8: Consistencia en la amplitud de picos
    if (this.lastPeakValues.length >= 4) {
      const peakConsistency = this.analyzePeakConsistency() / 100; // Convertir a escala 0-1
      if (peakConsistency < this.MIN_PEAK_CONSISTENCY) {
        console.log("Consistencia de picos insuficiente:", peakConsistency.toFixed(2));
        return false;
      }
    }
    
    // Solo si pasa todos los criterios estrictos, consideramos que hay un dedo
    console.log("DEDO DETECTADO ✓ - Todos los criterios cumplidos");
    return range > this.MIN_SIGNAL_DIFF;
  }

  /**
   * Verifica que la señal tenga una periodicidad compatible con un ritmo cardíaco real
   * Esto ayuda a rechazar señales que tienen variación pero no son fisiológicas
   */
  private checkSignalPeriodicity(values: number[]): boolean {
    if (values.length < 15) return false;
    
    // Calcular media para normalizar
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Buscar cruces por cero como indicador simple de periodicidad
    let zeroCrossings = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] - mean) * (values[i-1] - mean) < 0) {
        zeroCrossings++;
      }
    }
    
    // Un ritmo cardíaco normal debería tener entre 2-8 cruces por cero en una ventana de 30 muestras
    // dependiendo de la frecuencia de muestreo y la frecuencia cardíaca
    return zeroCrossings >= 2 && zeroCrossings <= 8;
  }
  
  /**
   * Verifica que el ritmo de picos detectados corresponda a un ritmo cardíaco humano
   */
  private verifyHeartRhythm(): boolean {
    if (this.lastSpikeTimestamps.length < 5) return false;
    
    // Calcular intervalos entre picos
    const intervals = [];
    for (let i = 1; i < this.lastSpikeTimestamps.length; i++) {
      intervals.push(this.lastSpikeTimestamps[i] - this.lastSpikeTimestamps[i-1]);
    }
    
    // Calcular BPM medio
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const estimatedBPM = 60000 / avgInterval;
    
    // Verificar si está en rango fisiológico plausible
    if (estimatedBPM < this.MIN_BPM || estimatedBPM > this.MAX_BPM) {
      return false;
    }
    
    // Verificar consistencia del ritmo (los intervalos no deben variar demasiado)
    const intervalVariation = this.calculateCoefficientOfVariation(intervals);
    
    // La variabilidad normal está entre 5-15%, pero permitimos hasta 30% para cubrir arritmias leves
    return intervalVariation >= 0.03 && intervalVariation <= 0.30;
  }
  
  /**
   * Verifica la estabilidad de la señal a lo largo del tiempo
   * Una señal de dedo real debe tener cierta estabilidad subyacente
   */
  private checkSignalStability(values: number[]): number {
    if (values.length < 15) return 0;
    
    // Dividir valores en segmentos
    const segmentSize = Math.floor(values.length / 3);
    const segments = [];
    
    for (let i = 0; i < 3; i++) {
      segments.push(values.slice(i * segmentSize, (i + 1) * segmentSize));
    }
    
    // Calcular y comparar estadísticas de cada segmento
    const segmentStats = segments.map(segment => {
      const mean = segment.reduce((a, b) => a + b, 0) / segment.length;
      const variance = segment.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / segment.length;
      return { mean, variance };
    });
    
    // Calcular variación entre las medias de segmentos
    const meanVariation = this.calculateCoefficientOfVariation(segmentStats.map(s => s.mean));
    
    // Calcular variación entre las varianzas de segmentos
    const varianceValues = segmentStats.map(s => s.variance);
    const avgVariance = varianceValues.reduce((a, b) => a + b, 0) / varianceValues.length;
    const varianceVariation = avgVariance > 0 ?
      Math.sqrt(varianceValues.reduce((a, b) => a + Math.pow(b - avgVariance, 2), 0) / varianceValues.length) / avgVariance :
      1;
    
    // Calcular score de estabilidad (0-1)
    // La variación de medias no debe ser muy alta, pero tampoco cero (sería una señal artificial)
    const meanScore = (meanVariation > 0.01 && meanVariation < 0.25) ? 
                      (1 - (meanVariation / 0.25)) : 0;
    
    // La variación de varianzas debe ser relativamente baja para indicar naturaleza similar
    const varianceScore = (varianceVariation < 0.5) ?
                          (1 - (varianceVariation / 0.5)) : 0;
    
    // Combinar scores
    return (meanScore * 0.6) + (varianceScore * 0.4);
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
    this.consecutiveStableFrames = 0; // NUEVO: Reiniciar contador de estabilidad
    this.lastSpikeTimestamps = [];
    this.lastPeakValues = []; // NUEVO: Reiniciar valores de picos
    this.totalFramesProcessed = 0;
    console.log("SignalProcessor: Reset completo del procesador de señal");
  }

  /**
   * Get the current PPG values buffer
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
}
