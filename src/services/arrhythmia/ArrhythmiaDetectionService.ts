
/**
 * Implementación del servicio de detección de arritmias
 * Este servicio analiza los intervalos RR y la forma de onda PPG para detectar arritmias cardíacas
 * 
 * IMPORTANTE: Este servicio SOLO utiliza datos reales y análisis deterministas.
 * NO utiliza funciones aleatorias como Math.random().
 */

import { realMax, realAbs, categorizeArrhythmia } from './utils';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';
import { ArrhythmiaDetectionResult, UserProfile, ArrhythmiaListener, ArrhythmiaStatus } from './types';
import { ARRHYTHMIA_CONFIG } from './constants';
import { getModel } from '../../core/neural/ModelRegistry';
import { ArrhythmiaNeuralModel } from '../../core/neural/ArrhythmiaModel';

/**
 * Servicio de detección de arritmias cardíacas basado en análisis PPG y variabilidad RR
 */
export class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private windowManager: ArrhythmiaWindowManager;
  private listeners: ArrhythmiaListener[] = [];
  private lastStatus: ArrhythmiaStatus = 'normal';
  private userProfile: UserProfile | null = null;
  
  // Contador de ciclos analizados
  private cyclesAnalyzed: number = 0;
  
  constructor() {
    this.windowManager = new ArrhythmiaWindowManager(ARRHYTHMIA_CONFIG.windowSize);
    console.log('ArrhythmiaDetectionService: Inicializado');
  }
  
  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }
  
  /**
   * Procesa un nuevo intervalo RR (en ms) y actualiza el estado de detección
   * @param rrInterval Intervalo RR en milisegundos
   * @param signalQuality Calidad de la señal (0-100)
   * @returns Resultado del análisis de arritmia
   */
  public processRRInterval(rrInterval: number, signalQuality: number = 100): ArrhythmiaDetectionResult {
    if (rrInterval <= 0 || signalQuality < ARRHYTHMIA_CONFIG.minQualityThreshold) {
      return this.createResult('unknown', 0, 0);
    }
    
    // Añadir intervalo a la ventana deslizante
    this.windowManager.addInterval(rrInterval);
    
    // Incrementar contador de ciclos
    this.cyclesAnalyzed++;
    
    // Análisis básico cada ciclo
    const basicResult = this.performBasicAnalysis();
    
    // Análisis avanzado cada N ciclos o si se detecta anomalía básica
    if (this.cyclesAnalyzed % ARRHYTHMIA_CONFIG.advancedAnalysisFrequency === 0 || 
        basicResult.status !== 'normal') {
      return this.performAdvancedAnalysis(signalQuality);
    }
    
    return basicResult;
  }
  
  /**
   * Procesa un segmento de señal PPG para análisis de morfología
   * @param ppgSegment Segmento de PPG (valores normalizados)
   * @param signalQuality Calidad de la señal (0-100)
   * @returns Resultado del análisis de arritmia con indicadores morfológicos
   */
  public async processPPGSegment(ppgSegment: number[], signalQuality: number = 100): Promise<ArrhythmiaDetectionResult> {
    if (!ppgSegment || ppgSegment.length < ARRHYTHMIA_CONFIG.minSegmentLength || 
        signalQuality < ARRHYTHMIA_CONFIG.minQualityThreshold) {
      return this.createResult('unknown', 0, 0);
    }
    
    try {
      // Extraer características de forma de onda
      const waveformFeatures = this.extractWaveformFeatures(ppgSegment);
      
      // Calcular métricas adicionales de la forma de onda
      const asymmetry = waveformFeatures.riseTime / waveformFeatures.fallTime;
      const peakWidth = waveformFeatures.systolicWidth;
      
      // Usar modelo neuronal si está disponible
      let neuralAnalysisResult = { isArrhythmia: false, confidence: 0, category: 'normal' };
      
      try {
        const model = getModel<ArrhythmiaNeuralModel>('arrhythmia');
        if (model && model.getModelInfo().isLoaded) {
          const rrIntervals = this.windowManager.getAllIntervals();
          neuralAnalysisResult = await model.processSignal(ppgSegment, rrIntervals);
        }
      } catch (error) {
        console.warn('Error en análisis neural de arritmias:', error);
      }
      
      // Integrar resultados manuales con neurales
      const manualProbability = this.calculateManualProbability(waveformFeatures);
      
      // Ponderar resultados (70% manual / 30% neural si disponible)
      const neuralWeight = neuralAnalysisResult.confidence > 0.7 ? 0.3 : 0.1;
      const manualWeight = 1 - neuralWeight;
      
      const finalProbability = (manualProbability * manualWeight) + 
                              (neuralAnalysisResult.isArrhythmia ? neuralAnalysisResult.confidence * neuralWeight : 0);
                              
      // Determinar estado final
      let status = 'normal';
      if (finalProbability > ARRHYTHMIA_CONFIG.highProbabilityThreshold) {
        status = neuralAnalysisResult.category || 'arrhythmia';
      } else if (finalProbability > ARRHYTHMIA_CONFIG.lowProbabilityThreshold) {
        status = 'possible-arrhythmia';
      }
      
      // Crear resultado
      const result = this.createResult(
        status as ArrhythmiaStatus,
        finalProbability,
        signalQuality,
        {
          asymmetry,
          peakWidth,
          ...waveformFeatures
        }
      );
      
      // Notificar cambios significativos
      if (this.lastStatus !== result.status) {
        this.notifyListeners(result);
        this.lastStatus = result.status;
      }
      
      return result;
      
    } catch (error) {
      console.error('Error en procesamiento PPG para arritmias:', error);
      return this.createResult('unknown', 0, 0);
    }
  }
  
  /**
   * Realiza análisis básico de arritmias basado en variabilidad RR
   */
  private performBasicAnalysis(): ArrhythmiaDetectionResult {
    const intervals = this.windowManager.getAllIntervals();
    
    if (intervals.length < ARRHYTHMIA_CONFIG.minIntervalsForAnalysis) {
      return this.createResult('unknown', 0, 0);
    }
    
    // Calcular métricas básicas de variabilidad
    const meanRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    let sumSquaredDiff = 0;
    for (let i = 0; i < intervals.length; i++) {
      sumSquaredDiff += Math.pow(intervals[i] - meanRR, 2);
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / intervals.length);
    const variability = rmssd / meanRR;
    
    // Contar irregularidades
    let irregularIntervals = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = realAbs(intervals[i] - intervals[i-1]);
      if (diff > meanRR * ARRHYTHMIA_CONFIG.irregularityThreshold) {
        irregularIntervals++;
      }
    }
    
    const irregularityRate = irregularIntervals / (intervals.length - 1);
    
    // Determinar estado de arritmia básico
    let status: ArrhythmiaStatus = 'normal';
    let probability = irregularityRate;
    
    if (irregularityRate > ARRHYTHMIA_CONFIG.highIrregularityThreshold) {
      // Categorizar basado en patrón
      status = categorizeArrhythmia(intervals);
    } else if (irregularityRate > ARRHYTHMIA_CONFIG.lowIrregularityThreshold) {
      status = 'possible-arrhythmia';
    }
    
    // Si hay muchos latidos irregulares, aumentar probabilidad
    if (irregularIntervals > 3) {
      probability = realMax(probability, 0.6);
    }
    
    return this.createResult(status, probability, 0);
  }
  
  /**
   * Realiza análisis avanzado de arritmias (más computacionalmente intensivo)
   */
  private performAdvancedAnalysis(signalQuality: number): ArrhythmiaDetectionResult {
    const intervals = this.windowManager.getAllIntervals();
    
    if (intervals.length < ARRHYTHMIA_CONFIG.minIntervalsForAdvancedAnalysis) {
      return this.createResult('unknown', 0, signalQuality);
    }
    
    // Calcular métricas avanzadas
    // Variabilidad a corto plazo (RMSSD)
    let rmssd = 0;
    for (let i = 1; i < intervals.length; i++) {
      rmssd += Math.pow(intervals[i] - intervals[i-1], 2);
    }
    rmssd = Math.sqrt(rmssd / (intervals.length - 1));
    
    // Proporción de intervalos que difieren por más de 50ms (pNN50)
    let nn50 = 0;
    for (let i = 1; i < intervals.length; i++) {
      if (realAbs(intervals[i] - intervals[i-1]) > 50) {
        nn50++;
      }
    }
    const pNN50 = nn50 / (intervals.length - 1);
    
    // Detectar patrones específicos de arritmias
    const status = this.detectArrhythmiaPatterns(intervals);
    
    // Calcular probabilidad basada en métricas
    const maxNormalRMSSD = 50; // Para un adulto sano en reposo 
    const normalizedRMSSD = realMin(1, rmssd / maxNormalRMSSD);
    
    const probability = (normalizedRMSSD * 0.5) + (pNN50 * 0.5);
    
    return this.createResult(status, probability, signalQuality, {
      rmssd,
      pNN50
    });
  }
  
  /**
   * Extrae características de la forma de onda PPG
   */
  private extractWaveformFeatures(ppgSegment: number[]): {
    riseTime: number;
    fallTime: number;
    amplitude: number;
    systolicWidth: number;
    diastolicRatio: number;
  } {
    // Encontrar picos y valles
    const peaks = this.findPeaks(ppgSegment);
    const valleys = this.findValleys(ppgSegment);
    
    // Si no hay suficientes características, devolver valores por defecto
    if (peaks.length < 2 || valleys.length < 1) {
      return {
        riseTime: 0,
        fallTime: 0, 
        amplitude: 0,
        systolicWidth: 0,
        diastolicRatio: 0
      };
    }
    
    // Calcular estadísticas de los picos
    let totalRiseTime = 0;
    let totalFallTime = 0;
    let totalAmplitude = 0;
    let totalSystolicWidth = 0;
    let totalDiastolicRatio = 0;
    
    const numPeaks = realMin(peaks.length - 1, 5); // Limitar a 5 picos
    
    for (let i = 0; i < numPeaks; i++) {
      // Encontrar valle anterior al pico
      let previousValley = -1;
      for (let j = 0; j < valleys.length; j++) {
        if (valleys[j] < peaks[i]) {
          previousValley = valleys[j];
        }
      }
      
      // Encontrar valle posterior al pico
      let nextValley = -1;
      for (let j = 0; j < valleys.length; j++) {
        if (valleys[j] > peaks[i]) {
          nextValley = valleys[j];
          break;
        }
      }
      
      if (previousValley >= 0 && nextValley >= 0) {
        // Tiempo de subida (del valle al pico)
        const rise = peaks[i] - previousValley;
        totalRiseTime += rise;
        
        // Tiempo de caída (del pico al siguiente valle)
        const fall = nextValley - peaks[i];
        totalFallTime += fall;
        
        // Amplitud (diferencia de valor entre pico y valle)
        const amplitude = ppgSegment[peaks[i]] - ppgSegment[previousValley];
        totalAmplitude += amplitude;
        
        // Ancho sistólico (distancia entre puntos medios de subida y bajada)
        const halfAmp = amplitude / 2;
        const systolicWidth = this.findWidthAtHeight(ppgSegment, peaks[i], halfAmp + ppgSegment[previousValley]);
        totalSystolicWidth += systolicWidth;
        
        // Ratio diastólico (amplitud de onda dicrotica vs amplitud total)
        const diastolicRatio = this.measureDiastolicRatio(ppgSegment, peaks[i], nextValley);
        totalDiastolicRatio += diastolicRatio;
      }
    }
    
    // Promediar
    return {
      riseTime: totalRiseTime / numPeaks,
      fallTime: totalFallTime / numPeaks,
      amplitude: totalAmplitude / numPeaks,
      systolicWidth: totalSystolicWidth / numPeaks,
      diastolicRatio: totalDiastolicRatio / numPeaks
    };
  }
  
  /**
   * Encuentra picos en la señal PPG
   */
  private findPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        // Verificar que no sea ruido (amplitud mínima)
        const leftHeight = signal[i] - signal[i-1];
        const rightHeight = signal[i] - signal[i+1];
        
        if (leftHeight > 0.05 && rightHeight > 0.05) {
          peaks.push(i);
        }
      }
    }
    
    return peaks;
  }
  
  /**
   * Encuentra valles en la señal PPG
   */
  private findValleys(signal: number[]): number[] {
    const valleys: number[] = [];
    
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
        // Verificar que no sea ruido (amplitud mínima)
        const leftDepth = signal[i-1] - signal[i];
        const rightDepth = signal[i+1] - signal[i];
        
        if (leftDepth > 0.05 && rightDepth > 0.05) {
          valleys.push(i);
        }
      }
    }
    
    return valleys;
  }
  
  /**
   * Encuentra el ancho de la onda a una altura específica
   */
  private findWidthAtHeight(signal: number[], peakIndex: number, height: number): number {
    // Buscar hacia la izquierda
    let leftIndex = peakIndex;
    while (leftIndex > 0 && signal[leftIndex] > height) {
      leftIndex--;
    }
    
    // Buscar hacia la derecha
    let rightIndex = peakIndex;
    while (rightIndex < signal.length - 1 && signal[rightIndex] > height) {
      rightIndex++;
    }
    
    return rightIndex - leftIndex;
  }
  
  /**
   * Mide el ratio de la componente diastólica (onda dicrótica)
   */
  private measureDiastolicRatio(signal: number[], peakIndex: number, nextValleyIndex: number): number {
    if (nextValleyIndex <= peakIndex || nextValleyIndex - peakIndex < 3) {
      return 0;
    }
    
    // Buscar onda dicrótica (pequeño pico después del pico principal)
    let maxDicroticHeight = 0;
    for (let i = peakIndex + 1; i < nextValleyIndex; i++) {
      if (i > 0 && i < signal.length - 1) {
        // Pico local
        if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
          const dicroticHeight = signal[i] - signal[nextValleyIndex];
          if (dicroticHeight > maxDicroticHeight) {
            maxDicroticHeight = dicroticHeight;
          }
        }
      }
    }
    
    // Calcular ratio respecto a amplitud total
    const totalAmplitude = signal[peakIndex] - signal[nextValleyIndex];
    return totalAmplitude > 0 ? maxDicroticHeight / totalAmplitude : 0;
  }
  
  /**
   * Calcula probabilidad manual de arritmia basada en características de onda
   */
  private calculateManualProbability(features: {
    riseTime: number;
    fallTime: number;
    amplitude: number;
    systolicWidth: number;
    diastolicRatio: number;
  }): number {
    if (features.amplitude === 0) return 0;
    
    // Valores típicos para PPG normal
    const normalRiseTime = 15;  // Muestras
    const normalFallTime = 25;  // Muestras
    const normalRatio = 0.33;   // Ratio de tiempos
    const normalDiastolicRatio = 0.15; // Ratio de amplitud de onda dicrótica
    
    // Calcular desviaciones de lo normal
    const riseTimeDev = realAbs(features.riseTime - normalRiseTime) / normalRiseTime;
    const fallTimeDev = realAbs(features.fallTime - normalFallTime) / normalFallTime;
    const ratioDev = realAbs((features.riseTime / features.fallTime) - normalRatio) / normalRatio;
    const diastolicDev = realAbs(features.diastolicRatio - normalDiastolicRatio) / (normalDiastolicRatio + 0.01);
    
    // Ponderación de características
    const probability = 
      riseTimeDev * 0.2 + 
      fallTimeDev * 0.2 + 
      ratioDev * 0.3 + 
      diastolicDev * 0.3;
    
    // Normalizar a [0,1]
    return realMin(1.0, probability);
  }
  
  /**
   * Detecta patrones específicos de arritmias
   */
  private detectArrhythmiaPatterns(intervals: number[]): ArrhythmiaStatus {
    if (intervals.length < 4) return 'unknown';
    
    // Calcular estadísticas
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Verificar taquicardia
    if (mean < 600) { // < 100 BPM
      return 'tachycardia';
    }
    
    // Verificar bradicardia
    if (mean > 1000) { // < 60 BPM
      return 'bradycardia';
    }
    
    // Verificar fibrilación auricular (alta irregularidad sin patrón)
    let irregularCount = 0;
    for (let i = 1; i < intervals.length; i++) {
      if (realAbs(intervals[i] - intervals[i-1]) > mean * 0.2) {
        irregularCount++;
      }
    }
    
    if (irregularCount > intervals.length * 0.5) {
      return 'possible-afib';
    }
    
    // Verificar patrón bigeminy (alternancia regular corto-largo)
    let bigeminyCount = 0;
    for (let i = 2; i < intervals.length; i += 2) {
      const diff1 = intervals[i-1] - intervals[i-2];
      const diff2 = intervals[i] - intervals[i-1];
      
      if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
        bigeminyCount++;
      }
    }
    
    if (bigeminyCount > (intervals.length / 2) * 0.7) {
      return 'bigeminy';
    }
    
    // Patrón normal
    return 'normal';
  }
  
  /**
   * Crea objeto de resultado
   */
  private createResult(
    status: ArrhythmiaStatus, 
    probability: number, 
    signalQuality: number,
    details?: Record<string, any>
  ): ArrhythmiaDetectionResult {
    return {
      timestamp: Date.now(),
      status,
      probability,
      signalQuality,
      details: details || {},
      latestIntervals: this.windowManager.getAllIntervals()
    };
  }
  
  /**
   * Registra un listener para notificaciones de arritmias
   */
  public addListener(listener: ArrhythmiaListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * Elimina un listener
   */
  public removeListener(listener: ArrhythmiaListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  /**
   * Notifica a los listeners sobre cambios en estado de arritmia
   */
  private notifyListeners(result: ArrhythmiaDetectionResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (error) {
        console.error('Error en listener de arritmias:', error);
      }
    }
  }
  
  /**
   * Establece un perfil de usuario para personalización de la detección
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
  }
  
  /**
   * Reinicia el servicio y limpia datos acumulados
   */
  public reset(): void {
    this.windowManager.clear();
    this.cyclesAnalyzed = 0;
    this.lastStatus = 'normal';
    console.log('ArrhythmiaDetectionService: Reiniciado');
  }

  // Función para determinar el valor mínimo
  private realMin(a: number, b: number): number {
    return a < b ? a : b;
  }
}

// Singleton export
export default ArrhythmiaDetectionService.getInstance();
