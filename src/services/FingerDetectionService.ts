/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// import { SignalValidator } from '../modules/vital-signs/validators/signal-validator'; // ELIMINADO
import { KalmanFilter } from '../core/signal/filters/KalmanFilter';
import { BandpassFilter } from '../core/signal/filters/BandpassFilter';
import { toast } from 'sonner';
import cv from '@techstark/opencv-js'; // Asegurar que OpenCV esté importado

export interface FingerDetectionConfig {
  minSignalAmplitude: number; // Amplitud mínima de la señal PPG cruda o filtrada para ser considerada.
  minQualityThreshold: number; // Umbral de calidad de la señal PPG (0-100) para considerar el dedo presente.
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
  openCvMinSkinConfidence: number; // Umbral mínimo de confianza de OpenCV para detección de piel.
  openCvMinContourArea: number; // Área mínima de contorno para ser considerado ROI por OpenCV.
  openCvSkinLowerHsv: [number, number, number]; // Límite inferior HSV para piel
  openCvSkinUpperHsv: [number, number, number]; // Límite superior HSV para piel
  showToastFeedback: boolean; // NUEVO: Para controlar toasts de sonner
  openCvMorphKernelSize: number; // Tamaño del kernel para operaciones morfológicas
  openCvSolidityThreshold: number; // Umbral mínimo de solidez para ROI
  openCvAspectRatioMin: number; // Relación de aspecto mínima (e.g. width/height)
  openCvAspectRatioMax: number; // Relación de aspecto máxima
}

