
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 * 
 * Procesador basado en el algoritmo Pan-Tompkins adaptado para señales PPG.
 * Implementa las etapas de filtrado, derivación, cuadrado, integración con ventana
 * móvil y detección adaptativa de umbrales para identificar con precisión cada pulso.
 * 
 * Basado en el paper original:
 * "A Real-Time QRS Detection Algorithm" de Pan & Tompkins (1985)
 * adaptado específicamente para las características de señales PPG.
 */
export class PanTompkinsProcessor {
  // Parámetros del filtro paso banda (adaptados para señales PPG)
  private readonly LOW_FREQ = 0.5;  // Hz - Frecuencia de corte inferior
  private readonly HIGH_FREQ = 5.0; // Hz - Frecuencia de corte superior (menor que en ECG)
  
  // Parámetros para la ventana de integración
  private readonly WINDOW_SIZE = 16; // Menor que ECG debido a morfología diferente en PPG
  
  // Parámetros para detección adaptativa
  private readonly LEARNING_ALPHA = 0.125; // Factor de aprendizaje para umbral adaptativo
  private readonly SIGNAL_THRESHOLD = 0.3; // Umbral inicial para detección de picos
  private readonly NOISE_THRESHOLD = 0.1;  // Umbral para clasificación de ruido
  
  // Variables de estado para el procesamiento
  private bandPassBuffer: number[] = [];
  private derivativeBuffer: number[] = [];
  private squaredBuffer: number[] = [];
  private movingIntegrationBuffer: number[] = [];
  
  private threshold: number = this.SIGNAL_THRESHOLD;
  private noiseLevel: number = this.NOISE_THRESHOLD;
  private signalLevel: number = 0;
  
  // Control de picos
  private lastPeakTime: number = 0;
  private peakValue: number = 0;
  private readonly MIN_PEAK_DISTANCE = 300; // milisegundos
  
  // Métricas de rendimiento
  private detectedPeaks: number = 0;
  private recentPeakValues: number[] = [];
  private readonly PEAK_HISTORY_SIZE = 8;
  
  constructor() {
    this.reset();
    console.log("PanTompkinsProcessor: Procesador inicializado para señales PPG");
  }
  
  /**
   * Procesa un nuevo valor de señal PPG utilizando el algoritmo Pan-Tompkins modificado
   * @param value Valor actual de la señal PPG
   * @param buffer Buffer completo de señal PPG para contextualización (opcional)
   * @returns Resultado del procesamiento incluyendo detección de pico y métricas
   */
  public process(value: number, buffer?: number[]): {
    isPeak: boolean;
    threshold: number;
    accuracy: number;
    signalStrength: number;
  } {
    const currentTime = Date.now();
    let isPeak = false;
    
    // 1. Filtrado paso banda (implementación simplificada)
    const bandPassValue = this.applyBandPassFilter(value);
    
    // 2. Derivación (realza pendientes para mejor detección de pulsos)
    const derivativeValue = this.applyDerivative(bandPassValue);
    
    // 3. Cuadrado (enfatiza frecuencias altas y asegura positividad)
    const squaredValue = derivativeValue * derivativeValue;
    
    // 4. Integración con ventana móvil (suaviza múltiples picos en un solo pulso)
    const integratedValue = this.applyMovingWindowIntegration(squaredValue);
    
    // 5. Detección adaptativa de picos
    if (integratedValue > this.threshold && 
        currentTime - this.lastPeakTime > this.MIN_PEAK_DISTANCE) {
      
      // Detectar pico y actualizar niveles
      isPeak = true;
      this.peakValue = integratedValue;
      this.lastPeakTime = currentTime;
      this.detectedPeaks++;
      
      // Actualizar historial de picos para análisis de consistencia
      this.recentPeakValues.push(integratedValue);
      if (this.recentPeakValues.length > this.PEAK_HISTORY_SIZE) {
        this.recentPeakValues.shift();
      }
      
      // Actualizar niveles de señal y ruido para adaptación
      this.signalLevel = this.LEARNING_ALPHA * integratedValue + 
                        (1 - this.LEARNING_ALPHA) * this.signalLevel;
      
      // Actualizar umbral adaptativo basado en nivel de señal
      this.threshold = this.noiseLevel + 
                       0.3 * (this.signalLevel - this.noiseLevel);
      
      console.log("PanTompkinsProcessor: Pico detectado", {
        valor: integratedValue.toFixed(3),
        umbral: this.threshold.toFixed(3),
        tiempo: new Date(currentTime).toISOString(),
        intervalo: this.detectedPeaks > 1 ? currentTime - this.lastPeakTime : 0
      });
    } else if (integratedValue < this.threshold * 0.5) {
      // Valores muy por debajo del umbral se consideran ruido
      this.noiseLevel = this.LEARNING_ALPHA * integratedValue + 
                      (1 - this.LEARNING_ALPHA) * this.noiseLevel;
    }
    
    // Calcular métricas de precisión basadas en la consistencia de los picos
    const accuracy = this.calculatePeakConsistency();
    
    // Calcular fuerza de la señal
    const signalToNoiseRatio = this.signalLevel > 0 ? 
                              this.signalLevel / Math.max(this.noiseLevel, 0.01) : 0;
    
    return {
      isPeak,
      threshold: this.threshold,
      accuracy,
      signalStrength: signalToNoiseRatio
    };
  }
  
