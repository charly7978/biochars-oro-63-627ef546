
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validador de señales vitales completamente rediseñado
 * Implementa técnicas avanzadas de análisis de dominio de tiempo y frecuencia
 * Enfoque 100% en análisis directo sin simulación
 */
export class SignalValidator {
  // Umbrales adaptativos
  private readonly MIN_SIGNAL_VALUE = 0.001;
  private readonly MAX_SIGNAL_VALUE = 1000;
  private readonly MIN_HEART_RATE_FREQUENCY = 0.6; // ~36 BPM
  private readonly MAX_HEART_RATE_FREQUENCY = 3.3; // ~200 BPM
  
  // Buffers para análisis temporal y espectral
  private readonly TIME_DOMAIN_BUFFER_SIZE = 60;
  private timeDomainBuffer: number[] = [];
  private readonly SPECTRAL_BUFFER_SIZE = 128;
  private spectralBuffer: number[] = [];
  
  // Estado del detector de dedo
  private fingerPresenceConfidence: number = 0;
  private fingerDetected: boolean = false;
  private consecutiveValidPatterns: number = 0;
  private readonly MIN_CONSECUTIVE_PATTERNS = 4;
  
  // Métricas de calidad de señal
  private signalQualityScore: number = 0;
  private dominantFrequency: number = 0;
  private spectralPower: number = 0;
  private lastValidSignalTime: number = 0;
  
  constructor(
    private readonly minAmplitude: number = 0.01,
    private readonly minDataPoints: number = 8,
    private readonly adaptiveThreshold: boolean = true
  ) {
    console.log("SignalValidator: Nuevo validador con análisis espectral inicializado");
  }
  
  /**
   * Verifica si un valor individual es una señal válida - enfoque completamente renovado
   */
  public isValidSignal(value: number): boolean {
    // Validaciones básicas de formato
    if (isNaN(value) || !isFinite(value)) {
      return false;
    }
    
    // Rango básico de valores físicos
    if (Math.abs(value) < this.MIN_SIGNAL_VALUE || Math.abs(value) > this.MAX_SIGNAL_VALUE) {
      return false;
    }
    
    // Actualizar buffer temporal con este valor
    this.updateTimeBuffer(value);
    
    // Actualizar buffer espectral periódicamente
    if (this.timeDomainBuffer.length % 2 === 0) {
      this.updateSpectralBuffer(value);
    }
    
    // Determinar si la señal es fisiológicamente plausible basado en su contexto temporal
    const isPlausible = this.isPhysiologicallyPlausible();
    
    // Actualizar métricas temporales
    this.updateTemporalMetrics();
    
    return isPlausible;
  }
  
  /**
   * Verifica si hay suficientes puntos de datos para análisis - enfoque más sensible
   */
  public hasEnoughData(values: number[]): boolean {
    if (!values || values.length < this.minDataPoints) {
      return false;
    }
    
    // Verificar porcentaje de valores utilizables - más tolerante con ruido
    const validValues = values.filter(v => this.quickSignalCheck(v));
    return validValues.length >= Math.max(5, Math.floor(this.minDataPoints * 0.7));
  }
  
  /**
   * Verificación rápida para filtrar valores obviamente inválidos
   */
  private quickSignalCheck(value: number): boolean {
    return !isNaN(value) && isFinite(value) && 
           Math.abs(value) >= this.MIN_SIGNAL_VALUE && 
           Math.abs(value) <= this.MAX_SIGNAL_VALUE;
  }
  
