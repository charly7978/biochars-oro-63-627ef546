/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// import { SignalValidator } from '../modules/vital-signs/validators/signal-validator'; // ELIMINADO
import { KalmanFilter } from '../core/signal/filters/KalmanFilter';
import { BandpassFilter } from '../core/signal/filters/BandpassFilter';
import { toast } from 'sonner';
// import type { Mat } from '@techstark/opencv-js'; // ELIMINADO OPENCV

export interface FingerDetectionConfig {
  minSignalAmplitude: number; // Minimum amplitude of raw or filtered PPG signal to be considered
  minQualityThreshold: number; // Quality threshold of PPG signal (0-100) to consider finger present
  // maxWeakSignalsCount: number; // Ya no se usa directamente aquí, se integra en la lógica de calidad/confianza
  
  // Parámetros para la detección de patrones rítmicos (adaptados de useSignalQualityDetector)
  rhythmPatternWindowMs: number; // Ventana en ms para la detección de patrones.
  minPeaksForRhythm: number; // Mínimo de picos para considerar un ritmo.
  peakDetectionThreshold: number; // Umbral para la detección de picos en la señal normalizada.
  requiredConsistentPatterns: number; // Número de patrones consistentes para confirmar el dedo.
  minSignalVariance: number; // Varianza mínima de la señal para evitar ruido constante.
  minPeakIntervalMs: number; // Intervalo mínimo entre picos (e.g., para max BPM)
  maxPeakIntervalMs: number; // Intervalo máximo entre picos (e.g., para min BPM)
  maxIntervalDeviationMs: number; // Máxima desviación permitida entre intervalos de picos para consistencia.
  // openCvMinSkinConfidence: number; // ELIMINADO OPENCV
  // openCvMinContourArea: number; // ELIMINADO OPENCV
  // openCvSkinLowerHsv: [number, number, number]; // ELIMINADO OPENCV
  // openCvSkinUpperHsv: [number, number, number]; // ELIMINADO OPENCV
  showToastFeedback: boolean; // NUEVO: Para controlar toasts de sonner
  // openCvMorphKernelSize: number; // ELIMINADO OPENCV
  // openCvSolidityThreshold: number; // ELIMINADO OPENCV
  // openCvAspectRatioMin: number; // ELIMINADO OPENCV
  // openCvAspectRatioMax: number; // ELIMINADO OPENCV
}

export interface FingerDetectionResult {
  isFingerDetected: boolean;
  quality: number; // Calidad general de la señal PPG (0-100)
  confidence: number; // Confianza general de detección de dedo (0-1)
  rhythmDetected: boolean; // Si se detectó un patrón rítmico cardiaco
  rhythmConfidence: number; // Confianza específica del patrón rítmico (0-1)
  signalStrength: number; // Fuerza de la señal PPG actual
  feedback?: string; // Mensajes para el usuario
  // roi?: { x: number; y: number; width: number; height: number }; // ELIMINADO OPENCV
  // skinConfidence?: number; // ELIMINADO OPENCV
  lastUpdate: number;
  rawValue?: number; // NUEVO: Valor PPG crudo extraído (de CV o de entrada directa)
}

// Renombrar la clase y actualizar su lógica
class FingerDetectionManager {
  private static instance: FingerDetectionManager;
  // private validator: SignalValidator; // Eliminado
  private kalmanFilter: KalmanFilter;
  private bandpassFilter: BandpassFilter;
  
  private signalHistory: Array<{ time: number, value: number }> = []; // Adaptado de useSignalQualityDetector
  private readonly PPG_HISTORY_SIZE_MS = 5000; // Mantener 5 segundos de historial PPG para análisis diversos

  private detectedRhythmicPatternsCount: number = 0;
  private fingerConfirmedByRhythm: boolean = false;
  private lastPeakTimes: number[] = []; // Tiempos de los últimos picos detectados

  private lastProcessedPpgValue: number = 0;
  
