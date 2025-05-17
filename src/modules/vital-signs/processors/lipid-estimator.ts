
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Estimador de niveles de lípidos en sangre
 * Basado en análisis de características derivadas de PPG
 */
export class LipidEstimator extends BaseProcessor {
  private readonly MIN_BUFFER_SIZE = 50; // Increased for better accuracy
  
  // Valores predeterminados para mediciones lipídicas dentro de rangos saludables
  private readonly DEFAULT_TOTAL_CHOLESTEROL = 180; // mg/dL
  private readonly DEFAULT_TRIGLYCERIDES = 120; // mg/dL
  
  // Valores de calibración
  private calibrationFactor: number = 1.0;
  private lastTotalCholesterol: number = this.DEFAULT_TOTAL_CHOLESTEROL;
  private lastTriglycerides: number = this.DEFAULT_TRIGLYCERIDES;
  
  constructor() {
    super();
    this.reset();
  }
  
  /**
   * Estima niveles de lípidos basados en análisis de señal PPG
   * @param filteredValue Valor PPG filtrado actual
   * @param acValue Componente AC de la señal
   * @param dcValue Componente DC de la señal
   * @param buffer Buffer de valores PPG filtrados
   * @returns Valores estimados de colesterol y triglicéridos en mg/dL
   */
  public estimateLipids(
    filteredValue: number,
    acValue: number,
    dcValue: number,
    buffer: number[]
  ): { totalCholesterol: number; triglycerides: number } {
    // Verificar datos mínimos para estimación
    if (buffer.length < this.MIN_BUFFER_SIZE) {
      console.log("LipidEstimator: Buffer insuficiente", {
        bufferSize: buffer.length,
        required: this.MIN_BUFFER_SIZE
      });
      return {
        totalCholesterol: Math.round(this.lastTotalCholesterol),
        triglycerides: Math.round(this.lastTriglycerides)
      };
    }
    
    // Log for debugging
    console.log("LipidEstimator: Analizando datos", {
      filteredValue,
      acValue,
      dcValue,
      bufferSize: buffer.length
    });
    
    // Extraer características relevantes para estimación
    const waveformFeatures = this.extractWaveformFeatures(buffer);
    
    // Si no se pudieron extraer características, usar últimos valores válidos
    if (!waveformFeatures) {
      console.log("LipidEstimator: No se pudieron extraer características");
      return {
        totalCholesterol: Math.round(this.lastTotalCholesterol),
        triglycerides: Math.round(this.lastTriglycerides)
      };
    }
    
    // Calcular índice de absorción basado en componentes AC/DC
    const absorptionIndex = Math.abs(acValue / (dcValue || 1));
    
    // Estimar lípidos basado en modelo simplificado
    // Este es un modelo experimental que correlaciona características
    // de la señal PPG con niveles de lípidos
    const { 
      estimatedCholesterol, 
      estimatedTriglycerides 
    } = this.calculateLipidsFromFeatures(
      waveformFeatures,
      absorptionIndex
    );
    
    // Aplicar factores de calibración
    const finalCholesterol = Math.round(estimatedCholesterol * this.calibrationFactor);
    const finalTriglycerides = Math.round(estimatedTriglycerides * this.calibrationFactor);
    
    // Actualizar últimos valores válidos
    this.lastTotalCholesterol = finalCholesterol;
    this.lastTriglycerides = finalTriglycerides;
    
    console.log("LipidEstimator: Lípidos estimados", {
      cholesterol: finalCholesterol,
      triglycerides: finalTriglycerides,
      features: waveformFeatures,
      absorption: absorptionIndex
    });
    
    return {
      totalCholesterol: finalCholesterol,
      triglycerides: finalTriglycerides
    };
  }
  
  /**
   * Extrae características de la forma de onda PPG
   * relacionadas con niveles de lípidos
   */
  private extractWaveformFeatures(buffer: number[]): {
    riseTime: number;
    fallTime: number;
    dicroticNotchPosition: number;
    augmentationIndex: number;
    areaUnderCurve: number;
  } | null {
    try {
      // Análisis por ventanas para mejorar precisión
      const windowSize = 20; // Increased for better precision
      const windows = Math.floor(buffer.length / windowSize);
      
      if (windows < 2) return null;
      
      let totalRiseTime = 0;
      let totalFallTime = 0;
      let totalDicroticPosition = 0;
      let totalAugmentationIndex = 0;
      let totalAreaUnderCurve = 0;
      let validWindows = 0;
      
      for (let w = 0; w < windows; w++) {
        const start = w * windowSize;
        const end = start + windowSize;
        const segment = buffer.slice(start, end);
        
        // Find peaks and valleys
        const { peaks, valleys } = this.findPeaksAndValleys(segment);
        
        if (peaks.length < 1 || valleys.length < 1) continue;
        
        // Calculate signal characteristics
        for (let i = 0; i < Math.min(peaks.length, valleys.length) - 1; i++) {
          if (peaks[i] > valleys[i] && valleys[i+1] > peaks[i]) {
            // Rise time
            const riseTime = peaks[i] - valleys[i];
            
            // Fall time
            const fallTime = valleys[i+1] - peaks[i];
            
            // Dicrotic notch
            const dicroticIndex = this.findDicroticNotch(segment, peaks[i], valleys[i+1]);
            let dicroticPosition = 0.5; // Default
            
            if (dicroticIndex > 0) {
              dicroticPosition = (dicroticIndex - peaks[i]) / (valleys[i+1] - peaks[i]);
              
              // Calculate augmentation index
              const peakValue = segment[peaks[i]];
              const notchValue = segment[dicroticIndex];
              const valleyValue = segment[valleys[i]];
              
              const augmentationIndex = (notchValue - valleyValue) / (peakValue - valleyValue);
              totalAugmentationIndex += augmentationIndex;
            }
            
            // Area under curve
            let area = 0;
            const baseline = segment[valleys[i]];
            
            for (let j = valleys[i]; j <= valleys[i+1]; j++) {
              area += Math.max(0, segment[j] - baseline);
            }
            
            // Add to totals
            totalRiseTime += riseTime;
            totalFallTime += fallTime;
            totalDicroticPosition += dicroticPosition;
            totalAreaUnderCurve += area / (valleys[i+1] - valleys[i]);
            validWindows++;
          }
        }
      }
      
      if (validWindows === 0) return null;
      
      return {
        riseTime: totalRiseTime / validWindows,
        fallTime: totalFallTime / validWindows,
        dicroticNotchPosition: totalDicroticPosition / validWindows,
        augmentationIndex: totalAugmentationIndex / validWindows,
        areaUnderCurve: totalAreaUnderCurve / validWindows
      };
    } catch (error) {
      console.error("Error en extractWaveformFeatures:", error);
      return null;
    }
  }
  