  /**
   * Verifica si la amplitud de la señal es suficiente - con umbrales adaptativos
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 4) {
      return false;
    }
    
    // Usar ventana deslizante para mejor detección
    const samplesForAnalysis = Math.min(values.length, 20);
    const recentValues = values.slice(-samplesForAnalysis);
    
    const minValue = Math.min(...recentValues);
    const maxValue = Math.max(...recentValues);
    const amplitude = maxValue - minValue;
    
    // Usar umbral adaptativo si está habilitado
    let effectiveThreshold = this.minAmplitude;
    if (this.adaptiveThreshold) {
      // Ajustar umbral basado en nivel de señal y tiempo transcurrido
      const signalLevel = Math.abs(minValue + maxValue) / 2;
      const timeSinceLastValid = Date.now() - this.lastValidSignalTime;
      
      if (timeSinceLastValid > 5000) {
        // Ser más permisivo después de períodos sin señal válida
        effectiveThreshold = Math.max(0.005, this.minAmplitude * 0.5);
      } else if (signalLevel > 0.5) {
        // Señales más fuertes requieren mayor amplitud relativa
        effectiveThreshold = Math.max(this.minAmplitude, signalLevel * 0.02);
      }
    }
    
    const hasAmplitude = amplitude >= effectiveThreshold;
    
    // Actualizar tiempo de última señal válida
    if (hasAmplitude) {
      this.lastValidSignalTime = Date.now();
    }
    
    return hasAmplitude;
  }
  
  /**
   * Método completamente nuevo: análisis de dominio de tiempo
   * Detecta patrones fisiológicamente plausibles en tiempo real
   */
  private updateTimeBuffer(value: number): void {
    this.timeDomainBuffer.push(value);
    if (this.timeDomainBuffer.length > this.TIME_DOMAIN_BUFFER_SIZE) {
      this.timeDomainBuffer.shift();
    }
  }
  
  /**
   * Método completamente nuevo: análisis de dominio de frecuencia
   * Identifica componentes de frecuencia dominantes para detección de ritmo cardíaco
   */
  private updateSpectralBuffer(value: number): void {
    this.spectralBuffer.push(value);
    if (this.spectralBuffer.length > this.SPECTRAL_BUFFER_SIZE) {
      this.spectralBuffer.shift();
    }
    
    // Analizar dominio de frecuencia periódicamente
    if (this.spectralBuffer.length >= 32 && this.spectralBuffer.length % 4 === 0) {
      this.performSpectralAnalysis();
    }
  }
  
  /**
   * Método completamente nuevo: análisis espectral simplificado
   * Identifica frecuencias dominantes en la señal sin FFT completa
   */
  private performSpectralAnalysis(): void {
    if (this.spectralBuffer.length < 32) return;
    
    // Normalizar señal
    const mean = this.spectralBuffer.reduce((sum, val) => sum + val, 0) / this.spectralBuffer.length;
    const normalizedSignal = this.spectralBuffer.map(val => val - mean);
    
    // Analizar potencia en bandas de frecuencia relevantes para ritmo cardíaco
    // 0.6Hz-3.3Hz (36-200 BPM)
    const sampleRate = 30; // Asumimos 30 Hz como tasa de muestreo
    const frequencyBins: {frequency: number, power: number}[] = [];
    
    // Escanear bandas de frecuencia relevantes para ritmo cardíaco
    for (let freq = this.MIN_HEART_RATE_FREQUENCY; freq <= this.MAX_HEART_RATE_FREQUENCY; freq += 0.1) {
      let powerReal = 0;
      let powerImag = 0;
      
      // Calcular componentes de Fourier manualmente para esta frecuencia
      for (let i = 0; i < normalizedSignal.length; i++) {
        const phase = (i / sampleRate) * 2 * Math.PI * freq;
        powerReal += normalizedSignal[i] * Math.cos(phase);
        powerImag += normalizedSignal[i] * Math.sin(phase);
      }
      
      // Potencia total a esta frecuencia
      const power = Math.sqrt(powerReal * powerReal + powerImag * powerImag) / normalizedSignal.length;
      frequencyBins.push({ frequency: freq, power });
    }
    
    // Encontrar frecuencia dominante
    let maxPower = 0;
    let maxFreq = 0;
    
    for (const bin of frequencyBins) {
      if (bin.power > maxPower) {
        maxPower = bin.power;
        maxFreq = bin.frequency;
      }
    }
    
    // Actualizar métricas espectrales
    this.dominantFrequency = maxFreq;
    this.spectralPower = maxPower;
    
    // Calcular puntuación de calidad basada en potencia espectral y concentración
    const totalPower = frequencyBins.reduce((sum, bin) => sum + bin.power, 0);
    const powerRatio = totalPower > 0 ? maxPower / totalPower : 0;
    
    // Puntuación de calidad espectral (0-1)
    // Mayor si hay un pico de frecuencia dominante claro
    const spectralQuality = Math.min(1, powerRatio * 3);
    
    // Actualizar detección de presencia de dedo basada en análisis espectral
    this.updateFingerDetection(spectralQuality, maxFreq);
  }
  
