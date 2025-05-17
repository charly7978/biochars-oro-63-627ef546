
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Analizador de nivel de hidratación basado en características de señal PPG
 * Evalúa viscosidad sanguínea y elasticidad vascular mediante análisis de forma de onda
 */
export class HydrationAnalyzer extends BaseProcessor {
  private readonly MIN_BUFFER_SIZE = 60;
  
  constructor() {
    super();
    console.log("HydrationAnalyzer: Initialized");
  }
  
  /**
   * Calcula nivel de hidratación basado en análisis de señal PPG
   * @param filteredValue Valor PPG filtrado actual
   * @param buffer Buffer de valores PPG filtrados
   * @returns Nivel de hidratación (0-100%)
   */
  public calculateHydration(
    filteredValue: number,
    buffer: number[]
  ): number {
    // Verificar datos mínimos para análisis
    if (buffer.length < this.MIN_BUFFER_SIZE) {
      return 0;
    }
    
    try {
      // Extraer características relevantes para hidratación
      const recentBuffer = buffer.slice(-this.MIN_BUFFER_SIZE);
      const waveformFeatures = this.extractHydrationFeatures(recentBuffer);
      
      if (!waveformFeatures) {
        return 0;
      }
      
      // Calcular índice de hidratación basado en características
      const hydrationIndex = this.calculateHydrationIndex(waveformFeatures);
      
      // Convertir a porcentaje (0-100%)
      const hydrationPercent = hydrationIndex * 100;
      
      // Asegurar valores plausibles
      return Math.min(100, Math.max(0, Math.round(hydrationPercent)));
    } catch (error) {
      console.error("Error calculating hydration:", error);
      return 0;
    }
  }
  
  /**
   * Extrae características de la forma de onda PPG relevantes para hidratación
   * La deshidratación afecta la viscosidad sanguínea y la elasticidad vascular
   */
  private extractHydrationFeatures(buffer: number[]): {
    elasticityIndex: number;
    riseTimeRatio: number;
    slipperyIndex: number;
    dicroticAmplitude: number;
  } | null {
    // Analizar por ventanas para mejorar precisión
    const windowSize = 30;
    const windows = Math.floor(buffer.length / windowSize);
    
    if (windows < 2) return null;
    
    let totalElasticityIndex = 0;
    let totalRiseTimeRatio = 0;
    let totalSlipperyIndex = 0;
    let totalDicroticAmplitude = 0;
    let validWindows = 0;
    
    for (let w = 0; w < windows; w++) {
      const start = w * windowSize;
      const end = start + windowSize;
      const segment = buffer.slice(start, end);
      
      // Encontrar pico sistólico principal
      let peakIndex = 0;
      let peakValue = segment[0];
      
      for (let i = 1; i < segment.length; i++) {
        if (segment[i] > peakValue) {
          peakValue = segment[i];
          peakIndex = i;
        }
      }
      
      // Si el pico está muy cerca del borde, descartar ventana
      if (peakIndex < 2 || peakIndex > segment.length - 5) continue;
      
      // Encontrar valle inicial (inicio sistólico)
      let startValleyIndex = 0;
      let startValleyValue = segment[0];
      
      for (let i = 0; i < peakIndex; i++) {
        if (segment[i] < startValleyValue) {
          startValleyValue = segment[i];
          startValleyIndex = i;
        }
      }
      
      // Buscar muesca dicrotic después del pico
      let dicroticIndex = -1;
      let dicroticValue = peakValue;
      let hasDicroticNotch = false;
      
      // Buscar punto de inflexión después del pico
      for (let i = peakIndex + 1; i < Math.min(segment.length - 1, peakIndex + 15); i++) {
        // Estimación de segunda derivada para detectar punto de inflexión
        if (i > peakIndex + 1 && i < segment.length - 1) {
          const firstDeriv1 = segment[i] - segment[i-1];
          const firstDeriv2 = segment[i+1] - segment[i];
          
          // Cambio en pendiente indica punto de inflexión
          if (firstDeriv1 <= 0 && firstDeriv2 >= 0) {
            dicroticIndex = i;
            dicroticValue = segment[i];
            hasDicroticNotch = true;
            break;
          }
        }
      }
      
      // Si no se encontró muesca dicrotic clara, estimar posición
      if (!hasDicroticNotch) {
        dicroticIndex = Math.min(segment.length - 1, peakIndex + Math.floor((segment.length - peakIndex) / 3));
        dicroticValue = segment[dicroticIndex];
      }
      
      // Buscar valle final o punto más bajo después de la muesca dicrotic
      let endValleyIndex = dicroticIndex;
      let endValleyValue = segment[dicroticIndex];
      
      for (let i = dicroticIndex + 1; i < segment.length; i++) {
        if (segment[i] < endValleyValue) {
          endValleyValue = segment[i];
          endValleyIndex = i;
        }
      }
      
      // Calcular características relacionadas con hidratación
      
      // 1. Índice de elasticidad: relacionado con tiempo de retorno diastólico
      // Una menor elasticidad (mayor rigidez) indica posible deshidratación
      const elasticityIndex = (segment.length - peakIndex) / segment.length;
      
      // 2. Relación de tiempo de subida: tiempo de subida vs. tiempo total
      // Deshidratación tiende a acortar esta relación
      const riseTime = peakIndex - startValleyIndex;
      const totalTime = segment.length;
      const riseTimeRatio = riseTime / totalTime;
      
      // 3. Índice de "deslizamiento": cuán rápido cae la señal después del pico
      // Deshidratación suele aumentar este índice
      const peakToNotchSlope = hasDicroticNotch
        ? (peakValue - dicroticValue) / (dicroticIndex - peakIndex)
        : 0;
      const slipperyIndex = peakToNotchSlope / (peakValue - startValleyValue);
      
      // 4. Amplitud de la muesca dicrotic: indicador de tono vascular
      // Menor amplitud puede indicar deshidratación
      const dicroticAmplitude = (dicroticValue - endValleyValue) / (peakValue - startValleyValue);
      
      // Acumular valores para promedio
      totalElasticityIndex += elasticityIndex;
      totalRiseTimeRatio += riseTimeRatio;
      totalSlipperyIndex += slipperyIndex;
      totalDicroticAmplitude += dicroticAmplitude;
      validWindows++;
    }
    
    if (validWindows === 0) return null;
    
    // Calcular promedios
    return {
      elasticityIndex: totalElasticityIndex / validWindows,
      riseTimeRatio: totalRiseTimeRatio / validWindows,
      slipperyIndex: totalSlipperyIndex / validWindows,
      dicroticAmplitude: totalDicroticAmplitude / validWindows
    };
  }
  