export interface FingerDetectionResult {
  isFingerDetected: boolean;
  quality: number; // Calidad general de la señal PPG (0-100)
  confidence: number; // Confianza general de detección de dedo (0-1)
  rhythmDetected: boolean; // Si se detectó un patrón rítmico cardiaco
  rhythmConfidence: number; // Confianza específica del patrón rítmico (0-1)
  signalStrength: number; // Fuerza de la señal PPG actual
  feedback?: string; // Mensajes para el usuario
  roi?: { x: number; y: number; width: number; height: number }; // ROI detectada por OpenCV
  skinConfidence?: number; // Confianza de detección de piel por OpenCV
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
    openCvMinSkinConfidence: 0.4,
    openCvMinContourArea: 500, // Ajustar según resolución de cámara típica
    openCvSkinLowerHsv: [0, 40, 30], // Ejemplo, ajustar
    openCvSkinUpperHsv: [40, 255, 255], // Ejemplo, ajustar
    showToastFeedback: false, // Por defecto no mostrar toasts, puede ser ruidoso
    openCvMorphKernelSize: 3, // Kernel de 3x3 para morfología
    openCvSolidityThreshold: 0.75, // Ejemplo: contorno debe ser al menos 75% sólido
    openCvAspectRatioMin: 0.2, // Ejemplo: dedo más alto que ancho (o viceversa si se rota)
    openCvAspectRatioMax: 1.5, // Ejemplo: evitar formas demasiado alargadas o cuadradas si no se esperan
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
    imageData?: ImageData,
    ppgValue?: number,
    cvReady?: boolean
  ): FingerDetectionResult {
    const currentTime = Date.now();
    let ppgFilteredValue = this.lastProcessedPpgValue; // Valor por defecto
    let ppgAmplitude = 0;
    let roiDetected: FingerDetectionResult['roi'] | undefined = undefined;
    let skinConfidence: number | undefined = undefined;
    let rhythmResult = { isPatternConsistent: false, confidence: 0, peaksFound: [] };
    let finalRhythmConfirmed = false;
    let effectivePpgValue = ppgValue; // Valor PPG que se usará para análisis de señal

    const DEBUG_OPENCV_OUTPUT = true; // <--- TEMPORAL DEBUG FLAG

    // --- Lógica de OpenCV --- 
    let cvAnalysisResults: { roi?: FingerDetectionResult['roi'], skinConfidence?: number, extractedPpgValue?: number} = {};
    if (imageData && cvReady && (cv as any).Mat) {
      cvAnalysisResults = this.analyzeImageWithOpenCVInternal(imageData);
      roiDetected = cvAnalysisResults.roi;
      skinConfidence = cvAnalysisResults.skinConfidence;
      effectivePpgValue = cvAnalysisResults.extractedPpgValue ?? ppgValue; // Si CV extrajo, usarlo. Sino, el ppgValue de entrada.
    } else {
      effectivePpgValue = ppgValue;
    }

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

    if (DEBUG_OPENCV_OUTPUT && imageData && cvReady && (cv as any).Mat) {
        // **** MODO DEBUG OPENCV ****
        // Basar la detección principalmente en la salida de OpenCV
        if (roiDetected && skinConfidence !== undefined && skinConfidence >= this.config.openCvMinSkinConfidence) {
            isFingerActuallyDetected = true;
            overallConfidence = skinConfidence; // Usar confianza de piel como confianza general
            console.log("FDM_DEBUG_CV: Dedo DETECTADO por CV (ROI y Piel OK)", {roi: roiDetected, skinConf: skinConfidence});
        } else {
            isFingerActuallyDetected = false;
            overallConfidence = skinConfidence !== undefined ? skinConfidence * 0.5 : 0.2; // Baja confianza si CV falla
            console.log("FDM_DEBUG_CV: Dedo NO DETECTADO por CV", {roi: roiDetected, skinConf: skinConfidence});
        }
        // Para depuración, la calidad y ritmo PPG se ignoran temporalmente para la decisión final
        // pero aún se calculan y se incluyen en el resultado para logging.
    } else {
        // **** MODO NORMAL ****
        overallConfidence = this.calculateOverallConfidence(
          finalRhythmConfirmed,
          rhythmResult.confidence,
          ppgQuality,
          roiDetected !== undefined,
          skinConfidence
        );
        isFingerActuallyDetected = overallConfidence >= 0.6; // Umbral normal
    }

    // --- Generar Feedback ---
    const feedback = this.generateUserFeedback(
        isFingerActuallyDetected, 
        ppgQuality, 
        finalRhythmConfirmed,
        roiDetected,
        skinConfidence,
        imageData && cvReady && (cv as any).Mat ? true : false
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
      roi: roiDetected,
      skinConfidence,
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
    cvRoiWasActuallyDetected: boolean, // Indica si el análisis de CV (si se ejecutó) encontró una ROI
    cvCalculatedSkinConfidence?: number // Confianza de piel calculada por CV (0-1), si se ejecutó y encontró piel
  ): number {
    let totalWeightedScore = 0;
    let totalWeights = 0;

    // 1. Confianza del Ritmo Cardíaco
    const rhythmWeight = 0.45;
    let rhythmScore = rhythmConfidenceValue;
    if (!rhythmConfirmed) {
        // Si el ritmo no está "confirmado" (pocos patrones consistentes),
        // la confianza del ritmo base se reduce.
        rhythmScore *= 0.6; 
    }
    totalWeightedScore += rhythmScore * rhythmWeight;
    totalWeights += rhythmWeight;

    // 2. Calidad de la Señal PPG
    const ppgQualityWeight = 0.35;
    // Normalizar ppgQualityValue (0-100) a (0-1)
    totalWeightedScore += (ppgQualityValue / 100) * ppgQualityWeight;
    totalWeights += ppgQualityWeight;

    // 3. Confianza de OpenCV (Platzhalter, se activará cuando se implemente OpenCV)
    const opencvWeight = 0.20;
    // La decisión de si OpenCV contribuye se basa en si se detectó una ROI.
    // Se asume que si cvRoiWasActuallyDetected es true, el intento de usar CV se hizo.

    if (cvRoiWasActuallyDetected && cvCalculatedSkinConfidence !== undefined) {
      let skinScore = cvCalculatedSkinConfidence;
      if (skinScore < this.config.openCvMinSkinConfidence) {
        skinScore *= 0.5; // Penalizar si la confianza de piel es baja pero ROI detectada
      }
      totalWeightedScore += skinScore * opencvWeight;
      totalWeights += opencvWeight;
    } else if (cvRoiWasActuallyDetected) {
      // ROI detectada pero no hay información de confianza de piel (o no es concluyente)
      totalWeightedScore += 0.25 * opencvWeight; // Puntuación base por detectar una ROI candidata
      totalWeights += opencvWeight;
    }

    // Ajuste final: si la calidad PPG es muy baja, o el ritmo tiene confianza muy baja,
    // limitar la confianza general para evitar falsos positivos incluso si CV fuera bueno.
    if (ppgQualityValue < 20 && rhythmConfidenceValue < 0.3) {
      totalWeightedScore *= 0.5;
    } else if (ppgQualityValue < 10 || rhythmConfidenceValue < 0.15) {
      totalWeightedScore *= 0.3;
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
    roiFromCv?: FingerDetectionResult['roi'],
    skinConfFromCv?: number,
    cvUsed?: boolean
  ): string {
    if (isDetected) return "Dedo detectado";

    if (cvUsed) { // Solo dar feedback de CV si se intentó usar
      if (roiFromCv === undefined) return "No se pudo localizar el dedo en la imagen (CV).";
      if (skinConfFromCv !== undefined && skinConfFromCv < this.config.openCvMinSkinConfidence) {
        return "Color de piel no coincide (CV). Asegure buena iluminación.";
      }
    }

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

  private analyzeImageWithOpenCVInternal(imageData: ImageData): { roi?: FingerDetectionResult['roi'], skinConfidence?: number, extractedPpgValue?: number } {
    let srcMat: any = null;
    let rgbMat: any = null;
    let hsvMat: any = null;
    let skinMask: any = null;
    let contours: any = null; 
    let hierarchy: any = null;
    let bestRoi: FingerDetectionResult['roi'] | undefined = undefined;
    let calculatedSkinConfidence: number | undefined = undefined;
    let ppgFromRoi: number | undefined = undefined;
    let scoreForBestRoi = -1; 
    let initialContoursCount = 0;
    let bestContourIndex = -1;

    console.log("FDM_CV_INTERNAL: Iniciando análisis de OpenCV. Configuración actual:", {
      minContourArea: this.config.openCvMinContourArea,
      solidityThreshold: this.config.openCvSolidityThreshold,
      aspectRatioMin: this.config.openCvAspectRatioMin,
      aspectRatioMax: this.config.openCvAspectRatioMax,
      hsvLower: this.config.openCvSkinLowerHsv,
      hsvUpper: this.config.openCvSkinUpperHsv,
      morphKernel: this.config.openCvMorphKernelSize
    });

    try {
      if (!(cv as any).Mat || !imageData) {
        console.warn("FingerDetectionManager: OpenCV Mat no disponible o imageData nula.");
        return {};
      }
      srcMat = cv.matFromImageData(imageData); // RGBA
      rgbMat = new cv.Mat();
      cv.cvtColor(srcMat, rgbMat, cv.COLOR_RGBA2RGB);
      hsvMat = new cv.Mat();
      cv.cvtColor(rgbMat, hsvMat, cv.COLOR_RGB2HSV);

      skinMask = new cv.Mat();
      const lowerSkin = new cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), this.config.openCvSkinLowerHsv);
      const upperSkin = new cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), this.config.openCvSkinUpperHsv);
      cv.inRange(hsvMat, lowerSkin, skinMask);
      lowerSkin.delete();
      upperSkin.delete();

      // Opcional: Operaciones morfológicas para limpiar la máscara
      let morphKernel = cv.Mat.ones(this.config.openCvMorphKernelSize, this.config.openCvMorphKernelSize, cv.CV_8U);
      // MORPH_OPEN: Erosión seguida de Dilatación (elimina ruido pequeño)
      cv.morphologyEx(skinMask, skinMask, cv.MORPH_OPEN, morphKernel, new cv.Point(-1,-1), 1);
      // MORPH_CLOSE: Dilatación seguida de Erosión (cierra pequeños agujeros)
      cv.morphologyEx(skinMask, skinMask, cv.MORPH_CLOSE, morphKernel, new cv.Point(-1,-1), 2); // Dos iteraciones pueden ser más efectivas
      morphKernel.delete();

      cv.findContours(skinMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      initialContoursCount = contours.size();

      let largestContourArea = 0;

      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area < this.config.openCvMinContourArea) {
          contour.delete();
          continue;
        }

        const rect = cv.boundingRect(contour);
        const aspectRatio = rect.width / rect.height;

        let hull = new cv.Mat();
        cv.convexHull(contour, hull, false, true);
        const hullArea = cv.contourArea(hull);
        const solidity = hullArea > 0 ? area / hullArea : 0;
        hull.delete();

        // Calcular puntuación para este contorno
        let score = 0;
        score += area / 1000; // Ponderar área (normalizar)

        if (solidity >= this.config.openCvSolidityThreshold) {
          score += solidity * 2; // Bonificación por buena solidez
        } else {
          score -= (1 - solidity) * 2; // Penalización por baja solidez
        }

        if (aspectRatio >= this.config.openCvAspectRatioMin && aspectRatio <= this.config.openCvAspectRatioMax) {
          score += 1; // Bonificación por relación de aspecto aceptable
        } else {
          // Penalización leve si está fuera de rango, podría ser ruido
          score -= 0.5 * Math.abs(aspectRatio - (this.config.openCvAspectRatioMin + this.config.openCvAspectRatioMax)/2);
        }
        
        if (score > scoreForBestRoi) {
          if (bestContourIndex !== -1) {
            // El contorno anterior (no el mejor) ya fue eliminado o será eliminado si no es este.
          }
          scoreForBestRoi = score;
          bestContourIndex = i; 
          largestContourArea = area; 
        } else {
          contour.delete(); // No es el mejor, liberar este contorno
        }
      }

      if (bestContourIndex !== -1) {
        const fingerContour = contours.get(bestContourIndex); // Obtener el mejor contorno FINAL
        if (fingerContour && fingerContour.size && fingerContour.size().height > 0) { // Chequeo de validez
          const rect = cv.boundingRect(fingerContour);
          bestRoi = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };

          const roiMaskCv = new cv.Mat(skinMask.rows, skinMask.cols, cv.CV_8UC1, new cv.Scalar(0));
          const roiContourVec = new cv.MatVector();
          roiContourVec.push_back(fingerContour);
          cv.drawContours(roiMaskCv, roiContourVec, 0, new cv.Scalar(255), cv.FILLED);
          roiContourVec.delete();
          
          const skinPixelsInRoi = cv.countNonZero(skinMask.roi(rect)); // Píxeles de piel DENTRO de la ROI (usando skinMask original)
          const totalPixelsInRoi = rect.width * rect.height;
          if (totalPixelsInRoi > 0) {
            calculatedSkinConfidence = skinPixelsInRoi / totalPixelsInRoi;
          }
          roiMaskCv.delete();
          
          // Extraer valor PPG (promedio canal rojo) de la ROI
          const ppgRoiMat = rgbMat.roi(rect);
          const meanColor = cv.mean(ppgRoiMat);
          ppgFromRoi = meanColor[0]; // Canal Rojo
          ppgRoiMat.delete();

          fingerContour.delete(); // Liberar el mejor contorno después de usarlo
        } else {
           if(fingerContour) fingerContour.delete(); // Si se obtuvo pero no es válido
        }
      }
      
      // Comentario sobre YCrCb
      // Para una detección de piel potencialmente más robusta a la iluminación,
      // se podría considerar el espacio de color YCrCb.
      // 1. Convertir RGB a YCrCb: cv.cvtColor(rgbMat, ycrcbMat, cv.COLOR_RGB2YCrCb);
      // 2. Aplicar umbrales a los canales Y, Cr, Cb.
      //    Ej: Cr en [133, 173], Cb en [77, 127]

    } catch (e) {
      console.error("FingerDetectionManager: OpenCV analysis error:", e);
      // No hacer nada más, devolverá objeto vacío o lo que se haya procesado hasta ahora
    } finally {
      srcMat?.delete();
      rgbMat?.delete();
      hsvMat?.delete();
      skinMask?.delete();
      contours?.delete(); // Asegurar liberación
      hierarchy?.delete();
    }

    console.log("FDM_CV_INTERNAL: Resultados del análisis de OpenCV:", {
      bestRoi: bestRoi,
      calculatedSkinConfidence: calculatedSkinConfidence,
      extractedPpgValue: ppgFromRoi,
      bestScore: scoreForBestRoi,
      contoursFoundInitial: initialContoursCount,
      contoursAfterProcessing: bestContourIndex !== -1 ? 1 : 0
    });

    return { roi: bestRoi, skinConfidence: calculatedSkinConfidence, extractedPpgValue: ppgFromRoi };
  }
}

// Exportar la instancia singleton del nuevo manager
export const fingerDetectionManager = FingerDetectionManager.getInstance();