  /**
   * Método completamente nuevo: actualización de métricas temporales
   * Analiza propiedades estadísticas de la señal en dominio de tiempo
   */
  private updateTemporalMetrics(): void {
    if (this.timeDomainBuffer.length < 10) return;
    
    // Análisis de segmento reciente
    const recentSegment = this.timeDomainBuffer.slice(-15);
    
    // Métricas básicas
    const min = Math.min(...recentSegment);
    const max = Math.max(...recentSegment);
    const range = max - min;
    const mean = recentSegment.reduce((sum, val) => sum + val, 0) / recentSegment.length;
    
    // Variabilidad de señal
    const variability = recentSegment.reduce((sum, val) => sum + Math.abs(val - mean), 0) / recentSegment.length;
    
    // Detectar cruces por cero (indicador de periodicidad)
    let zeroCrossings = 0;
    for (let i = 1; i < recentSegment.length; i++) {
      if ((recentSegment[i] - mean) * (recentSegment[i-1] - mean) < 0) {
        zeroCrossings++;
      }
    }
    
    // Detectar picos (otro indicador de periodicidad)
    let peaks = 0;
    for (let i = 1; i < recentSegment.length - 1; i++) {
      if (recentSegment[i] > recentSegment[i-1] && recentSegment[i] > recentSegment[i+1]) {
        peaks++;
      }
    }
    
    // Puntuación de calidad temporal (0-1)
    const temporalQuality = Math.min(1, (
      (range > this.minAmplitude ? 0.6 : 0) +
      (peaks >= 1 && peaks <= 8 ? 0.2 : 0) +
      (zeroCrossings >= 2 && zeroCrossings <= 12 ? 0.2 : 0)
    ));
    
    // Combinar calidad temporal con espectral
    this.signalQualityScore = 0.7 * temporalQuality + 0.3 * this.signalQualityScore;
  }
  
  /**
   * Método completamente nuevo: verificación de plausibilidad fisiológica
   * Combina múltiples indicadores para determinar si la señal proviene de un sujeto humano
   */
  private isPhysiologicallyPlausible(): boolean {
    // Siempre válido si hemos confirmado la presencia de un dedo
    if (this.fingerDetected) {
      return true;
    }
    
    // Análisis básico si no tenemos suficientes datos
    if (this.timeDomainBuffer.length < 10) {
      return this.quickSignalCheck(this.timeDomainBuffer[this.timeDomainBuffer.length - 1]);
    }
    
    // Verificar si la señal tiene características fisiológicamente plausibles
    const isInHeartRateRange = this.dominantFrequency >= this.MIN_HEART_RATE_FREQUENCY && 
                               this.dominantFrequency <= this.MAX_HEART_RATE_FREQUENCY;
    
    const hasAdequateQuality = this.signalQualityScore > 0.3;
    
    // Verificación de patrones fisiológicos
    const segment = this.timeDomainBuffer.slice(-20);
    const min = Math.min(...segment);
    const max = Math.max(...segment);
    const range = max - min;
    
    // La señal debe tener suficiente amplitud y estar en rango fisiológico
    const hasMinimumViability = range > (this.minAmplitude * 0.7) && isInHeartRateRange;
    
    return hasMinimumViability || hasAdequateQuality;
  }
  
