/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// import { SignalValidator } from '../modules/vital-signs/validators/signal-validator'; // ELIMINADO
import { KalmanFilter } from '../core/signal/filters/KalmanFilter';
import { BandpassFilter } from '../core/signal/filters/BandpassFilter';
import { toast } from 'sonner';

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
    minSignalAmplitude: 0.01,
    minQualityThreshold: 35,
    rhythmPatternWindowMs: 3000,
    minPeaksForRhythm: 4, // de useSignalQualityDetector
    peakDetectionThreshold: 0.1, // Ajustar según normalización de señal de entrada
    requiredConsistentPatterns: 4, // de useSignalQualityDetector
    minSignalVariance: 0.005, // Ajustar este valor empíricamente
    minPeakIntervalMs: 300,  // Corresponde a 200 BPM
    maxPeakIntervalMs: 1500, // Corresponde a 40 BPM
    maxIntervalDeviationMs: 150, // de useSignalQualityDetector
    openCvMinSkinConfidence: 0.6,
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
    imageData?: ImageData, // Para OpenCV
    ppgValue?: number, // Para análisis de señal PPG
    cvReady?: boolean // Indica si OpenCV está listo para usarse
  ): FingerDetectionResult {
    const currentTime = Date.now();

    let ppgFilteredValue = 0;
    if (ppgValue !== undefined) {
      const kalmanFiltered = this.kalmanFilter.filter(ppgValue);
      ppgFilteredValue = this.bandpassFilter.filter(kalmanFiltered);
      this.lastProcessedPpgValue = ppgFilteredValue;

      this.signalHistory.push({ time: currentTime, value: ppgFilteredValue });
      // Mantener el historial PPG dentro de PPG_HISTORY_SIZE_MS
      this.signalHistory = this.signalHistory.filter(
        point => currentTime - point.time < this.PPG_HISTORY_SIZE_MS
      );
    } else {
      // Si no hay nuevo valor PPG, usar el último procesado para algunas lógicas
      // o simplemente no actualizar las partes dependientes de PPG.
      // Por ahora, usaremos el último valor procesado si existe historia.
      ppgFilteredValue = this.signalHistory.length > 0 ? this.signalHistory[this.signalHistory.length - 1].value : 0;
    }
    
    // 1. Detección de Patrón Rítmico (adaptado de useSignalQualityDetector)
    const rhythmResult = this.detectRhythmicPatternInternal();
    this.fingerConfirmedByRhythm = rhythmResult.isPatternConsistent;
    if (rhythmResult.isPatternConsistent) {
        this.detectedRhythmicPatternsCount = Math.min(
            this.config.requiredConsistentPatterns + 2, // Allow some buffer
            this.detectedRhythmicPatternsCount + 1
        );
    } else {
        this.detectedRhythmicPatternsCount = Math.max(0, this.detectedRhythmicPatternsCount -1);
    }
    const finalRhythmConfirmed = this.detectedRhythmicPatternsCount >= this.config.requiredConsistentPatterns;


    // TODO: 2. Análisis de ROI y Color de Piel con OpenCV (usando imageData)
    let roiDetected: FingerDetectionResult['roi'] = undefined;
    let skinConfidence: FingerDetectionResult['skinConfidence'] = undefined;
    
    // Placeholder para la lógica de OpenCV dentro de FingerDetectionManager
    if (imageData && cvReady /* && this.config.useOpenCV */) {
      // const cvAnalysisResult = this.analyzeImageWithOpenCVInternal(imageData);
      // roiDetected = cvAnalysisResult.roi;
      // skinConfidence = cvAnalysisResult.skinConfidence;
      // Por ahora, simulamos que si CV está listo y hay imagen, se detecta algo genérico
      // Esto se reemplazará con la lógica real de OpenCV más adelante.
      // roiDetected = { x: imageData.width * 0.3, y: imageData.height * 0.3, width: imageData.width * 0.4, height: imageData.height * 0.4 };
      // skinConfidence = 0.75; // Simulación
    }


    // 3. Cálculo de Calidad de Señal PPG (a implementar/mejorar)
    const ppgQuality = this.calculatePpgSignalQuality(ppgFilteredValue);


    // 4. Sistema de Confianza Graduada y Detección Final
    const overallConfidence = this.calculateOverallConfidence(
      finalRhythmConfirmed,
      rhythmResult.confidence, // confianza del detector de ritmo
      ppgQuality,
      roiDetected !== undefined, // bool si se detectó ROI
      skinConfidence // confianza de piel de CV (0-1)
    );

    const isFingerActuallyDetected = overallConfidence >= 0.6; // Umbral de ejemplo

    // 5. Generar Feedback
    const feedback = this.generateUserFeedback(
        isFingerActuallyDetected, 
        ppgQuality, 
        finalRhythmConfirmed,
        roiDetected,
        skinConfidence
    );


    return {
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
    };
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
  private calculatePpgSignalQuality(currentFilteredValue: number): number {
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
    roiFromCv?: FingerDetectionResult['roi'], // Añadido para feedback
    skinConfFromCv?: number // Añadido para feedback
  ): string {
    if (isDetected) return "Dedo detectado";

    // Feedback de OpenCV (si se usó y falló)
    // if (this.config.useOpenCV && this.isCvReady ) { // Asumiendo que imageData se pasó
    //   if (roiFromCv === undefined) return "No se pudo localizar el dedo en la imagen.";
    //   if (skinConfFromCv !== undefined && skinConfFromCv < this.config.openCvMinSkinConfidence) {
    //     return "Color de piel no coincide. Asegure buena iluminación.";
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
}

// Exportar la instancia singleton del nuevo manager
export const fingerDetectionManager = FingerDetectionManager.getInstance();