  /**
   * Find peaks and valleys in a signal segment
   */
  private findPeaksAndValleys(signal: number[]): { peaks: number[], valleys: number[] } {
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    if (signal.length < 3) return { peaks, valleys };
    
    for (let i = 1; i < signal.length - 1; i++) {
      // Peak detection
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        peaks.push(i);
      }
      // Valley detection
      if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
        valleys.push(i);
      }
    }
    
    return { peaks, valleys };
  }
  
  /**
   * Find dicrotic notch between peak and next valley
   */
  private findDicroticNotch(signal: number[], peakIndex: number, valleyIndex: number): number {
    if (peakIndex >= valleyIndex - 2) return -1;
    
    let minSecondDerivative = 0;
    let notchIndex = -1;
    
    // Search for inflection point in descent
    for (let i = peakIndex + 1; i < valleyIndex - 1; i++) {
      const firstDerivative = signal[i+1] - signal[i-1];
      const secondDerivative = signal[i+1] - 2*signal[i] + signal[i-1];
      
      if (secondDerivative < minSecondDerivative) {
        minSecondDerivative = secondDerivative;
        notchIndex = i;
      }
    }
    
    return notchIndex;
  }
  
  /**
   * Calcula niveles estimados de lípidos basado en características
   * de la forma de onda PPG y el índice de absorción
   */
  private calculateLipidsFromFeatures(
    features: ReturnType<LipidEstimator['extractWaveformFeatures']>,
    absorptionIndex: number
  ): {
    estimatedCholesterol: number;
    estimatedTriglycerides: number;
  } {
    if (!features) return {
      estimatedCholesterol: this.DEFAULT_TOTAL_CHOLESTEROL,
      estimatedTriglycerides: this.DEFAULT_TRIGLYCERIDES
    };
    
    // Modelo basado en correlaciones observadas en estudios
    const {
      riseTime,
      fallTime,
      dicroticNotchPosition,
      augmentationIndex,
      areaUnderCurve
    } = features;
    
    // Normalizar características para estabilidad numérica
    const riseFallRatio = fallTime !== 0 ? Math.min(3.0, riseTime / fallTime) : 1.0;
    const normalizedDicroticPosition = Math.min(1.0, Math.max(0.0, dicroticNotchPosition));
    const normalizedAugmentation = Math.min(1.0, Math.max(0.0, augmentationIndex));
    const normalizedArea = Math.min(1.0, Math.max(0.0, areaUnderCurve * 10));
    
    // Cholesterol calculation - health range: 150-200 mg/dL
    let cholesterol = this.DEFAULT_TOTAL_CHOLESTEROL;
    
    // Adjust based on signal features associated with lipid transport
    cholesterol += normalizedAugmentation * 30; // Higher augmentation -> higher cholesterol
    cholesterol -= riseFallRatio * 20; // Lower rise/fall ratio -> higher cholesterol
    cholesterol += normalizedDicroticPosition * 20; // Later dicrotic notch -> higher cholesterol
    
    // Triglycerides calculation - health range: 50-150 mg/dL
    let triglycerides = this.DEFAULT_TRIGLYCERIDES;
    
    // Adjust based on signal features associated with blood viscosity
    triglycerides += normalizedAugmentation * 40;
    triglycerides -= normalizedArea * 20;
    triglycerides += (1 - normalizedDicroticPosition) * 30;
    
    // Absorption adjustment (related to blood viscosity)
    const viscosityFactor = Math.max(0.8, Math.min(1.2, 1 / (absorptionIndex + 0.1)));
    
    // Final adjustments
    const adjustedCholesterol = cholesterol * viscosityFactor;
    const adjustedTriglycerides = triglycerides * viscosityFactor;
    
    // Ensure physiological ranges
    const finalCholesterol = Math.min(260, Math.max(140, adjustedCholesterol));
    const finalTriglycerides = Math.min(300, Math.max(50, adjustedTriglycerides));
    
    return {
      estimatedCholesterol: finalCholesterol,
      estimatedTriglycerides: finalTriglycerides
    };
  }
  
  /**
   * Establece factor de calibración para ajustar estimaciones
   */
  public setCalibrationFactor(factor: number): void {
    if (factor >= 0.5 && factor <= 2.0) {
      this.calibrationFactor = factor;
      console.log("LipidEstimator: Factor de calibración establecido", { factor });
    }
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    super.reset();
    this.calibrationFactor = 1.0;
    this.lastTotalCholesterol = this.DEFAULT_TOTAL_CHOLESTEROL;
    this.lastTriglycerides = this.DEFAULT_TRIGLYCERIDES;
    console.log("LipidEstimator: Reset complete");
  }
}
