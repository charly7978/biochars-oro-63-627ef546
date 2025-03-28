
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Extractor de señal PPG - especializado en la extracción y limpieza básica
 * Solo trabaja con datos reales sin simulaciones
 */

/**
 * Resultado de la extracción de señal PPG
 */
export interface PPGSignalExtractionResult {
  // Información de tiempo
  timestamp: number;
  
  // Valores de señal
  rawValue: number;
  filteredValue: number;
  
  // Métricas de señal
  quality: number;
  fingerDetected: boolean;
  amplitude: number;
  baseline: number;
}

/**
 * Clase para la extracción especializada de señal PPG
 */
export class PPGSignalExtractor {
  // Almacenamiento de valores
  private rawValues: number[] = [];
  private filteredValues: number[] = [];
  
  // Línea base y amplitud
  private baselineValue: number = 0;
  private signalAmplitude: number = 0;
  
  // Factores de filtrado
  private readonly ALPHA_EMA = 0.2; // Factor de suavizado exponencial
  private readonly RECENT_WINDOW_SIZE = 30; // Tamaño de ventana para análisis
  
  /**
   * Procesa un valor PPG crudo y extrae una señal limpia
   * @param value Valor PPG sin procesar
   * @returns Resultado de la extracción con señal procesada
   */
  public processValue(value: number): PPGSignalExtractionResult {
    const now = Date.now();
    
    // Almacenar valor crudo
    this.rawValues.push(value);
    if (this.rawValues.length > this.RECENT_WINDOW_SIZE * 2) {
      this.rawValues.shift();
    }
    
    // Aplicar filtrado básico (EMA - Exponential Moving Average)
    const filteredValue = this.applyBasicFiltering(value);
    
    // Almacenar valor filtrado
    this.filteredValues.push(filteredValue);
    if (this.filteredValues.length > this.RECENT_WINDOW_SIZE * 2) {
      this.filteredValues.shift();
    }
    
    // Actualizar línea base y amplitud
    this.updateBaselineAndAmplitude();
    
    // Calcular calidad de señal y detección de dedo
    const quality = this.calculateSignalQuality();
    const fingerDetected = this.isFingerDetected();
    
    return {
      timestamp: now,
      rawValue: value,
      filteredValue,
      quality,
      fingerDetected,
      amplitude: this.signalAmplitude,
      baseline: this.baselineValue
    };
  }
  
  /**
   * Aplica filtrado básico al valor crudo
   */
  private applyBasicFiltering(value: number): number {
    // Si no hay valores previos, devolver valor actual
    if (this.filteredValues.length === 0) {
      return value;
    }
    
    // Filtro EMA (Exponential Moving Average)
    const lastFilteredValue = this.filteredValues[this.filteredValues.length - 1];
    return this.ALPHA_EMA * value + (1 - this.ALPHA_EMA) * lastFilteredValue;
  }
  
  /**
   * Actualiza la línea base y amplitud de la señal
   */
  private updateBaselineAndAmplitude(): void {
    if (this.filteredValues.length < 5) return;
    
    // Usar solo los valores recientes
    const recentValues = this.filteredValues.slice(-this.RECENT_WINDOW_SIZE);
    
    // Calcular min y max para amplitud
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    
    // Actualizar amplitud
    this.signalAmplitude = max - min;
    
    // Línea base como promedio
    this.baselineValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  }
  
  /**
   * Calcula la calidad de la señal (0-100)
   */
  private calculateSignalQuality(): number {
    if (this.filteredValues.length < 10) return 0;
    
    // Ventana reciente para análisis
    const recentValues = this.filteredValues.slice(-this.RECENT_WINDOW_SIZE);
    const recentRawValues = this.rawValues.slice(-this.RECENT_WINDOW_SIZE);
    
    // Factores de calidad
    
    // 1. Amplitud de señal (peso: 40%)
    const amplitudeScore = Math.min(1, this.signalAmplitude / 0.4);
    
    // 2. Relación señal-ruido (peso: 40%)
    // Calculamos la variabilidad entre crudo y filtrado
    let noiseSum = 0;
    for (let i = 0; i < recentValues.length && i < recentRawValues.length; i++) {
      noiseSum += Math.abs(recentValues[i] - recentRawValues[i]);
    }
    const avgNoise = noiseSum / recentValues.length;
    const snrScore = Math.max(0, 1 - (avgNoise / (this.signalAmplitude + 0.001)));
    
    // 3. Estabilidad de la línea base (peso: 20%)
    // Desviación estándar de la señal normalizada
    const normalizedValues = recentValues.map(v => (v - this.baselineValue) / (this.signalAmplitude + 0.001));
    const mean = normalizedValues.reduce((sum, val) => sum + val, 0) / normalizedValues.length;
    const variance = normalizedValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / normalizedValues.length;
    const stdDev = Math.sqrt(variance);
    const stabilityScore = Math.max(0, 1 - stdDev);
    
    // Calidad ponderada total (0-1)
    const weightedQuality = 
      0.4 * amplitudeScore + 
      0.4 * snrScore + 
      0.2 * stabilityScore;
    
    // Convertir a escala 0-100
    return Math.round(weightedQuality * 100);
  }
  
  /**
   * Determina si un dedo está detectado basado en la calidad de la señal
   */
  private isFingerDetected(): boolean {
    // Criterios para la detección del dedo:
    // 1. Amplitud mínima
    const hasMinimumAmplitude = this.signalAmplitude > 0.05;
    
    // 2. Calidad mínima
    const quality = this.calculateSignalQuality();
    const hasMinimumQuality = quality > 20;
    
    return hasMinimumAmplitude && hasMinimumQuality;
  }
  
  /**
   * Reinicia el extractor
   */
  public reset(): void {
    this.rawValues = [];
    this.filteredValues = [];
    this.baselineValue = 0;
    this.signalAmplitude = 0;
  }
}

/**
 * Crea una instancia de extractor de señal PPG
 */
export const createPPGSignalExtractor = (): PPGSignalExtractor => {
  return new PPGSignalExtractor();
};
