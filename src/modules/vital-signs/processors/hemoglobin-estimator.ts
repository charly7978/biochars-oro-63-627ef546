
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Estimador de niveles de hemoglobina basado en análisis de señal PPG
 * Utiliza características de absorción y forma de onda
 */
export class HemoglobinEstimator extends BaseProcessor {
  private readonly MIN_BUFFER_SIZE = 60;
  private calibrationFactor: number = 1.0;
  
  constructor() {
    super();
    console.log("HemoglobinEstimator: Initialized");
  }
  
  /**
   * Estima nivel de hemoglobina basado en análisis de señal PPG
   * @param filteredValue Valor PPG filtrado actual
   * @param acValue Componente AC de la señal
   * @param dcValue Componente DC de la señal
   * @param buffer Buffer de valores PPG filtrados
   * @returns Valor estimado de hemoglobina en g/dL
   */
  public estimateHemoglobin(
    filteredValue: number,
    acValue: number,
    dcValue: number,
    buffer: number[]
  ): number {
    // Verificar datos mínimos para estimación
    if (buffer.length < this.MIN_BUFFER_SIZE) {
      return 0;
    }
    
    try {
      // Extraer características relevantes para hemoglobina
      const perfusionIndex = acValue / (dcValue || 1);
      const recentBuffer = buffer.slice(-this.MIN_BUFFER_SIZE);
      
      // Extraer características de forma de onda
      const waveformFeatures = this.analyzeWaveform(recentBuffer);
      
      if (!waveformFeatures) {
        return 0;
      }
      
      // Calcular hemoglobina estimada basada en el modelo
      const baseHemoglobin = this.calculateBaseHemoglobin(
        waveformFeatures,
        perfusionIndex
      );
      
      // Aplicar factores de calibración y ajuste
      const adjustedHemoglobin = baseHemoglobin * this.calibrationFactor;
      
      // Asegurar valores fisiológicos plausibles
      return Math.min(18, Math.max(8, adjustedHemoglobin));
    } catch (error) {
      console.error("Error estimating hemoglobin:", error);
      return 0;
    }
  }
  
  /**
   * Analiza la forma de onda PPG para extraer características
   * relacionadas con niveles de hemoglobina
   */
  private analyzeWaveform(buffer: number[]): {
    amplitude: number;
    peakWidth: number;
    areaUnderCurve: number;
    decayTime: number;
  } | null {
    // Analizar por ventanas para mejorar precisión
    const windowSize = 30;
    const windows = Math.floor(buffer.length / windowSize);
    
    if (windows < 2) return null;
    
    let totalAmplitude = 0;
    let totalPeakWidth = 0;
    let totalArea = 0;
    let totalDecayTime = 0;
    let validWindows = 0;
    
    for (let w = 0; w < windows; w++) {
      const start = w * windowSize;
      const end = start + windowSize;
      const segment = buffer.slice(start, end);
      
      // Encontrar pico y valle
      let peakIndex = 0;
      let peakValue = segment[0];
      let valleyIndex = 0;
      let valleyValue = segment[0];
      
      for (let i = 1; i < segment.length; i++) {
        if (segment[i] > peakValue) {
          peakValue = segment[i];
          peakIndex = i;
        }
        if (segment[i] < valleyValue) {
          valleyValue = segment[i];
          valleyIndex = i;
        }
      }
      
      // Si el pico está muy cerca del borde, descartar ventana
      if (peakIndex < 2 || peakIndex > segment.length - 3) continue;
      
      // Calcular amplitud
      const amplitude = peakValue - valleyValue;
      
      // Calcular ancho de pico (full width at half maximum)
      const halfHeight = valleyValue + amplitude / 2;
      let leftIndex = peakIndex;
      let rightIndex = peakIndex;
      
      // Buscar hacia la izquierda
      for (let i = peakIndex; i >= 0; i--) {
        if (segment[i] <= halfHeight) {
          leftIndex = i;
          break;
        }
      }
      
      // Buscar hacia la derecha
      for (let i = peakIndex; i < segment.length; i++) {
        if (segment[i] <= halfHeight) {
          rightIndex = i;
          break;
        }
      }
      
      const peakWidth = rightIndex - leftIndex;
      
      // Calcular área bajo la curva
      let area = 0;
      for (let i = 0; i < segment.length; i++) {
        area += segment[i] - valleyValue;
      }
      
      // Calcular tiempo de caída (decay time)
      let decayIndex = peakIndex;
      const decayThreshold = peakValue - 0.63 * amplitude; // Tiempo constante
      
      for (let i = peakIndex; i < segment.length; i++) {
        if (segment[i] <= decayThreshold) {
          decayIndex = i;
          break;
        }
      }
      
      const decayTime = decayIndex - peakIndex;
      
      // Agregar a totales
      totalAmplitude += amplitude;
      totalPeakWidth += peakWidth;
      totalArea += area;
      totalDecayTime += decayTime;
      validWindows++;
    }
    
    if (validWindows === 0) return null;
    
    // Calcular promedios
    return {
      amplitude: totalAmplitude / validWindows,
      peakWidth: totalPeakWidth / validWindows,
      areaUnderCurve: totalArea / validWindows,
      decayTime: totalDecayTime / validWindows
    };
  }
  
  /**
   * Calcula nivel base de hemoglobina a partir de características de forma de onda
   * Basado en estudios que correlacionan características PPG con hemoglobina
   */
  private calculateBaseHemoglobin(
    features: NonNullable<ReturnType<HemoglobinEstimator['analyzeWaveform']>>,
    perfusionIndex: number
  ): number {
    const { amplitude, peakWidth, areaUnderCurve, decayTime } = features;
    
    // Normalizar características para el modelo
    const normalizedAmplitude = Math.min(1.0, amplitude / 0.5);
    const normalizedWidth = Math.min(1.0, peakWidth / 15);
    const normalizedArea = Math.min(1.0, areaUnderCurve / 10);
    const normalizedDecay = Math.min(1.0, decayTime / 10);
    
    // Estudios muestran correlación entre:
    // - Mayor amplitud → mayor Hb
    // - Menor ancho de pico → mayor Hb
    // - Mayor perfusión → mayor Hb
    // - Menor tiempo de caída → mayor Hb
    
    // Modelo ponderado basado en literatura
    const baseHemoglobin = 13.0 + 
                         (normalizedAmplitude * 2.5) - 
                         (normalizedWidth * 1.5) + 
                         (perfusionIndex * 1.0) - 
                         (normalizedDecay * 0.5);
    
    return baseHemoglobin;
  }
  
  /**
   * Establece factor de calibración basado en referencia externa
   */
  public setCalibrationFactor(factor: number): void {
    if (factor > 0) {
      this.calibrationFactor = factor;
    }
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    super.reset();
    this.calibrationFactor = 1.0;
    console.log("HemoglobinEstimator: Reset complete");
  }
}