  /**
   * Calcula índice de hidratación a partir de características extraídas
   * Basado en estudios que correlacionan elasticidad vascular y viscosidad
   * sanguínea con el estado de hidratación
   */
  private calculateHydrationIndex(
    features: NonNullable<ReturnType<HydrationAnalyzer['extractHydrationFeatures']>>
  ): number {
    const {
      elasticityIndex,
      riseTimeRatio,
      slipperyIndex,
      dicroticAmplitude
    } = features;
    
    // Normalizar características
    const normalizedElasticity = Math.min(1.0, Math.max(0, elasticityIndex / 0.7));
    const normalizedRiseTime = Math.min(1.0, Math.max(0, riseTimeRatio / 0.3));
    const normalizedSlippery = Math.min(1.0, Math.max(0, 1 - (slipperyIndex / 0.2)));
    const normalizedDicrotic = Math.min(1.0, Math.max(0, dicroticAmplitude / 0.3));
    
    // Ponderaciones basadas en importancia relativa
    // Mayor elasticidad, mayor dicrótico y menor deslizamiento → mejor hidratación
    const w1 = 0.30; // Elasticidad
    const w2 = 0.15; // Tiempo de subida
    const w3 = 0.25; // Deslizamiento inverso
    const w4 = 0.30; // Amplitud dicrotic
    
    // Modelo de hidratación: 0 (deshidratado) a 1 (bien hidratado)
    return w1 * normalizedElasticity +
           w2 * normalizedRiseTime +
           w3 * normalizedSlippery +
           w4 * normalizedDicrotic;
  }
  
  /**
   * Reinicia el analizador
   */
  public reset(): void {
    super.reset();
    console.log("HydrationAnalyzer: Reset complete");
  }
}