  /**
   * Aplica un filtro paso banda simplificado - adaptado para PPG
   * En una implementación completa, esto utilizaría filtros IIR o FIR
   */
  private applyBandPassFilter(value: number): number {
    // Implementación simplificada de filtro paso banda usando promedio móvil
    this.bandPassBuffer.push(value);
    if (this.bandPassBuffer.length > 10) {
      this.bandPassBuffer.shift();
    }
    
    // Promedio de valores recientes (filtro paso bajo simplificado)
    const filtered = this.bandPassBuffer.reduce((sum, val) => sum + val, 0) / 
                     this.bandPassBuffer.length;
    
    return filtered;
  }
  
  /**
   * Aplica operación de derivada para resaltar pendientes rápidas
   * Adaptado para la morfología específica de PPG
   */
  private applyDerivative(value: number): number {
    this.derivativeBuffer.push(value);
    if (this.derivativeBuffer.length > 4) {
      this.derivativeBuffer.shift();
    }
    
    // Necesitamos al menos 4 muestras para la derivada
    if (this.derivativeBuffer.length < 4) {
      return 0;
    }
    
    // Derivada de múltiples puntos (adaptada de Pan-Tompkins)
    // Coeficientes ajustados para señales PPG
    const derivative = (
      2 * this.derivativeBuffer[3] + 
      this.derivativeBuffer[2] - 
      this.derivativeBuffer[0] - 
      2 * this.derivativeBuffer[1]
    ) / 4.0;
    
    return derivative;
  }
  
  /**
   * Aplica integración con ventana móvil para suavizar múltiples picos
   */
  private applyMovingWindowIntegration(value: number): number {
    this.squaredBuffer.push(value);
    if (this.squaredBuffer.length > this.WINDOW_SIZE) {
      this.squaredBuffer.shift();
    }
    
    // Calcular integral de ventana móvil
    const integrated = this.squaredBuffer.reduce((sum, val) => sum + val, 0) / 
                       this.WINDOW_SIZE;
    
    // Almacenar para análisis
    this.movingIntegrationBuffer.push(integrated);
    if (this.movingIntegrationBuffer.length > 2 * this.WINDOW_SIZE) {
      this.movingIntegrationBuffer.shift();
    }
    
    return integrated;
  }
  
  /**
   * Calcula la consistencia de los picos detectados como medida de precisión
   */
  private calculatePeakConsistency(): number {
    if (this.recentPeakValues.length < 3) {
      return 0.5; // Valor neutral si no hay suficientes picos
    }
    
    // Calcular coeficiente de variación de amplitudes de picos
    const mean = this.recentPeakValues.reduce((sum, val) => sum + val, 0) / 
                 this.recentPeakValues.length;
    
    const variance = this.recentPeakValues.reduce(
      (sum, val) => sum + Math.pow(val - mean, 2), 0
    ) / this.recentPeakValues.length;
    
    const stdDev = Math.sqrt(variance);
    const coeffVar = mean > 0 ? stdDev / mean : 1;
    
    // Convertir coeficiente de variación a puntuación de precisión (0-1)
    // Menor variación = mayor precisión
    let consistency = 0;
    if (coeffVar < 0.1) {
      consistency = 1.0; // Variación muy baja = alta precisión
    } else if (coeffVar < 0.3) {
      consistency = 0.8; // Variación baja
    } else if (coeffVar < 0.5) {
      consistency = 0.6; // Variación moderada
    } else if (coeffVar < 0.8) {
      consistency = 0.3; // Variación alta
    } else {
      consistency = 0.1; // Variación muy alta = baja precisión
    }
    
    // Ajustar por número de picos detectados (más picos = más confianza)
    const peakCountFactor = Math.min(1, this.recentPeakValues.length / this.PEAK_HISTORY_SIZE);
    
    return consistency * 0.7 + peakCountFactor * 0.3;
  }
  
  /**
   * Reinicia el procesador a su estado inicial
   */
  public reset(): void {
    this.bandPassBuffer = [];
    this.derivativeBuffer = [];
    this.squaredBuffer = [];
    this.movingIntegrationBuffer = [];
    
    this.threshold = this.SIGNAL_THRESHOLD;
    this.noiseLevel = this.NOISE_THRESHOLD;
    this.signalLevel = 0;
    
    this.lastPeakTime = 0;
    this.peakValue = 0;
    this.detectedPeaks = 0;
    this.recentPeakValues = [];
    
    console.log("PanTompkinsProcessor: Procesador reiniciado");
  }
}