  private config: FingerDetectionConfig = {
    minSignalAmplitude: 0.05,
    minQualityThreshold: 30,
    rhythmPatternWindowMs: 3000,
    minPeaksForRhythm: 4,
    peakDetectionThreshold: 0.3,
    requiredConsistentPatterns: 2,
    minSignalVariance: 0.001,
    minPeakIntervalMs: 250, // Corresponde a 240 BPM max
    maxPeakIntervalMs: 1500, // Corresponde a 40 BPM min
    maxIntervalDeviationMs: 150,
    // openCvMinSkinConfidence: 0.4, // ELIMINADO OPENCV
    // openCvMinContourArea: 500, // ELIMINADO OPENCV
    // openCvSkinLowerHsv: [0, 40, 30], // ELIMINADO OPENCV
    // openCvSkinUpperHsv: [40, 255, 255], // ELIMINADO OPENCV
    showToastFeedback: false, // Por defecto no mostrar toasts, puede ser ruidoso
    // openCvMorphKernelSize: 3, // ELIMINADO OPENCV
    // openCvSolidityThreshold: 0.75, // ELIMINADO OPENCV
    // openCvAspectRatioMin: 0.2, // ELIMINADO OPENCV
    // openCvAspectRatioMax: 1.5, // ELIMINADO OPENCV
  };

  private constructor() {
    // this.validator = new SignalValidator(); // Eliminado
    this.kalmanFilter = new KalmanFilter(); // Constructor sin argumentos
    this.kalmanFilter.setParameters(0.1, 0.01); // Q (processNoise), R (measurementNoise) - valores invertidos respecto al intento anterior y ajustados
    this.bandpassFilter = new BandpassFilter(0.5, 4, 30); // Asumiendo SAMPLING_RATE ~30Hz
    console.log("FingerDetectionManager: Initialized");
  }

  public static getInstance(): FingerDetectionManager {
    if (!FingerDetectionManager.instance) {
      FingerDetectionManager.instance = new FingerDetectionManager();
    }
    return FingerDetectionManager.instance;
  }

  public updateConfig(newConfig: Partial<FingerDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("FingerDetectionManager: Config updated", this.config);
  }

