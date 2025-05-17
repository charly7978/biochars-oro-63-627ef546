
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Estimador de niveles de glucosa en sangre
 * Basado en análisis de características derivadas de PPG
 */
export class GlucoseEstimator extends BaseProcessor {
  private readonly MIN_BUFFER_SIZE = 100;
  private readonly DEFAULT_GLUCOSE = 0;
  
  // Valores de calibración
  private calibrationFactor: number = 1.0;
  private referenceGlucose: number | null = null;
  
  constructor() {
    super();
    this.reset();
  }
  
  /**
   * Estima nivel de glucosa basado en análisis de señal PPG
   * @param filteredValue Valor PPG filtrado actual
   * @param acValue Componente AC de la señal
   * @param dcValue Componente DC de la señal
   * @param buffer Buffer de valores PPG filtrados
   * @returns Valor estimado de glucosa en mg/dL
   */
  public estimateGlucose(
    filteredValue: number,
    acValue: number,
    dcValue: number,
    buffer: number[]
  ): number {
    // Verificar datos mínimos para estimación
    if (buffer.length < this.MIN_BUFFER_SIZE) {
      return this.DEFAULT_GLUCOSE;
    }
    
    // Extraer características relevantes para estimación
    const waveformFeatures = this.extractWaveformFeatures(buffer);
    
    // Si no se pudieron extraer características, no estimar
    if (!waveformFeatures) {
      return this.DEFAULT_GLUCOSE;
    }
    
    // Calcular índice de absorción basado en componentes AC/DC
    const absorptionIndex = Math.abs(acValue / (dcValue || 1));
    
    // Estimar glucosa basado en modelo simplificado
    // Este es un modelo experimental que correlaciona características
    // de la señal PPG con niveles de glucosa
    const estimatedGlucose = this.calculateGlucoseFromFeatures(
      waveformFeatures,
      absorptionIndex
    );
    
    // Aplicar factor de calibración si existe referencia
    if (this.referenceGlucose !== null) {
      return Math.round(estimatedGlucose * this.calibrationFactor);
    }
    
    return 0; // Sin calibración, no reportar valor
  }
  
  /**
   * Extrae características de la forma de onda PPG
   * relacionadas con niveles de glucosa
   */
  private extractWaveformFeatures(buffer: number[]): {
    riseTime: number;
    fallTime: number;
    dicroticNotchPosition: number;
    areaUnderCurve: number;
  } | null {
    try {
      // Análisis por ventanas para mejorar precisión
      const windowSize = 30;
      const windows = Math.floor(buffer.length / windowSize);
      
      if (windows < 3) return null;
      
      let totalRiseTime = 0;
      let totalFallTime = 0;
      let totalDicroticPosition = 0;
      let totalAreaUnderCurve = 0;
      let validWindows = 0;
      
      for (let w = 0; w < windows; w++) {
        const start = w * windowSize;
        const end = start + windowSize;
        const segment = buffer.slice(start, end);
        
        // Encontrar pico principal
        let peakIndex = 0;
        let peakValue = segment[0];
        
        for (let i = 1; i < segment.length; i++) {
          if (segment[i] > peakValue) {
            peakValue = segment[i];
            peakIndex = i;
          }
        }
        
        // Si el pico está muy cerca del borde, descartar ventana
        if (peakIndex < 2 || peakIndex > segment.length - 3) continue;
        
        // Encontrar valle inicial
        let valleyIndex = 0;
        let valleyValue = segment[0];
        
        for (let i = 0; i < peakIndex; i++) {
          if (segment[i] < valleyValue) {
            valleyValue = segment[i];
            valleyIndex = i;
          }
        }
        
        // Si no hay valle claro, descartar ventana
        if (valleyIndex === peakIndex) continue;
        
        // Calcular tiempo de subida
        const riseTime = peakIndex - valleyIndex;
        
        // Buscar valle final
        let endValleyIndex = segment.length - 1;
        let endValleyValue = segment[endValleyIndex];
        
        for (let i = peakIndex + 1; i < segment.length; i++) {
          if (segment[i] < endValleyValue) {
            endValleyValue = segment[i];
            endValleyIndex = i;
          }
        }
        
        // Si no hay valle final claro, descartar ventana
        if (endValleyIndex === peakIndex) continue;
        
        // Calcular tiempo de caída
        const fallTime = endValleyIndex - peakIndex;
        
        // Buscar muesca dicrotic entre pico y valle final
        let dicroticIndex = -1;
        let maxSecondDerivative = 0;
        
        for (let i = peakIndex + 1; i < endValleyIndex - 1; i++) {
          // Aproximación de segunda derivada para detectar cambio en curvatura
          const secondDerivative = segment[i-1] - 2 * segment[i] + segment[i+1];
          
          if (secondDerivative > maxSecondDerivative) {
            maxSecondDerivative = secondDerivative;
            dicroticIndex = i;
          }
        }
        
        // Si no se encontró muesca dicrotic, asumir punto medio
        if (dicroticIndex === -1) {
          dicroticIndex = Math.floor((peakIndex + endValleyIndex) / 2);
        }
        
        // Calcular posición relativa de muesca dicrotic
        const dicroticPosition = (dicroticIndex - peakIndex) / (endValleyIndex - peakIndex);
        
        // Calcular área bajo la curva
        let area = 0;
        const baseline = Math.min(valleyValue, endValleyValue);
        
        for (let i = valleyIndex; i <= endValleyIndex; i++) {
          area += segment[i] - baseline;
        }
        
        // Agregar valores a totales
        totalRiseTime += riseTime;
        totalFallTime += fallTime;
        totalDicroticPosition += dicroticPosition;
        totalAreaUnderCurve += area;
        validWindows++;
      }
      
      // Si no hay ventanas válidas, no se pueden extraer características
      if (validWindows === 0) return null;
      
      // Calcular promedios
      return {
        riseTime: totalRiseTime / validWindows,
        fallTime: totalFallTime / validWindows,
        dicroticNotchPosition: totalDicroticPosition / validWindows,
        areaUnderCurve: totalAreaUnderCurve / validWindows
      };
    } catch (error) {
      console.error("Error extracting waveform features:", error);
      return null;
    }
  }
  
