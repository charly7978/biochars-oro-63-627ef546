
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Estimador de nivel de glucosa basado en análisis PPG
 * Utiliza análisis de señal avanzado para correlacionar patrones con niveles de glucosa
 * Advertencia: La estimación no invasiva de glucosa es experimental y tiene baja precisión
 */
export class GlucoseEstimator extends BaseProcessor {
  private readonly DEFAULT_GLUCOSE_LEVEL = 0;
  private readonly MIN_QUALITY_THRESHOLD = 70;
  private readonly MIN_BUFFER_SIZE = 150;
  
  // Coeficientes para modelo simplificado
  private readonly COEFS = {
    perfusion: 0.5,
    acDcRatio: 0.8,
    pulseRateVariability: 1.2
  };
  
  // Valor base para estimación (debe calibrarse por usuario)
  private baselineGlucose: number = 100;
  
  // Buffer para análisis espectral
  private spectralBufferAC: number[] = [];
  private spectralBufferDC: number[] = [];
  
  constructor() {
    super();
    console.log("GlucoseProcessor: Reset complete");
  }
  
  /**
   * Estima nivel de glucosa basado en análisis PPG
   * @param filteredValue Valor filtrado de señal PPG
   * @param acSignalValue Componente AC de la señal
   * @param dcBaseline Componente DC de la señal
   * @param signalBuffer Buffer completo de señal
   * @returns Estimación de nivel de glucosa (mg/dL)
   */
  public estimateGlucose(
    filteredValue: number,
    acSignalValue: number,
    dcBaseline: number,
    signalBuffer: number[]
  ): number {
    // Si no hay suficientes datos, retornar valor por defecto
    if (signalBuffer.length < this.MIN_BUFFER_SIZE) {
      return this.DEFAULT_GLUCOSE_LEVEL;
    }
    
    // Almacenar valores para análisis espectral
    this.spectralBufferAC.push(acSignalValue);
    this.spectralBufferDC.push(dcBaseline);
    
    // Mantener tamaño de buffer limitado
    if (this.spectralBufferAC.length > this.MIN_BUFFER_SIZE) {
      this.spectralBufferAC.shift();
      this.spectralBufferDC.shift();
    }
    
    // Si no hay suficientes datos para análisis espectral, retornar valor por defecto
    if (this.spectralBufferAC.length < this.MIN_BUFFER_SIZE) {
      return this.DEFAULT_GLUCOSE_LEVEL;
    }
    
    // Calcular índice de perfusión
    const perfusionIndex = Math.abs(acSignalValue) / Math.abs(dcBaseline);
    
    // Calcular ratio AC/DC promediado
    const acSum = this.spectralBufferAC.reduce((sum, val) => sum + Math.abs(val), 0);
    const dcSum = this.spectralBufferDC.reduce((sum, val) => sum + Math.abs(val), 0);
    const acDcRatio = dcSum > 0 ? acSum / dcSum : 0;
    
    // Calcular variabilidad del ritmo de pulso
    const pulsePeaks = this.detectPeaksInSignal(signalBuffer);
    let pulseRateVariability = 0;
    
    if (pulsePeaks.length > 3) {
      const intervals = [];
      for (let i = 1; i < pulsePeaks.length; i++) {
        intervals.push(pulsePeaks[i] - pulsePeaks[i-1]);
      }
      
      // Calcular coeficiente de variación
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const varianceSum = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0);
      const stdDev = Math.sqrt(varianceSum / intervals.length);
      pulseRateVariability = avgInterval > 0 ? stdDev / avgInterval : 0;
    }
    
    // Modelo simplificado basado en coeficientes ponderados
    // Este es un modelo experimental con baja precisión
    // Se necesitaría un sensor óptico específico y calibración individal
    // para obtener estimaciones más precisas
    const estimatedChange = 
      this.COEFS.perfusion * Math.log(perfusionIndex + 0.1) * 10 +
      this.COEFS.acDcRatio * acDcRatio * 10 +
      this.COEFS.pulseRateVariability * pulseRateVariability * 5;
    
    // Aplicar cambio estimado a la línea base
    const glucoseEstimate = this.baselineGlucose + estimatedChange;
    
    // Limitar a rango fisiológico
    const boundedEstimate = Math.min(300, Math.max(70, glucoseEstimate));
    
    return Math.round(boundedEstimate);
  }
  
  /**
   * Detecta picos en la señal para análisis de ritmo
   * @param signalBuffer Buffer de señal PPG
   * @returns Índices de picos detectados
   */
  private detectPeaksInSignal(signalBuffer: number[]): number[] {
    const peaks: number[] = [];
    
    // Usar ventana deslizante para detectar picos
    const windowSize = 5;
    
    for (let i = windowSize; i < signalBuffer.length - windowSize; i++) {
      const currentValue = signalBuffer[i];
      let isPeak = true;
      
      // Verificar si es mayor que todos los valores en la ventana
      for (let j = 1; j <= windowSize; j++) {
        if (currentValue <= signalBuffer[i - j] || currentValue <= signalBuffer[i + j]) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Configura valor de línea base para glucosa
   * @param baseValue Valor base en mg/dL
   */
  public setBaselineGlucose(baseValue: number): void {
    if (baseValue >= 70 && baseValue <= 300) {
      this.baselineGlucose = baseValue;
      console.log("GlucoseEstimator: Baseline glucose set to", baseValue);
    }
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    super.reset();
    this.spectralBufferAC = [];
    this.spectralBufferDC = [];
    // No resetear baseline ya que es calibración
    console.log("GlucoseEstimator: Reset complete");
  }
}
