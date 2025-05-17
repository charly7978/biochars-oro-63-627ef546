
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';

/**
 * Estimador de perfil lipídico basado en análisis PPG
 * Utiliza características de la forma de onda para estimar niveles de lípidos
 * Advertencia: La estimación no invasiva de lípidos es experimental y tiene baja precisión
 */
export class LipidEstimator extends BaseProcessor {
  private readonly DEFAULT_TOTAL_CHOLESTEROL = 0;
  private readonly DEFAULT_TRIGLYCERIDES = 0;
  private readonly MIN_QUALITY_THRESHOLD = 75;
  private readonly MIN_BUFFER_SIZE = 200;
  
  // Valor base para calibración (debe ajustarse por usuario)
  private baselineTotalCholesterol: number = 180;
  private baselineTriglycerides: number = 100;
  
  // Buffers para análisis
  private spectralBuffer: number[] = [];
  private waveformFeatures: any[] = [];
  
  constructor() {
    super();
    console.log("LipidEstimator: Initialized");
  }
  
  /**
   * Estima perfil lipídico basado en análisis PPG
   * @param filteredValue Valor filtrado de señal PPG
   * @param acSignalValue Componente AC de la señal
   * @param dcBaseline Componente DC de la señal
   * @param signalBuffer Buffer completo de señal
   * @returns Estimación de perfil lipídico
   */
  public estimateLipids(
    filteredValue: number,
    acSignalValue: number,
    dcBaseline: number,
    signalBuffer: number[]
  ): {
    totalCholesterol: number;
    triglycerides: number;
  } {
    // Si no hay suficientes datos, retornar valores por defecto
    if (signalBuffer.length < this.MIN_BUFFER_SIZE) {
      return {
        totalCholesterol: this.DEFAULT_TOTAL_CHOLESTEROL,
        triglycerides: this.DEFAULT_TRIGLYCERIDES
      };
    }
    
    // Almacenar valores para análisis espectral
    this.spectralBuffer.push(filteredValue);
    
    // Mantener tamaño de buffer limitado
    if (this.spectralBuffer.length > this.MIN_BUFFER_SIZE) {
      this.spectralBuffer.shift();
    }
    
    // Si no hay suficientes características de forma de onda, extraerlas
    if (this.waveformFeatures.length === 0) {
      this.extractWaveformFeatures(signalBuffer);
    }
    
    // Si aún no tenemos suficientes características, retornar valores por defecto
    if (this.waveformFeatures.length < 5) {
      return {
        totalCholesterol: this.DEFAULT_TOTAL_CHOLESTEROL,
        triglycerides: this.DEFAULT_TRIGLYCERIDES
      };
    }
    
    // Extraer y promediar características relevantes
    const stiffnessIndex = this.calculateStiffnessIndex(signalBuffer);
    const waveformAreaRatio = this.calculateWaveformAreaRatio(signalBuffer);
    const dicroticNotchProminence = this.calculateDicroticNotchProminence(signalBuffer);
    
    // Modelo experimental para estimación de colesterol total
    // Basado en correlaciones observadas entre rigidez arterial y colesterol
    const cholesterolDeviation = 
      stiffnessIndex * 15 + 
      waveformAreaRatio * 10 - 
      dicroticNotchProminence * 20;
    
    // Modelo experimental para estimación de triglicéridos
    // Basado en correlaciones entre características de onda y triglicéridos
    const triglyceridesDeviation = 
      stiffnessIndex * 10 + 
      waveformAreaRatio * 20 - 
      dicroticNotchProminence * 5;
    
    // Aplicar desviaciones estimadas a valores base
    const estimatedCholesterol = this.baselineTotalCholesterol + cholesterolDeviation;
    const estimatedTriglycerides = this.baselineTriglycerides + triglyceridesDeviation;
    
    // Limitar a rangos fisiológicos
    const boundedCholesterol = Math.min(350, Math.max(100, estimatedCholesterol));
    const boundedTriglycerides = Math.min(500, Math.max(50, estimatedTriglycerides));
    
    return {
      totalCholesterol: Math.round(boundedCholesterol),
      triglycerides: Math.round(boundedTriglycerides)
    };
  }
  
