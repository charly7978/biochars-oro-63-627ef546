
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * SignalValidator - Validador de señales PPG optimizado para sensibilidad máxima
 * Detecta patrones cardíacos en señales débiles pero válidas
 * Análisis de consistencia temporal y frecuencial en tiempo real
 */
export class SignalValidator {
  // Umbral para amplitud mínima - REDUCIDO para mayor sensibilidad
  private readonly minimumAmplitude: number;
  
  // Ventana para detección de patrones - REDUCIDA para respuesta más rápida
  private readonly patternWindow: number;
  
  // Historial de señal para análisis temporal
  private signalHistory: number[] = [];
  
  // Detección de presencia de dedo
  private fingerDetected: boolean = false;
  private fingerConfidence: number = 0;
  private stableSignalCount: number = 0;
  private stableSignalThreshold: number = 3;
  
  // Análisis de patrones y periodicidad
  private lastPatternCheckTime: number = 0;
  private readonly PATTERN_CHECK_INTERVAL: number = 500; // ms
  private currentCorrelation: number = 0;
  
  // Estadísticas para diagnóstico
  private stats = {
    validationCalls: 0,
    patternDetections: 0,
    maxAmplitude: 0,
    minAmplitude: Infinity,
    totalAmplitude: 0,
    signalToNoiseRatio: 0
  };

  /**
   * Constructor con umbral adaptativo
   * @param minimumAmplitude Amplitud mínima para señal válida (valor menor = más sensible)
   * @param patternWindow Ventana de análisis para patrones (valor menor = más rápida respuesta)
   */
  constructor(minimumAmplitude: number = 0.002, patternWindow: number = 5) {
    this.minimumAmplitude = minimumAmplitude;
    this.patternWindow = patternWindow;
    console.log("SignalValidator: Inicializado con alta sensibilidad", { 
      minimumAmplitude,
      patternWindow
    });
  }

  /**
   * Validar señal para detección avanzada de presencia de dedo
   * @param value Valor PPG actual
   * @returns Indicador de validez
   */
  public validateSignal(value: number): boolean {
    this.stats.validationCalls++;
    
    // Actualizar historial de señal
    this.signalHistory.push(value);
    if (this.signalHistory.length > 30) {
      this.signalHistory.shift();
    }
    
    // No tenemos suficientes datos para analizar
    if (this.signalHistory.length < this.patternWindow) {
      return false;
    }
    
    // Análisis de amplitud dinámico para mayor sensibilidad
    const recentValues = this.signalHistory.slice(-this.patternWindow);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Actualizar estadísticas
    this.stats.minAmplitude = Math.min(this.stats.minAmplitude, amplitude);
    this.stats.maxAmplitude = Math.max(this.stats.maxAmplitude, amplitude);
    this.stats.totalAmplitude += amplitude;
    
    // Adaptación dinámica a la señal actual - permite detectar señales más débiles
    const effectiveThreshold = this.minimumAmplitude * 
                              Math.max(0.5, Math.min(2.0, 1.0 / this.getCurrentSignalQuality()));
    
    // Detectar amplitud mínima
    if (amplitude < effectiveThreshold) {
      // Reducir confianza pero no descartar inmediatamente
      this.fingerConfidence = Math.max(0, this.fingerConfidence - 0.2);
      this.stableSignalCount = 0;
      
      if (this.fingerConfidence < 0.3) {
        this.fingerDetected = false;
      }
      
      if (this.stats.validationCalls % 30 === 0) {
        console.log("SignalValidator: Amplitud insuficiente", {
          amplitud: amplitude,
          umbralEfectivo: effectiveThreshold,
          confianza: this.fingerConfidence
        });
      }
      
      return this.fingerDetected;
    }
    
    // Analizar periodicidad y patrones fisiológicos cada cierto intervalo
    const now = Date.now();
    if (now - this.lastPatternCheckTime > this.PATTERN_CHECK_INTERVAL && this.signalHistory.length >= 20) {
      this.lastPatternCheckTime = now;
      this.currentCorrelation = this.detectCardiacPattern();
      this.stats.patternDetections++;
    }
    
    // Incrementar confianza si tenemos patrones consistentes
    if (this.currentCorrelation > 0.3) {
      this.fingerConfidence = Math.min(1.0, this.fingerConfidence + 0.2);
      this.stableSignalCount++;
      
      if (this.stableSignalCount >= this.stableSignalThreshold) {
        this.fingerDetected = true;
      }
    } else {
      // Reducir confianza gradualmente si no hay patrones
      this.fingerConfidence = Math.max(0, this.fingerConfidence - 0.1);
      this.stableSignalCount = Math.max(0, this.stableSignalCount - 0.5);
      
      if (this.fingerConfidence < 0.2) {
        this.fingerDetected = false;
      }
    }
    
    // Registro periódico para diagnóstico
    if (this.stats.validationCalls % 50 === 0) {
      console.log("SignalValidator: Estado de detección", {
        fingerDetected: this.fingerDetected,
        confianza: this.fingerConfidence.toFixed(2),
        contadorEstable: this.stableSignalCount,
        amplitud: amplitude.toFixed(4),
        umbral: effectiveThreshold.toFixed(4),
        correlación: this.currentCorrelation.toFixed(2),
        calidadSeñal: this.getCurrentSignalQuality().toFixed(2)
      });
    }
    
    return this.fingerDetected;
  }
  
