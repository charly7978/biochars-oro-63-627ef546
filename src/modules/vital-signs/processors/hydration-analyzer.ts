
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Analizador de nivel de hidratación basado en características de PPG
 * Utiliza cambios en elasticidad vascular y viscosidad sanguínea reflejados en señal PPG
 * Advertencia: La estimación no invasiva de hidratación es experimental y tiene baja precisión
 */
export class HydrationAnalyzer extends BaseProcessor {
  private readonly DEFAULT_HYDRATION = 0;
  private readonly MIN_QUALITY_THRESHOLD = 70;
  private readonly MIN_BUFFER_SIZE = 100;
  
  // Coeficientes para el modelo
  private readonly COEFS = {
    pulseRateVariability: 0.3,
    pulseAmplitude: 0.4,
    dicroticNotchPosition: 0.3
  };
  
  // Buffer para análisis
  private pulseFeatures: any[] = [];
  
  constructor() {
    super();
    console.log("HydrationAnalyzer: Initialized");
  }
  
  /**
   * Calcula nivel de hidratación basado en análisis PPG
   * @param filteredValue Valor filtrado de señal PPG
   * @param signalBuffer Buffer completo de señal
   * @returns Nivel estimado de hidratación (0-100%)
   */
  public calculateHydration(
    filteredValue: number,
    signalBuffer: number[]
  ): number {
    // Si no hay suficientes datos, retornar valor por defecto
    if (signalBuffer.length < this.MIN_BUFFER_SIZE) {
      return this.DEFAULT_HYDRATION;
    }
    
    // Actualizar características de pulso si hay suficientes datos
    if (signalBuffer.length >= 100 && this.pulseFeatures.length < 3) {
      this.updatePulseFeatures(signalBuffer);
    }
    
    // Si no hay suficientes características de pulso, retornar valor por defecto
    if (this.pulseFeatures.length < 3) {
      return this.DEFAULT_HYDRATION;
    }
    
    // Calcular características relevantes para hidratación
    const pulseRateVariability = this.calculatePulseRateVariability();
    const pulseAmplitudeRatio = this.calculatePulseAmplitudeRatio();
    const dicroticNotchPosition = this.calculateDicroticNotchPosition();
    
    // Modelo simplificado para estimación de hidratación
    // Mayor variabilidad, menor amplitud y posición tardía de muesca dicrótica
    // correlacionan con menor hidratación
    const hydrationScore = 
      (1 - pulseRateVariability) * this.COEFS.pulseRateVariability + 
      pulseAmplitudeRatio * this.COEFS.pulseAmplitude + 
      (1 - dicroticNotchPosition) * this.COEFS.dicroticNotchPosition;
    
    // Convertir a porcentaje (0-100%)
    const hydrationPercent = hydrationScore * 100;
    
    // Limitar a rango válido
    const boundedHydration = Math.min(100, Math.max(0, hydrationPercent));
    
    return Math.round(boundedHydration);
  }
  
  /**
   * Actualiza características de pulso a partir de la señal
   * @param signal Señal PPG
   */
  private updatePulseFeatures(signal: number[]): void {
    // Detectar picos en la señal
    const peakIndices = this.detectPeaks(signal);
    
    // Si no hay suficientes picos, no se puede analizar
    if (peakIndices.length < 3) return;
    
    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      intervals.push(peakIndices[i] - peakIndices[i - 1]);
    }
    
    // Analizar cada pulso (entre dos picos)
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const startIdx = peakIndices[i];
      const endIdx = peakIndices[i + 1];
      
      // Extraer un pulso
      const pulse = signal.slice(startIdx, endIdx);
      
      // Si el pulso es demasiado corto o largo, saltar
      if (pulse.length < 10 || pulse.length > 50) continue;
      
      // Encontrar amplitud del pulso
      const baseline = Math.min(...pulse);
      const peak = Math.max(...pulse);
      const amplitude = peak - baseline;
      
      // Buscar muesca dicrótica (primer mínimo local después del pico)
      let peakIdx = 0;
      for (let j = 0; j < pulse.length; j++) {
        if (pulse[j] === peak) {
          peakIdx = j;
          break;
        }
      }
      
      let dicroticIdx = -1;
      for (let j = peakIdx + 2; j < pulse.length - 1; j++) {
        if (pulse[j] < pulse[j-1] && pulse[j] < pulse[j+1]) {
          dicroticIdx = j;
          break;
        }
      }
      
      // Calcular posición relativa de la muesca dicrótica
      const dicroticPosition = dicroticIdx > 0 ? dicroticIdx / pulse.length : 0.5;
      
      // Almacenar características
      this.pulseFeatures.push({
        amplitude: amplitude,
        length: pulse.length,
        dicroticPosition: dicroticPosition,
        interval: intervals[i] || 0
      });
      
      // Limitar número de características almacenadas
      if (this.pulseFeatures.length > 10) {
        this.pulseFeatures.shift();
      }
    }
  }
  
  /**
   * Calcula variabilidad de frecuencia de pulso
   */
  private calculatePulseRateVariability(): number {
    if (this.pulseFeatures.length < 3) return 0.5; // Valor default
    
    const intervals = this.pulseFeatures.map(feature => feature.interval)
                         .filter(interval => interval > 0);
    
    if (intervals.length < 3) return 0.5;
    
    // Calcular coeficiente de variación
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    const cv = stdDev / mean;
    
    // Normalizar entre 0 y 1 (mayor valor = mayor variabilidad)
    return Math.min(1, Math.max(0, cv / 0.2));
  }
  
  /**
   * Calcula ratio de amplitud de pulso
   */
  private calculatePulseAmplitudeRatio(): number {
    if (this.pulseFeatures.length < 3) return 0.5; // Valor default
    
    const amplitudes = this.pulseFeatures.map(feature => feature.amplitude);
    const maxAmplitude = Math.max(...amplitudes);
    const minAmplitude = Math.min(...amplitudes);
    
    // Normalizar entre 0 y 1 (mayor valor = mejor hidratación)
    return maxAmplitude > 0 ? Math.min(1, Math.max(0, minAmplitude / maxAmplitude)) : 0.5;
  }
  
  /**
   * Calcula posición promedio de muesca dicrótica
   */
  private calculateDicroticNotchPosition(): number {
    if (this.pulseFeatures.length < 3) return 0.5; // Valor default
    
    const positions = this.pulseFeatures.map(feature => feature.dicroticPosition)
                          .filter(pos => pos > 0);
    
    if (positions.length < 3) return 0.5;
    
    // Calcular promedio
    const avgPosition = positions.reduce((sum, val) => sum + val, 0) / positions.length;
    
    // Normalizar entre 0 y 1 (mayor valor = peor hidratación)
    return Math.min(1, Math.max(0, avgPosition));
  }
  
  /**
   * Detecta picos en señal PPG
   * @param signal Señal PPG
   * @returns Índices de picos detectados
   */
  private detectPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 15; // Distancia mínima entre picos
    
    for (let i = 2; i < signal.length - 2; i++) {
      if (signal[i] > signal[i-1] && 
          signal[i] > signal[i-2] && 
          signal[i] > signal[i+1] && 
          signal[i] > signal[i+2]) {
        
        // Si ya hay picos detectados, verificar distancia mínima
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance) {
          peaks.push(i);
        }
      }
    }
    
    return peaks;
  }
  
  /**
   * Reinicia el analizador
   */
  public reset(): void {
    super.reset();
    this.pulseFeatures = [];
    console.log("HydrationAnalyzer: Reset complete");
  }
}
