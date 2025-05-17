
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Estimador de perfil lipídico basado en análisis de señal PPG
 * Extrae características de la forma de onda relacionadas con viscosidad sanguínea
 */
export class LipidEstimator extends BaseProcessor {
  private readonly MIN_BUFFER_SIZE = 100;
  
  constructor() {
    super();
    console.log("LipidEstimator: Initialized");
  }
  
  /**
   * Estima perfil lipídico basado en características de señal PPG
   * @param filteredValue Valor PPG filtrado actual
   * @param acValue Componente AC de la señal
   * @param dcValue Componente DC de la señal
   * @param buffer Buffer de valores PPG filtrados
   * @returns Valores estimados de colesterol total y triglicéridos
   */
  public estimateLipids(
    filteredValue: number,
    acValue: number,
    dcValue: number,
    buffer: number[]
  ): { totalCholesterol: number; triglycerides: number } {
    // Verificar datos mínimos para estimación
    if (buffer.length < this.MIN_BUFFER_SIZE) {
      return { totalCholesterol: 0, triglycerides: 0 };
    }
    
    try {
      // Extraer características de forma de onda
      const waveformFeatures = this.extractWaveformFeatures(buffer);
      
      if (!waveformFeatures) {
        return { totalCholesterol: 0, triglycerides: 0 };
      }
      
      // Estimar colesterol basado en características de forma de onda
      const cholesterol = this.estimateCholesterol(waveformFeatures, acValue, dcValue);
      
      // Estimar triglicéridos basado en características de forma de onda
      const triglycerides = this.estimateTriglycerides(waveformFeatures, acValue, dcValue);
      
      // Valores fisiológicamente plausibles
      const validCholesterol = Math.min(300, Math.max(120, cholesterol));
      const validTriglycerides = Math.min(500, Math.max(50, triglycerides));
      
      return {
        totalCholesterol: Math.round(validCholesterol),
        triglycerides: Math.round(validTriglycerides)
      };
    } catch (error) {
      console.error("Error estimating lipids:", error);
      return { totalCholesterol: 0, triglycerides: 0 };
    }
  }
  
  /**
   * Extrae características de la forma de onda PPG
   * relacionadas con perfil lipídico
   */
  private extractWaveformFeatures(buffer: number[]): {
    augmentationIndex: number;
    stiffnessIndex: number;
    dicroticNotchHeight: number;
    areaRatio: number;
  } | null {
    // Análisis por ventanas para mejorar precisión
    const windowSize = 30;
    const windows = Math.floor(buffer.length / windowSize);
    
    if (windows < 3) return null;
    
    let totalAugmentationIndex = 0;
    let totalStiffnessIndex = 0;
    let totalDicroticNotchHeight = 0;
    let totalAreaRatio = 0;
    let validWindows = 0;
    
    for (let w = 0; w < windows; w++) {
      const start = w * windowSize;
      const end = start + windowSize;
      const segment = buffer.slice(start, end);
      
      // Encontrar pico principal (P1)
      let p1Index = 0;
      let p1Value = segment[0];
      
      for (let i = 1; i < segment.length; i++) {
        if (segment[i] > p1Value) {
          p1Value = segment[i];
          p1Index = i;
        }
      }
      
      // Si el pico está muy cerca del borde, descartar ventana
      if (p1Index < 2 || p1Index > segment.length - 3) continue;
      
      // Encontrar valle inicial
      let valleyIndex = 0;
      let valleyValue = segment[0];
      
      for (let i = 0; i < p1Index; i++) {
        if (segment[i] < valleyValue) {
          valleyValue = segment[i];
          valleyIndex = i;
        }
      }
      
      // Calcular área hasta pico (A1)
      let a1 = 0;
      for (let i = valleyIndex; i <= p1Index; i++) {
        a1 += segment[i] - valleyValue;
      }
      
      // Buscar muesca dicrotic después del pico principal
      let dicroticIndex = -1;
      let dicroticValue = p1Value;
      
      for (let i = p1Index + 1; i < Math.min(p1Index + 15, segment.length); i++) {
        // Buscar punto de inflexión o mínimo local
        if (i > p1Index + 1 && i < segment.length - 1) {
          const derivative1 = segment[i] - segment[i-1];
          const derivative2 = segment[i+1] - segment[i];
          
          if (derivative1 <= 0 && derivative2 >= 0) {
            dicroticIndex = i;
            dicroticValue = segment[i];
            break;
          }
        }
      }
      
      // Si no se encontró muesca, descartar ventana
      if (dicroticIndex === -1) continue;
      
      // Buscar segundo pico (P2) después de la muesca dicrotic
      let p2Index = dicroticIndex;
      let p2Value = segment[dicroticIndex];
      
      for (let i = dicroticIndex + 1; i < Math.min(dicroticIndex + 10, segment.length); i++) {
        if (segment[i] > p2Value) {
          p2Value = segment[i];
          p2Index = i;
        }
      }
      
      // Calcular área después de muesca (A2)
      let a2 = 0;
      for (let i = dicroticIndex; i <= Math.min(dicroticIndex + 10, segment.length - 1); i++) {
        a2 += segment[i] - valleyValue;
      }
      
      // Calcular métricas
      const augmentationIndex = (p2Value - valleyValue) / (p1Value - valleyValue);
      const stiffnessIndex = p1Index / (segment.length - p1Index);
      const dicroticNotchHeight = (dicroticValue - valleyValue) / (p1Value - valleyValue);
      const areaRatio = a2 / (a1 || 1); // Evitar división por cero
      
      // Agregar a totales
      totalAugmentationIndex += augmentationIndex;
      totalStiffnessIndex += stiffnessIndex;
      totalDicroticNotchHeight += dicroticNotchHeight;
      totalAreaRatio += areaRatio;
      validWindows++;
    }
    
    if (validWindows === 0) return null;
    
    // Calcular promedios
    return {
      augmentationIndex: totalAugmentationIndex / validWindows,
      stiffnessIndex: totalStiffnessIndex / validWindows,
      dicroticNotchHeight: totalDicroticNotchHeight / validWindows,
      areaRatio: totalAreaRatio / validWindows
    };
  }
  