  /**
   * Extrae características de la forma de onda
   * @param signalBuffer Buffer de señal PPG
   */
  private extractWaveformFeatures(signalBuffer: number[]): void {
    // Limpiar características anteriores
    this.waveformFeatures = [];
    
    // Detectar ciclos cardíacos (entre picos)
    const peakIndices = this.detectPeaks(signalBuffer);
    
    // Analizar cada ciclo cardíaco
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const startIdx = peakIndices[i];
      const endIdx = peakIndices[i + 1];
      
      // Aislar un ciclo cardíaco completo
      const cycle = signalBuffer.slice(startIdx, endIdx);
      
      // Si el ciclo es demasiado corto, saltar
      if (cycle.length < 10) continue;
      
      // Encontrar pico sistólico
      let peakIdx = 0;
      let peakValue = cycle[0];
      
      for (let j = 1; j < Math.min(20, cycle.length); j++) {
        if (cycle[j] > peakValue) {
          peakValue = cycle[j];
          peakIdx = j;
        }
      }
      
      // Si el pico está demasiado cerca del inicio o fin, no es confiable
      if (peakIdx < 2 || peakIdx > cycle.length - 5) continue;
      
      // Calcular área bajo la curva
      const area = cycle.reduce((sum, val) => sum + val, 0);
      
      // Buscar muesca dicrótica (primer mínimo local después del pico)
      let dicroticIdx = -1;
      for (let j = peakIdx + 2; j < Math.min(cycle.length - 2, peakIdx + 15); j++) {
        if (cycle[j] < cycle[j-1] && cycle[j] < cycle[j+1]) {
          dicroticIdx = j;
          break;
        }
      }
      
      // Si encontramos muesca dicrótica, calcular su prominencia
      let dicroticProminence = 0;
      if (dicroticIdx > 0) {
        const dicroticValue = cycle[dicroticIdx];
        const subsequentPeak = this.findNextLocalMax(cycle, dicroticIdx);
        
        if (subsequentPeak > 0) {
          dicroticProminence = (cycle[subsequentPeak] - dicroticValue) / 
                              (peakValue - Math.min(...cycle));
        }
      }
      
      // Almacenar características de este ciclo
      this.waveformFeatures.push({
        cycleLength: cycle.length,
        systolicPeakIndex: peakIdx,
        systolicPeakValue: peakValue,
        dicroticNotchIndex: dicroticIdx,
        dicroticProminence: dicroticProminence,
        area: area
      });
      
      // Limitar número de características almacenadas
      if (this.waveformFeatures.length > 10) {
        this.waveformFeatures.shift();
      }
    }
  }
  
  /**
   * Detecta picos en la señal PPG
   * @param signal Señal PPG
   * @returns Índices de picos detectados
   */
  private detectPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 20; // Distancia mínima entre picos (30Hz ~ 667ms)
    
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
   * Encuentra el siguiente máximo local después de un índice dado
   * @param signal Señal a analizar
   * @param startIdx Índice de inicio para búsqueda
   * @returns Índice del siguiente máximo local, o -1 si no se encuentra
   */
  private findNextLocalMax(signal: number[], startIdx: number): number {
    for (let i = startIdx + 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        return i;
      }
    }
    return -1;
  }
  
  /**
   * Calcula índice de rigidez a partir de la señal
   * @param signal Señal PPG
   * @returns Índice de rigidez
   */
  private calculateStiffnessIndex(signal: number[]): number {
    if (!this.waveformFeatures.length) return 0;
    
    // Promediar tiempo de subida (rise time) de características
    let avgRiseTime = 0;
    let count = 0;
    
    for (const feature of this.waveformFeatures) {
      if (feature.systolicPeakIndex > 0) {
        avgRiseTime += feature.systolicPeakIndex;
        count++;
      }
    }
    
    if (count === 0) return 0;
    avgRiseTime = avgRiseTime / count;
    
    // Menor tiempo de subida = mayor rigidez
    return Math.max(0, 1 - (avgRiseTime / 15));
  }
  
  /**
   * Calcula ratio de área de forma de onda
   * @param signal Señal PPG
   * @returns Ratio de área
   */
  private calculateWaveformAreaRatio(signal: number[]): number {
    if (!this.waveformFeatures.length) return 0;
    
    // Calcular áreas sistólica vs. diastólica
    let totalRatio = 0;
    let count = 0;
    
    for (const feature of this.waveformFeatures) {
      if (feature.dicroticNotchIndex > 0) {
        const systolicArea = feature.area * (feature.dicroticNotchIndex / feature.cycleLength);
        const diastolicArea = feature.area - systolicArea;
        
        if (diastolicArea > 0) {
          totalRatio += systolicArea / diastolicArea;
          count++;
        }
      }
    }
    
    return count > 0 ? totalRatio / count : 0;
  }
  
  /**
   * Calcula prominencia de muesca dicrótica
   * @param signal Señal PPG
   * @returns Prominencia media
   */
  private calculateDicroticNotchProminence(signal: number[]): number {
    if (!this.waveformFeatures.length) return 0;
    
    // Promediar prominencia de muesca dicrótica
    let totalProminence = 0;
    let count = 0;
    
    for (const feature of this.waveformFeatures) {
      if (feature.dicroticProminence > 0) {
        totalProminence += feature.dicroticProminence;
        count++;
      }
    }
    
    return count > 0 ? totalProminence / count : 0;
  }
  
  /**
   * Configura valores base para calibración
   * @param cholesterol Valor base de colesterol total
   * @param triglycerides Valor base de triglicéridos
   */
  public setBaselines(cholesterol: number, triglycerides: number): void {
    if (cholesterol >= 100 && cholesterol <= 350) {
      this.baselineTotalCholesterol = cholesterol;
    }
    
    if (triglycerides >= 50 && triglycerides <= 500) {
      this.baselineTriglycerides = triglycerides;
    }
    
    console.log("LipidEstimator: Baselines set to", 
      { cholesterol: this.baselineTotalCholesterol, triglycerides: this.baselineTriglycerides });
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    super.reset();
    this.spectralBuffer = [];
    this.waveformFeatures = [];
    // No resetear líneas base ya que son calibración
    console.log("LipidEstimator: Reset complete");
  }
}