  // Método principal que podría recibir datos de imagen y PPG
  public processFrameAndSignal(
    imageData?: ImageData, // Se mantiene por si se usa para algo más, pero no para OpenCV
    ppgValue?: number,
    cvReady?: boolean // Se mantiene por si se usa para algo más, pero no para OpenCV
  ): FingerDetectionResult {
    const currentTime = Date.now();
    let ppgFilteredValue = this.lastProcessedPpgValue; // Valor por defecto
    let ppgAmplitude = 0;
    // let roiDetected: FingerDetectionResult['roi'] | undefined = undefined; // ELIMINADO OPENCV
    // let skinConfidence: number | undefined = undefined; // ELIMINADO OPENCV
    let rhythmResult = { isPatternConsistent: false, confidence: 0, peaksFound: [] };
    let finalRhythmConfirmed = false;
    let effectivePpgValue = ppgValue; // Valor PPG que se usará para análisis de señal

    // const DEBUG_OPENCV_OUTPUT = false; // ELIMINADO OPENCV ya que no se usa

    // --- Lógica de OpenCV --- 
    // let cvAnalysisResults: { roi?: FingerDetectionResult['roi'], skinConfidence?: number, extractedPpgValue?: number} = {}; // ELIMINADO OPENCV
    // if (imageData && cvReady && (cv as any).Mat) { // ELIMINADO OPENCV
      // cvAnalysisResults = this.analyzeImageWithOpenCVInternal(imageData); // ELIMINADO OPENCV
      // roiDetected = cvAnalysisResults.roi; // ELIMINADO OPENCV
      // skinConfidence = cvAnalysisResults.skinConfidence; // ELIMINADO OPENCV
      // effectivePpgValue = cvAnalysisResults.extractedPpgValue ?? ppgValue; // ELIMINADO OPENCV
    // } else { // ELIMINADO OPENCV
      effectivePpgValue = ppgValue; // Si no hay OpenCV, el valor efectivo es el de entrada
    // } // ELIMINADO OPENCV

    if (typeof effectivePpgValue === 'number') {
      ppgFilteredValue = this.bandpassFilter.filter(this.kalmanFilter.filter(effectivePpgValue));
      this.signalHistory.push({ time: currentTime, value: ppgFilteredValue });
      while (this.signalHistory.length > 0 && currentTime - this.signalHistory[0].time > this.PPG_HISTORY_SIZE_MS) {
        this.signalHistory.shift();
      }
      this.lastProcessedPpgValue = ppgFilteredValue; // Guardar el último valor filtrado procesado
      const signalWindow = this.signalHistory.map(p => p.value);
      if (signalWindow.length > 1) {
        ppgAmplitude = Math.max(...signalWindow) - Math.min(...signalWindow);
      }
    } else {
      // Si effectivePpgValue no es un número, no podemos procesar la señal PPG
      // Usar el último valor conocido para ppgFilteredValue y ppgAmplitude o valores por defecto
      ppgAmplitude = 0; // o alguna lógica para decaimiento
    }

    // --- Análisis de Señal PPG (Ritmo y Calidad) ---
    // Solo realizar si tenemos un valor PPG efectivo
    if (typeof effectivePpgValue === 'number') {
        rhythmResult = this.detectRhythmicPatternInternal(); // Usa this.signalHistory
        finalRhythmConfirmed = rhythmResult.isPatternConsistent && rhythmResult.confidence > 0.5;
    }
    const ppgQuality = this.calculatePpgSignalQuality(ppgFilteredValue, ppgAmplitude); // Usa el valor filtrado

    // --- Sistema de Confianza Graduada y Detección Final ---
    let overallConfidence = 0;
    let isFingerActuallyDetected = false;

    // SIN OPENCV, LA DETECCIÓN SE BASA COMPLETAMENTE EN SEÑAL PPG Y RITMO
    overallConfidence = this.calculateOverallConfidence(
      finalRhythmConfirmed,
      rhythmResult.confidence,
      ppgQuality,
      // false, // ELIMINADO OPENCV - cvRoiWasActuallyDetected
      // undefined // ELIMINADO OPENCV - skinConfidence
    );
    isFingerActuallyDetected = overallConfidence >= 0.55; // Umbral ajustado sin CV, ligeramente más estricto

    // --- Generar Feedback ---
    const feedback = this.generateUserFeedback(
        isFingerActuallyDetected, 
        ppgQuality, 
        finalRhythmConfirmed,
        // undefined, // ELIMINADO OPENCV - roiDetected
        // undefined, // ELIMINADO OPENCV - skinConfidence
        // false // ELIMINADO OPENCV - cvUsed
    );

    // 5. Generar Resultado
    const result: FingerDetectionResult = {
      isFingerDetected: isFingerActuallyDetected,
      quality: ppgQuality,
      confidence: overallConfidence,
      rhythmDetected: finalRhythmConfirmed,
      rhythmConfidence: rhythmResult.confidence,
      signalStrength: Math.abs(ppgFilteredValue), // Podría ser la amplitud reciente
      feedback,
      // roi: undefined, // ELIMINADO OPENCV
      // skinConfidence: undefined, // ELIMINADO OPENCV
      lastUpdate: currentTime,
      rawValue: effectivePpgValue // ASIGNAR el valor PPG efectivo usado
    };

    if (this.config.showToastFeedback) {
      this.handleUserFeedback(isFingerActuallyDetected, ppgQuality, finalRhythmConfirmed);
    }

    return result;
  }
  