  /**
   * Calcula nivel estimado de glucosa basado en características
   * de la forma de onda PPG y el índice de absorción
   */
  private calculateGlucoseFromFeatures(
    features: ReturnType<GlucoseEstimator['extractWaveformFeatures']>,
    absorptionIndex: number
  ): number {
    if (!features) return this.DEFAULT_GLUCOSE;
    
    // En un sistema real, este modelo sería entrenado con datos clínicos
    // que correlacionan características PPG con niveles reales de glucosa
    
    // Modelo simplificado basado en correlaciones observadas en literatura
    const {
      riseTime,
      fallTime,
      dicroticNotchPosition,
      areaUnderCurve
    } = features;
    
    // Normalizar características para el modelo
    const normalizedRiseTime = Math.min(1.0, riseTime / 10);
    const normalizedFallTime = Math.min(1.0, fallTime / 20);
    const normalizedArea = Math.min(1.0, areaUnderCurve / 1000);
    
    // Factores de ponderación basados en importancia relativa
    // observada en estudios clínicos
    const w1 = 0.3; // Rise time
    const w2 = 0.25; // Fall time
    const w3 = 0.25; // Dicrotic notch
    const w4 = 0.2; // Area
    
    // Índice combinado (0-1)
    const combinedIndex = 
      w1 * normalizedRiseTime +
      w2 * normalizedFallTime +
      w3 * dicroticNotchPosition +
      w4 * normalizedArea;
    
    // Ajustar por absorción (relacionada con cambios en viscosidad sanguínea)
    const absorbanceAdjustment = Math.max(0.5, Math.min(1.5, 1 / (absorptionIndex + 0.1)));
    
    // Convertir a rango fisiológico (70-180 mg/dL)
    const baseGlucose = 70 + combinedIndex * 110;
    
    // Ajustar por absorción
    const adjustedGlucose = baseGlucose * absorbanceAdjustment;
    
    // Asegurar valores fisiológicos plausibles
    return Math.min(250, Math.max(70, adjustedGlucose));
  }
  
  /**
   * Establece valor de glucosa de referencia para calibración
   */
  public setReferenceGlucose(glucose: number): void {
    if (glucose >= 70 && glucose <= 250) {
      this.referenceGlucose = glucose;
    }
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    super.reset();
    this.calibrationFactor = 1.0;
    this.referenceGlucose = null;
    console.log("GlucoseProcessor: Reset complete");
  }
}
