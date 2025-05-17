
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Estimador de nivel de hemoglobina basado en análisis PPG
 * Utiliza características de absorbancia de la señal PPG
 * Advertencia: La estimación no invasiva de hemoglobina es experimental y tiene baja precisión
 */
export class HemoglobinEstimator extends BaseProcessor {
  private readonly DEFAULT_HEMOGLOBIN = 0;
  private readonly MIN_QUALITY_THRESHOLD = 80;
  private readonly MIN_BUFFER_SIZE = 150;
  
  // Coeficientes para modelo simplificado
  private readonly COEFS = {
    dcComponent: 2.5,
    acAmplitude: 1.8,
    pulseWidth: 0.5
  };
  
  // Valor base para calibración (debe ajustarse por usuario)
  private baselineHemoglobin: number = 14.0;
  
  // Buffer para análisis
  private spectralBuffer: number[] = [];
  private pulseFeatures: any[] = [];
  
  constructor() {
    super();
    console.log("HemoglobinEstimator: Initialized");
  }
  
  /**
   * Estima nivel de hemoglobina basado en análisis PPG
   * @param filteredValue Valor filtrado de señal PPG
   * @param acSignalValue Componente AC de la señal
   * @param dcBaseline Componente DC de la señal
   * @param signalBuffer Buffer completo de señal
   * @returns Estimación de nivel de hemoglobina (g/dL)
   */
  public estimateHemoglobin(
    filteredValue: number,
    acSignalValue: number,
    dcBaseline: number,
    signalBuffer: number[]
  ): number {
    // Si no hay suficientes datos, retornar valor por defecto
    if (signalBuffer.length < this.MIN_BUFFER_SIZE) {
      return this.DEFAULT_HEMOGLOBIN;
    }
    
    // Almacenar valores para análisis
    this.spectralBuffer.push(filteredValue);
    
    // Mantener tamaño de buffer limitado
    if (this.spectralBuffer.length > this.MIN_BUFFER_SIZE) {
      this.spectralBuffer.shift();
    }
    
    // Actualizar características de pulso si hay suficientes datos
    if (signalBuffer.length >= 100 && this.pulseFeatures.length < 5) {
      this.updatePulseFeatures(signalBuffer);
    }
    
    // Si no hay suficientes características de pulso, retornar valor por defecto
    if (this.pulseFeatures.length < 3) {
      return this.DEFAULT_HEMOGLOBIN;
    }
    
    // Extraer y promediar características relevantes
    const dcModulation = Math.abs(dcBaseline) / 100;
    const acAmplitude = this.calculateAverageAmplitude();
    const pulseWidth = this.calculateAveragePulseWidth();
    
    // Modelo basado en coeficientes empíricos
    // La absorbancia está relacionada con la concentración (Ley de Beer-Lambert)
    const hemoglobinDeviation = 
      this.COEFS.dcComponent * Math.log10(dcModulation + 1) - 
      this.COEFS.acAmplitude * acAmplitude + 
      this.COEFS.pulseWidth * pulseWidth;
    
    // Aplicar desviación al valor base
    const estimatedHemoglobin = this.baselineHemoglobin + hemoglobinDeviation;
    
    // Limitar a rango fisiológico
    const boundedHemoglobin = Math.min(20.0, Math.max(7.0, estimatedHemoglobin));
    
    return parseFloat(boundedHemoglobin.toFixed(1));
  }
  
  /**
   * Actualiza características de pulso a partir de la señal
   * @param signal Señal PPG
   */
  private updatePulseFeatures(signal: number[]): void {
    // Detectar picos en la señal
    const peakIndices = this.detectPeaks(signal);
    
    // Analizar cada pulso (entre dos picos)
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const startIdx = peakIndices[i];
      const endIdx = peakIndices[i + 1];
      
      // Extraer un pulso
      const pulse = signal.slice(startIdx, endIdx);
      
      // Si el pulso es demasiado corto o largo, saltar
      if (pulse.length < 10 || pulse.length > 60) continue;
      
      // Calcular amplitud de pulso
      const baseline = Math.min(...pulse);
      const peak = Math.max(...pulse);
      const amplitude = peak - baseline;
      
      // Calcular ancho de pulso (en muestras)
      const halfAmplitude = baseline + amplitude / 2;
      let width = 0;
      
      // Contar muestras por encima del 50% de amplitud
      for (const value of pulse) {
        if (value >= halfAmplitude) {
          width++;
        }
      }
      
      // Almacenar características
      this.pulseFeatures.push({
        amplitude: amplitude,
        width: width,
        length: pulse.length
      });
      
      // Limitar número de características almacenadas
      if (this.pulseFeatures.length > 10) {
        this.pulseFeatures.shift();
      }
    }
  }
  
  /**
   * Calcula amplitud promedio de pulsos
   */
  private calculateAverageAmplitude(): number {
    if (this.pulseFeatures.length === 0) return 0;
    
    const sum = this.pulseFeatures.reduce((acc, feature) => acc + feature.amplitude, 0);
    return sum / this.pulseFeatures.length;
  }
  
  /**
   * Calcula ancho promedio de pulsos
   */
  private calculateAveragePulseWidth(): number {
    if (this.pulseFeatures.length === 0) return 0;
    
    // Normalizar ancho respecto a longitud de pulso
    const normalizedWidths = this.pulseFeatures.map(
      feature => feature.width / feature.length
    );
    
    const sum = normalizedWidths.reduce((acc, width) => acc + width, 0);
    return sum / normalizedWidths.length;
  }
  
  /**
   * Detecta picos en señal PPG
   * @param signal Señal PPG
   * @returns Índices de picos detectados
   */
  private detectPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 15; // Distancia mínima entre picos (30Hz ~ 500ms)
    
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
   * Configura valor base para hemoglobina
   * @param value Valor base en g/dL
   */
  public setBaselineHemoglobin(value: number): void {
    if (value >= 7.0 && value <= 20.0) {
      this.baselineHemoglobin = value;
      console.log("HemoglobinEstimator: Baseline set to", value);
    }
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    super.reset();
    this.spectralBuffer = [];
    this.pulseFeatures = [];
    // No resetear línea base ya que es calibración
    console.log("HemoglobinEstimator: Reset complete");
  }
}