  // Adaptación de detectPeaks de useSignalQualityDetector
  private detectRhythmicPatternInternal(): { isPatternConsistent: boolean; confidence: number; peaksFound: number[] } {
    const currentTime = Date.now();
    const recentSignalData = this.signalHistory.filter(
      point => currentTime - point.time < this.config.rhythmPatternWindowMs
    );

    if (recentSignalData.length < 20) { // Necesita suficientes puntos (ej. ~0.6s a 30fps)
      return { isPatternConsistent: false, confidence: 0, peaksFound: [] };
    }

    const values = recentSignalData.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    if (variance < this.config.minSignalVariance) {
      // console.log("FingerDetectionManager: Signal variance too low", variance);
      return { isPatternConsistent: false, confidence: 0.1, peaksFound: [] }; // Baja confianza si la varianza es baja
    }

    const peaks: { time: number; value: number }[] = [];
    // Detección de picos simple (mejorar si es necesario)
    for (let i = 2; i < recentSignalData.length - 2; i++) {
      const p = recentSignalData[i];
      if (
        p.value > recentSignalData[i - 1].value &&
        p.value > recentSignalData[i - 2].value &&
        p.value >= recentSignalData[i + 1].value && // Usar >= para picos planos
        p.value >= recentSignalData[i + 2].value &&
        Math.abs(p.value) > this.config.peakDetectionThreshold // Umbral de amplitud del pico
      ) {
        peaks.push(p);
      }
    }
    
    this.lastPeakTimes = peaks.map(p => p.time); // Actualizar tiempos de picos

    if (peaks.length < this.config.minPeaksForRhythm) {
      // console.log("FingerDetectionManager: Not enough peaks", peaks.length);
      return { isPatternConsistent: false, confidence: 0.2 + (0.1 * peaks.length / this.config.minPeaksForRhythm), peaksFound: this.lastPeakTimes };
    }

    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i].time - peaks[i - 1].time);
    }

    const validIntervals = intervals.filter(
      interval => interval >= this.config.minPeakIntervalMs && interval <= this.config.maxPeakIntervalMs
    );

    if (validIntervals.length < this.config.minPeaksForRhythm -1) { // Necesita al menos minPeaks-1 intervalos válidos
        // console.log("FingerDetectionManager: Not enough valid intervals", validIntervals.length);
      return { isPatternConsistent: false, confidence: 0.3 + (0.1 * validIntervals.length / (this.config.minPeaksForRhythm -1)), peaksFound: this.lastPeakTimes };
    }

    // Chequeo de consistencia de intervalos
    let consistentIntervalCount = 0;
    if (validIntervals.length >= 1) consistentIntervalCount = 1; // El primer intervalo es "consistente" consigo mismo.

    for (let i = 1; i < validIntervals.length; i++) {
      if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < this.config.maxIntervalDeviationMs) {
        consistentIntervalCount++;
      }
    }
    
    // La confianza del ritmo podría basarse en qué tan consistentes son los intervalos
    const rhythmConfidence = (validIntervals.length > 0) ? (consistentIntervalCount / validIntervals.length) * 0.8 + 0.2 : 0.2;


    if (consistentIntervalCount >= this.config.minPeaksForRhythm - 1) { // -1 porque son N picos, N-1 intervalos
      // console.log("FingerDetectionManager: Consistent rhythm detected");
      return { isPatternConsistent: true, confidence: Math.max(0.5, rhythmConfidence) , peaksFound: this.lastPeakTimes };
    }
    // console.log("FingerDetectionManager: Rhythm not consistent enough", consistentIntervalCount);
    return { isPatternConsistent: false, confidence: rhythmConfidence, peaksFound: this.lastPeakTimes };
  }

  // Placeholder para la lógica de calidad de señal PPG
  private calculatePpgSignalQuality(currentFilteredValue: number, ppgAmplitude: number): number {
    const history = this.signalHistory.map(p => p.value); // Usar el historial de señales filtradas
    if (history.length < 30) return 0; // Necesita suficientes datos

    // --- Sub-métricas de calidad (cada una podría devolver 0-1) ---

    // 1. Amplitud suficiente (basado en config.minSignalAmplitude)
    const range = Math.max(...history) - Math.min(...history);
    const amplitudeScore = Math.min(1, range / (this.config.minSignalAmplitude * 2.5)); // Normalizado

    if (amplitudeScore < 0.2 && range < this.config.minSignalAmplitude * 0.8) return 0; // Si la amplitud es demasiado baja, calidad cero directamente

    // 2. Estabilidad/SNR (combinando varianza y quizás ruido de alta frecuencia)
    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    
    let stabilityScore = 0;
    if (variance < this.config.minSignalVariance * 0.3) stabilityScore = 0.1; // Muy plana
    else if (variance < this.config.minSignalVariance * 0.7) stabilityScore = 0.4; // Algo plana
    else if (variance > this.config.minSignalVariance * 15) stabilityScore = 0.2; // Muy ruidosa
    else stabilityScore = Math.min(1, (this.config.minSignalVariance * 5) / (variance + this.config.minSignalVariance * 2)); // Penaliza varianza alta, recompensa "normal"
    
    // 3. Periodicidad (adaptado de SignalAmplifier - autocorrelación)
    const periodicityScore = this.calculatePpgPeriodicityScore(history);

    // --- Ponderación ---
    let weightedQuality =
        amplitudeScore * 0.45 +
        stabilityScore * 0.25 +
        periodicityScore * 0.3;

    let finalQuality = Math.round(Math.min(1, Math.max(0, weightedQuality)) * 100);

    if (this.fingerConfirmedByRhythm) {
        finalQuality = Math.max(finalQuality, 50);
        finalQuality = Math.min(100, finalQuality + (this.detectedRhythmicPatternsCount / this.config.requiredConsistentPatterns) * 15);
    }
    
    if (range < this.config.minSignalAmplitude * 0.5) {
        finalQuality = Math.min(finalQuality, Math.max(0, finalQuality - 25)); // Reducir pero no anular si otros factores son buenos
    }
    if (range < this.config.minSignalAmplitude * 0.25) {
        finalQuality = Math.min(finalQuality, 15); // Calidad muy baja si casi no hay señal
    }

    return finalQuality;
  }

  // Función auxiliar para periodicidad (inspirada en SignalAmplifier)
  private calculatePpgPeriodicityScore(signalBuffer: number[]): number {
    if (signalBuffer.length < 20) return 0;

    const mean = signalBuffer.reduce((a, b) => a + b, 0) / signalBuffer.length;
    const normalizedBuffer = signalBuffer.map(v => v - mean);

    let maxCorrelation = 0;
    const minLag = 8; 
    const maxLag = 50; 

    for (let lag = minLag; lag <= maxLag; lag++) {
        let correlation = 0;
        let norm1 = 0;
        let norm2 = 0;
        if (normalizedBuffer.length <= lag) continue;

        for (let i = 0; i < normalizedBuffer.length - lag; i++) {
            correlation += normalizedBuffer[i] * normalizedBuffer[i + lag];
            norm1 += normalizedBuffer[i] * normalizedBuffer[i];
            norm2 += normalizedBuffer[i + lag] * normalizedBuffer[i + lag];
        }
        const normalizedCorrelation = (norm1 > 0 && norm2 > 0) ? correlation / Math.sqrt(norm1 * norm2) : 0;
        if (Math.abs(normalizedCorrelation) > maxCorrelation) {
            maxCorrelation = Math.abs(normalizedCorrelation);
        }
    }
    return Math.pow(maxCorrelation, 1.5); 
  }

  // Placeholder para el cálculo de confianza general
  private calculateOverallConfidence(
    rhythmConfirmed: boolean,
    rhythmConfidenceValue: number, // Confianza del detector de ritmo (0-1)
    ppgQualityValue: number, // Calidad PPG (0-100)
    // cvRoiWasActuallyDetected: boolean, // ELIMINADO OPENCV
    // cvCalculatedSkinConfidence?: number // ELIMINADO OPENCV
  ): number {
    let totalWeightedScore = 0;
    let totalWeights = 0;

    // 1. Confianza del Ritmo Cardíaco
    const rhythmWeight = 0.6; // Aumentado el peso al no tener CV
    let rhythmScore = rhythmConfidenceValue;
    if (!rhythmConfirmed) {
        // Si el ritmo no está "confirmado" (pocos patrones consistentes),
        // la confianza del ritmo base se reduce.
        rhythmScore *= 0.6; 
    }
    totalWeightedScore += rhythmScore * rhythmWeight;
    totalWeights += rhythmWeight;

    // 2. Calidad de la Señal PPG
    const ppgQualityWeight = 0.4; // Aumentado el peso al no tener CV
    // Normalizar ppgQualityValue (0-100) a (0-1)
    totalWeightedScore += (ppgQualityValue / 100) * ppgQualityWeight;
    totalWeights += ppgQualityWeight;

    // 3. Confianza de OpenCV (ELIMINADO)
    // const opencvWeight = 0.20;
    // if (cvRoiWasActuallyDetected && cvCalculatedSkinConfidence !== undefined) {
    //   let skinScore = cvCalculatedSkinConfidence;
    //   if (skinScore < this.config.openCvMinSkinConfidence) {
    //     skinScore *= 0.5; 
    //   }
    //   totalWeightedScore += skinScore * opencvWeight;
    //   totalWeights += opencvWeight;
    // } else if (cvRoiWasActuallyDetected) {
    //   totalWeightedScore += 0.25 * opencvWeight; 
    //   totalWeights += opencvWeight;
    // }

    // Ajuste final: si la calidad PPG es muy baja, o el ritmo tiene confianza muy baja,
    // limitar la confianza general para evitar falsos positivos.
    if (ppgQualityValue < 25 && rhythmConfidenceValue < 0.35) {
      totalWeightedScore *= 0.4;
    } else if (ppgQualityValue < 15 || rhythmConfidenceValue < 0.2) {
      totalWeightedScore *= 0.2;
    }
    
    if (totalWeights === 0) return 0;
    
    const finalConfidence = totalWeightedScore / totalWeights;
    
    return Math.min(1, Math.max(0, finalConfidence));
  }

  // Placeholder para la generación de feedback
  private generateUserFeedback(
    isDetected: boolean, 
    ppgQuality: number, 
    rhythmConfirmed: boolean,
    // roiFromCv?: FingerDetectionResult['roi'], // ELIMINADO OPENCV
    // skinConfFromCv?: number, // ELIMINADO OPENCV
    // cvUsed?: boolean // ELIMINADO OPENCV
  ): string {
    if (isDetected) return "Dedo detectado";

    // SIN OPENCV, el feedback de CV se elimina
    // if (cvUsed) { 
    //   if (roiFromCv === undefined) return "No se pudo localizar el dedo en la imagen (CV).";
    //   if (skinConfFromCv !== undefined && skinConfFromCv < this.config.openCvMinSkinConfidence) {
    //     return "Color de piel no coincide (CV). Asegure buena iluminación.";
    //   }
    // }

    if (ppgQuality < this.config.minQualityThreshold && ppgQuality > 0) {
        return "Calidad de señal baja. Ajuste el dedo.";
    }
    if (!rhythmConfirmed && this.signalHistory.length > 50) { // Dar tiempo para que se acumulen datos
        const peaks = this.lastPeakTimes.length;
        if (peaks < this.config.minPeaksForRhythm && peaks > 0) return `Pocos picos detectados (${peaks}). Mantenga quieto.`;
        return "No se detecta ritmo cardiaco. Mantenga el dedo quieto.";
    }
     if (this.lastProcessedPpgValue !== 0 && Math.abs(this.lastProcessedPpgValue) < this.config.minSignalAmplitude / 2) {
        return "Señal muy débil. Cubra bien la cámara.";
    }
    
    // TODO: Añadir feedback de OpenCV (ej. "No se detecta piel en la imagen")
    
    return "Coloque el dedo en la cámara";
  }
  
  private handleUserFeedback(isFingerDetected: boolean, quality: number, rhythmDetected: boolean): void {
    // La lógica de Toast se puede mover aquí o manejarla en la UI basada en el `feedback` string.
    // Por simplicidad, la UI puede mostrar el string `feedback`.
  }

  public reset(): void {
    this.signalHistory = [];
    this.kalmanFilter.reset();
    this.bandpassFilter.reset();
    // this.validator.resetFingerDetection(); // Eliminado
    this.detectedRhythmicPatternsCount = 0;
    this.fingerConfirmedByRhythm = false;
    this.lastPeakTimes = [];
    this.lastProcessedPpgValue = 0;
    console.log("FingerDetectionManager: Reset completed");
  }

  // ELIMINADO EL MÉTODO COMPLETO DE OPENCV
  // private analyzeImageWithOpenCVInternal(imageData: ImageData): { roi?: FingerDetectionResult['roi'], skinConfidence?: number, extractedPpgValue?: number } {
    // ... toda la lógica de OpenCV eliminada ...
  // }
}

// Exportar la instancia singleton del nuevo manager
export const fingerDetectionManager = FingerDetectionManager.getInstance();