  /**
   * Método completamente nuevo: detección de presencia de dedo
   * Basado en análisis de consistencia espectral y temporal
   */
  private updateFingerDetection(spectralQuality: number, dominantFreq: number): void {
    // Verificar si la frecuencia dominante está en rango fisiológico de ritmo cardíaco
    const isValidHeartRateFreq = dominantFreq >= this.MIN_HEART_RATE_FREQUENCY && 
                                 dominantFreq <= this.MAX_HEART_RATE_FREQUENCY;
    
    // Aumentar confianza si hay un pico fisiológicamente plausible
    if (isValidHeartRateFreq && spectralQuality > 0.3) {
      this.consecutiveValidPatterns = Math.min(this.consecutiveValidPatterns + 1, this.MIN_CONSECUTIVE_PATTERNS * 2);
      this.fingerPresenceConfidence = Math.min(1, this.fingerPresenceConfidence + 0.2);
    } else {
      // Disminuir confianza gradualmente
      this.consecutiveValidPatterns = Math.max(0, this.consecutiveValidPatterns - 0.5);
      this.fingerPresenceConfidence = Math.max(0, this.fingerPresenceConfidence - 0.1);
    }
    
    // Actualizar estado de detección de dedo
    if (!this.fingerDetected && this.consecutiveValidPatterns >= this.MIN_CONSECUTIVE_PATTERNS) {
      this.fingerDetected = true;
      console.log("SignalValidator: Dedo detectado por análisis espectro-temporal", {
        confianza: this.fingerPresenceConfidence,
        frecuenciaDominante: dominantFreq,
        patronesConsecutivos: this.consecutiveValidPatterns
      });
    } else if (this.fingerDetected && this.consecutiveValidPatterns < (this.MIN_CONSECUTIVE_PATTERNS / 2)) {
      this.fingerDetected = false;
      console.log("SignalValidator: Dedo removido", {
        confianza: this.fingerPresenceConfidence,
        patronesConsecutivos: this.consecutiveValidPatterns
      });
    }
  }
  
  /**
   * Actualiza el análisis de patrón de dedo directamente con datos reales
   */
  public trackSignalForPatternDetection(value: number): void {
    // Ya no necesita implementación separada ya que está integrada en isValidSignal
    this.isValidSignal(value);
  }
  
  /**
   * Verifica si hay un dedo detectado
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }
  
  /**
   * Obtiene la calidad de señal actual
   */
  public getSignalQuality(): number {
    return this.signalQualityScore * 100; // Convertir a escala 0-100
  }
  
  /**
   * Obtiene la frecuencia cardíaca estimada basada en análisis espectral
   */
  public getEstimatedHeartRate(): number {
    if (!this.fingerDetected || this.dominantFrequency < this.MIN_HEART_RATE_FREQUENCY) {
      return 0;
    }
    return Math.round(this.dominantFrequency * 60);
  }
  
  /**
   * Reinicia la detección de dedo
   */
  public resetFingerDetection(): void {
    this.timeDomainBuffer = [];
    this.spectralBuffer = [];
    this.fingerDetected = false;
    this.fingerPresenceConfidence = 0;
    this.consecutiveValidPatterns = 0;
    this.lastValidSignalTime = 0;
    this.dominantFrequency = 0;
    this.spectralPower = 0;
    this.signalQualityScore = 0;
  }
  
  /**
   * Registra resultados de validación para propósitos de depuración
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("SignalValidator: Resultados de validación - NUEVO ALGORITMO", {
      isValid,
      amplitude,
      minAmplitudRequerida: this.minAmplitude,
      puntosDeDatos: values.length,
      minimoRequerido: this.minDataPoints,
      ultimosValores: values.slice(-5),
      fingerDetected: this.fingerDetected,
      consecutiveValidPatterns: this.consecutiveValidPatterns,
      signalQuality: this.getSignalQuality(),
      dominantFrequency: this.dominantFrequency,
      estimatedHeartRate: this.getEstimatedHeartRate()
    });
  }
}
