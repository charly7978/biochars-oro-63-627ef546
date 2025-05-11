
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Clase para validación de señal PPG usando un enfoque basado en patrones rítmicos
 * Implementa detección de patrones basado en análisis de señal real sin simulación
 */
export class SignalValidator {
  private signalBuffer: number[] = [];
  private readonly bufferSize: number = 60;
  private readonly minQuality: number = 0.02;
  private readonly minPatterns: number = 15;
  private patternCount: number = 0;
  private fingerDetected: boolean = false;
  private lastPatternDetection: number = 0;
  private consecutiveGoodPatterns: number = 0;
  
  constructor(minQuality: number = 0.02, minPatterns: number = 15) {
    this.minQuality = minQuality;
    this.minPatterns = minPatterns;
  }
  
  /**
   * Añade un valor a la detección de patrones
   */
  public trackSignalForPatternDetection(value: number): void {
    this.signalBuffer.push(value);
    
    // Mantener buffer de tamaño fijo
    if (this.signalBuffer.length > this.bufferSize) {
      this.signalBuffer.shift();
    }
    
    // Detectar patrones solo si tenemos suficientes datos
    if (this.signalBuffer.length >= 30) {
      const now = Date.now();
      
      // Solo detectar cada 500ms para mejorar rendimiento
      if (this.lastPatternDetection === 0 || now - this.lastPatternDetection >= 500) {
        this.lastPatternDetection = now;
        this.detectPatterns();
      }
    }
  }
  
  /**
   * Detecta patrones rítmicos en la señal usando análisis de autocorrelación
   */
  private detectPatterns(): void {
    // Calcular la calidad del patrón
    const patternQuality = this.calculatePatternQuality();
    
    // Si no hay suficiente calidad, decrementar contador de patrones
    if (patternQuality < this.minQuality) {
      this.patternCount = Math.max(0, this.patternCount - 1);
      this.consecutiveGoodPatterns = 0;
      return;
    }
    
    // Si hay buena calidad, incrementar contador
    this.patternCount = Math.min(this.minPatterns + 5, this.patternCount + 1);
    this.consecutiveGoodPatterns++;
    
    // Si hay suficientes detecciones consistentes, confirmar detección de dedo
    // IMPORTANTE: Aquí aumentamos la validación para evitar falsos positivos
    if (this.patternCount >= this.minPatterns && this.consecutiveGoodPatterns >= 5) {
      if (!this.fingerDetected) {
        console.log("SignalValidator: Finger detection confirmed by signal pattern", {
          patternQuality,
          patternCount: this.patternCount,
          time: new Date().toISOString()
        });
      }
      this.fingerDetected = true;
    } else if (this.patternCount < Math.max(2, this.minPatterns / 2)) {
      // Si cae mucho, desactivar detección
      this.fingerDetected = false;
    }
  }
  
  /**
   * Calcula la calidad de patrones rítmicos en la señal
   * Utiliza técnicas de autocorrelación para detectar periodicidad típica de PPG real
   */
  private calculatePatternQuality(): number {
    const values = this.signalBuffer.slice(-30);
    
    // Calcular la varianza para verificar que hay suficiente señal
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    // Si la varianza es muy baja, no hay señal significativa
    if (variance < 0.001) {
      return 0;
    }
    
    // Calcular la autocorrelación para detectar periodicidad
    // La periodicidad es un indicador de señal PPG real
    let maxCorrelation = 0;
    // Buscar correlación en rangos de 500ms a 1500ms (40-120 BPM)
    for (let delay = 5; delay <= 15; delay++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < values.length - delay; i++) {
        correlation += values[i] * values[i + delay];
        count++;
      }
      
      if (count > 0) {
        correlation /= count;
        maxCorrelation = Math.max(maxCorrelation, correlation);
      }
    }
    
    // Normalizar y aplicar umbral
    const quality = maxCorrelation / (variance || 0.001);
    return quality;
  }
  
  /**
   * Verifica si se ha detectado un dedo
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }
  
  /**
   * Reinicia la detección de dedo
   */
  public resetFingerDetection(): void {
    this.signalBuffer = [];
    this.patternCount = 0;
    this.fingerDetected = false;
    this.lastPatternDetection = 0;
    this.consecutiveGoodPatterns = 0;
  }
  
  /**
   * Método para verificar si la señal es válida
   * @param value El valor de la señal PPG
   * @returns true si la señal es válida, false en caso contrario
   */
  public isValidSignal(value: number): boolean {
    // Una señal es válida si no es NaN, no es infinito y tiene un valor mínimo
    if (isNaN(value) || !isFinite(value)) return false;
    
    // Verificar magnitud mínima para considerar señal válida
    return Math.abs(value) >= 0.01;
  }
  
  /**
   * Verifica si tenemos suficientes datos para procesar
   * @param values Los valores de la señal PPG
   * @returns true si hay suficientes datos, false en caso contrario
   */
  public hasEnoughData(values: number[]): boolean {
    // Necesitamos al menos 30 muestras para un cálculo confiable
    return values.length >= 30;
  }
  
  /**
   * Verifica si la señal tiene amplitud suficiente
   * @param values Los valores de la señal PPG
   * @returns true si la señal tiene amplitud suficiente, false en caso contrario
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 5) return false;
    
    // Calcular amplitud como diferencia entre máximo y mínimo
    const recentValues = values.slice(-15);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // La amplitud debe ser mayor a un umbral para detectar señal válida
    return amplitude >= 0.1;
  }
  
  /**
   * Registra y muestra resultados de validación
   * @param isValid Si la validación fue exitosa
   * @param amplitude La amplitud de la señal
   * @param values Los valores de la señal
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("SignalValidator: Validation results", {
      isValid,
      amplitude,
      sampleCount: values.length,
      time: new Date().toISOString()
    });
  }
}
