
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validador de señales vitales
 * Implementa métodos de validación de señal basados únicamente en análisis directo
 */
export class SignalValidator {
  private readonly MIN_SIGNAL_AMPLITUDE: number;
  private readonly MIN_DATA_POINTS: number;
  private readonly MIN_SIGNAL_VALUE = 0.001;
  private readonly MAX_SIGNAL_VALUE = 1000;
  
  // Estados para detección avanzada
  private readonly PATTERN_BUFFER_SIZE = 30;
  private patternBuffer: number[] = [];
  private fingerDetected: boolean = false;
  private lastValidPatternTime: number = 0;
  private consecutiveValidPatterns: number = 0;
  private readonly MIN_CONSECUTIVE_PATTERNS = 5;
  
  constructor(minAmplitude: number = 0.01, minDataPoints: number = 10) {
    this.MIN_SIGNAL_AMPLITUDE = minAmplitude;
    this.MIN_DATA_POINTS = minDataPoints;
  }
  
  /**
   * Verifica si un valor individual es una señal válida
   */
  public isValidSignal(value: number): boolean {
    // Valor no puede ser NaN ni infinito
    if (isNaN(value) || !isFinite(value)) {
      return false;
    }
    
    // Valor debe estar dentro del rango esperado
    if (Math.abs(value) < this.MIN_SIGNAL_VALUE || Math.abs(value) > this.MAX_SIGNAL_VALUE) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Verifica si hay suficientes puntos de datos para análisis
   */
  public hasEnoughData(values: number[]): boolean {
    if (!values || values.length < this.MIN_DATA_POINTS) {
      return false;
    }
    
    // Verificar si los valores son utilizables
    const validValues = values.filter(v => this.isValidSignal(v));
    return validValues.length >= this.MIN_DATA_POINTS;
  }
  
  /**
   * Verifica si la amplitud de la señal es suficiente
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 5) {
      return false;
    }
    
    const minValue = Math.min(...values.slice(-15));
    const maxValue = Math.max(...values.slice(-15));
    const amplitude = maxValue - minValue;
    
    return amplitude >= this.MIN_SIGNAL_AMPLITUDE;
  }
  
  /**
   * Actualiza el buffer de patrones con datos reales para detección de dedo
   */
  public trackSignalForPatternDetection(value: number): void {
    if (!this.isValidSignal(value)) {
      return;
    }
    
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Analizar patrones para detección de dedo
    const hasValidPattern = this.detectPattern();
    
    const currentTime = Date.now();
    
    if (hasValidPattern) {
      // Incrementar contador solo si ha pasado suficiente tiempo desde última detección
      if (currentTime - this.lastValidPatternTime > 200) {
        this.consecutiveValidPatterns++;
        this.lastValidPatternTime = currentTime;
      }
      
      if (this.consecutiveValidPatterns >= this.MIN_CONSECUTIVE_PATTERNS) {
        this.fingerDetected = true;
      }
    } else {
      // Reducir contador si no hay patrón válido
      if (currentTime - this.lastValidPatternTime > 1000) {
        this.consecutiveValidPatterns = Math.max(0, this.consecutiveValidPatterns - 1);
        
        if (this.consecutiveValidPatterns < this.MIN_CONSECUTIVE_PATTERNS / 2) {
          this.fingerDetected = false;
        }
      }
    }
  }
  
  /**
   * Detecta patrones cardíacos en la señal
   */
  private detectPattern(): boolean {
    if (this.patternBuffer.length < 10) {
      return false;
    }
    
    // Detectar picos en la señal
    const peaks = this.findPeaks(this.patternBuffer);
    
    // Verificar si hay suficientes picos para formar un patrón cardíaco
    if (peaks.length < 2) {
      return false;
    }
    
    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Verificar consistencia de intervalos (ritmo cardíaco natural)
    if (intervals.length < 2) {
      return false;
    }
    
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Verificar que los intervalos sean fisiológicamente plausibles
    if (avgInterval < 3 || avgInterval > 40) { // ~30-200 BPM en muestras
      return false;
    }
    
    // Verificar consistencia de intervalos
    let consistentIntervals = 0;
    for (const interval of intervals) {
      const variation = Math.abs(interval - avgInterval) / avgInterval;
      if (variation < 0.3) { // Permitir 30% de variación
        consistentIntervals++;
      }
    }
    
    const consistencyRatio = consistentIntervals / intervals.length;
    return consistencyRatio > 0.6; // Al menos 60% de intervalos consistentes
  }
  
  /**
   * Encuentra picos en el buffer de señal
   */
  private findPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    
    // Calcular estadísticas de señal para umbral adaptativo
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const stdDev = Math.sqrt(
      signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length
    );
    
    // Umbral adaptativo basado en estadísticas de señal
    const threshold = mean + stdDev * 0.5;
    
    // Encontrar picos que estén por encima del umbral
    for (let i = 2; i < signal.length - 2; i++) {
      const current = signal[i];
      
      if (current > threshold &&
          current > signal[i-1] && 
          current > signal[i-2] &&
          current > signal[i+1] && 
          current > signal[i+2]) {
        
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Verifica si hay un dedo detectado
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }
  
  /**
   * Reinicia la detección de dedo
   */
  public resetFingerDetection(): void {
    this.patternBuffer = [];
    this.fingerDetected = false;
    this.lastValidPatternTime = 0;
    this.consecutiveValidPatterns = 0;
  }
  
  /**
   * Registra resultados de validación para propósitos de depuración
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("SignalValidator: Resultados de validación", {
      isValid,
      amplitude,
      minAmplitudRequerida: this.MIN_SIGNAL_AMPLITUDE,
      puntosDeDatos: values.length,
      minimoRequerido: this.MIN_DATA_POINTS,
      ultimosValores: values.slice(-5),
      fingerDetected: this.fingerDetected,
      consecutiveValidPatterns: this.consecutiveValidPatterns
    });
  }
}