  /**
   * Detector avanzado de patrones cardíacos
   * Analiza autocorrelación y características espectrales
   */
  private detectCardiacPattern(): number {
    if (this.signalHistory.length < 20) return 0;
    
    // Obtener ventana de análisis
    const signal = this.signalHistory.slice(-20);
    
    // Normalizar la señal
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const normalizedSignal = signal.map(v => v - mean);
    
    // Calcular autocorrelación para detectar periodicidad
    const correlations: number[] = [];
    
    // Buscar períodos típicos de ritmo cardíaco (aproximadamente 0.5-2.5 Hz)
    for (let lag = 3; lag <= 15; lag++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < normalizedSignal.length - lag; i++) {
        correlation += normalizedSignal[i] * normalizedSignal[i + lag];
        count++;
      }
      
      if (count > 0) {
        correlations.push(correlation / count);
      }
    }
    
    // Sin correlaciones válidas
    if (correlations.length === 0) return 0;
    
    // Encontrar pico de correlación (máxima correlación positiva)
    const maxCorrelation = Math.max(...correlations);
    
    // Calcular variabilidad para determinar SNR
    const variance = normalizedSignal.reduce((sum, val) => sum + val * val, 0) / normalizedSignal.length;
    const signalToNoise = variance > 0 ? maxCorrelation / Math.sqrt(variance) : 0;
    
    // Actualizar estadística
    this.stats.signalToNoiseRatio = (this.stats.signalToNoiseRatio * 0.7) + (signalToNoise * 0.3);
    
    // Normalizar resultado
    return Math.max(0, Math.min(1, maxCorrelation * 2));
  }
  
  /**
   * Calcular calidad actual de señal
   */
  private getCurrentSignalQuality(): number {
    if (this.signalHistory.length < 10) return 1.0;
    
    // Obtener ventana reciente
    const recentValues = this.signalHistory.slice(-10);
    
    // Calcular varianza para estimar ruido
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    
    // Calcular rango para estimar señal
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    // Evitar división por cero
    if (variance === 0 || range === 0) return 1.0;
    
    // Mejor calidad = mayor rango, menor varianza
    const quality = range / Math.sqrt(variance);
    
    // Normalizar con factor de amplificación para señales débiles
    return Math.max(0.5, Math.min(2.0, quality / 5));
  }
  
  /**
   * Comprobar si se ha detectado dedo
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }
  
  /**
   * Obtener nivel de confianza de detección
   */
  public getFingerConfidence(): number {
    return this.fingerConfidence;
  }
  
  /**
   * Seguir la señal para detección de patrones sin validar
   * Útil para recolección continua de datos
   */
  public trackSignalForPatternDetection(value: number): void {
    this.signalHistory.push(value);
    if (this.signalHistory.length > 30) {
      this.signalHistory.shift();
    }
    
    // Actualizar periodicidad cada cierto tiempo
    const now = Date.now();
    if (now - this.lastPatternCheckTime > this.PATTERN_CHECK_INTERVAL && this.signalHistory.length >= 20) {
      this.lastPatternCheckTime = now;
      this.currentCorrelation = this.detectCardiacPattern();
      this.stats.patternDetections++;
      
      // Actualizar estado de detección basado solo en patrones
      if (this.currentCorrelation > 0.3) {
        this.stableSignalCount++;
        if (this.stableSignalCount >= this.stableSignalThreshold) {
          this.fingerDetected = true;
          this.fingerConfidence = Math.min(1.0, this.fingerConfidence + 0.1);
        }
      } else {
        this.stableSignalCount = Math.max(0, this.stableSignalCount - 0.5);
        this.fingerConfidence = Math.max(0, this.fingerConfidence - 0.05);
        
        if (this.stableSignalCount < 1 && this.fingerConfidence < 0.2) {
          this.fingerDetected = false;
        }
      }
    }
  }
  
  /**
   * Reiniciar detección de dedo
   */
  public resetFingerDetection(): void {
    this.fingerDetected = false;
    this.fingerConfidence = 0;
    this.stableSignalCount = 0;
    this.signalHistory = [];
    this.lastPatternCheckTime = 0;
    this.currentCorrelation = 0;
    
    // Reiniciar estadísticas
    this.stats = {
      validationCalls: 0,
      patternDetections: 0,
      maxAmplitude: 0,
      minAmplitude: Infinity,
      totalAmplitude: 0,
      signalToNoiseRatio: 0
    };
    
    console.log("SignalValidator: Detección de dedo reiniciada");
  }
  
  /**
   * Obtener estadísticas para diagnóstico
   */
  public getStats(): any {
    const avgAmplitude = this.stats.validationCalls > 0 
      ? this.stats.totalAmplitude / this.stats.validationCalls 
      : 0;
      
    return {
      ...this.stats,
      avgAmplitude,
      currentThreshold: this.minimumAmplitude,
      adaptiveThreshold: this.minimumAmplitude * Math.max(0.5, Math.min(2.0, 1.0 / this.getCurrentSignalQuality())),
      fingerDetected: this.fingerDetected,
      fingerConfidence: this.fingerConfidence,
      correlation: this.currentCorrelation
    };
  }
}