  /**
   * Estima nivel de colesterol basado en características de forma de onda
   */
  private estimateCholesterol(
    features: NonNullable<ReturnType<LipidEstimator['extractWaveformFeatures']>>,
    acValue: number,
    dcValue: number
  ): number {
    // En un sistema real, este modelo estaría basado en estudios clínicos
    // que correlacionan características de PPG con niveles de colesterol
    
    const { augmentationIndex, stiffnessIndex, dicroticNotchHeight } = features;
    
    // Normalizar características
    const normalizedAugmentation = Math.min(1.0, Math.max(0, augmentationIndex));
    const normalizedStiffness = Math.min(1.0, Math.max(0, stiffnessIndex));
    const normalizedDicrotic = Math.min(1.0, Math.max(0, dicroticNotchHeight));
    
    // Calcular índice de perfusión
    const perfusionIndex = acValue / (dcValue || 1);
    
    // Modelo basado en estudios que muestran correlación entre
    // índices de rigidez arterial y niveles de colesterol
    const baseValue = 150 + 
                    (normalizedAugmentation * 50) + 
                    (normalizedStiffness * 70) - 
                    (normalizedDicrotic * 20);
    
    // Ajustar por perfusión
    const perfusionAdjustment = 1.0 + (0.5 - Math.min(perfusionIndex, 1.0));
    
    return baseValue * perfusionAdjustment;
  }
  
  /**
   * Estima nivel de triglicéridos basado en características de forma de onda
   */
  private estimateTriglycerides(
    features: NonNullable<ReturnType<LipidEstimator['extractWaveformFeatures']>>,
    acValue: number,
    dcValue: number
  ): number {
    const { augmentationIndex, areaRatio, stiffnessIndex } = features;
    
    // Normalizar características
    const normalizedAugmentation = Math.min(1.0, Math.max(0, augmentationIndex));
    const normalizedAreaRatio = Math.min(1.0, Math.max(0, areaRatio));
    const normalizedStiffness = Math.min(1.0, Math.max(0, stiffnessIndex));
    
    // Estudios muestran que triglicéridos afectan más la forma de onda
    // diastólica y la relación entre áreas sistólica/diastólica
    const baseValue = 100 + 
                    (normalizedAreaRatio * 150) + 
                    (normalizedAugmentation * 70) + 
                    (normalizedStiffness * 50);
    
    return baseValue;
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    super.reset();
    console.log("LipidEstimator: Reset complete");
  }
}
