/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// import { SignalValidator } from '../modules/vital-signs/validators/signal-validator'; // ELIMINADO
import { KalmanFilter } from '../core/signal/filters/KalmanFilter';
import { BandpassFilter } from '../core/signal/filters/BandpassFilter';
import { toast } from 'sonner';
// import type { Mat } from '@techstark/opencv-js'; // ELIMINADO OPENCV
import { SignalProcessor as VitalSignsSignalProcessor } from '../modules/vital-signs/signal-processor';

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
  private vsSignalProcessor: VitalSignsSignalProcessor; // NUEVA INSTANCIA
  
  private signalHistory: Array<{ time: number, value: number }> = []; // Adaptado de useSignalQualityDetector
  private readonly PPG_HISTORY_SIZE_MS = 5000; // Mantener 5 segundos de historial PPG para análisis diversos

  private detectedRhythmicPatternsCount: number = 0;
  private fingerConfirmedByRhythm: boolean = false;
  private lastPeakTimes: number[] = []; // Tiempos de los últimos picos detectados

  private lastProcessedPpgValue: number = 0;
  private consecutiveLowSignalFrames: number = 0; // NUEVO
  private readonly MAX_CONSECUTIVE_LOW_SIGNAL_FRAMES = 4; // NUEVO (ej. ~130ms a 30fps, antes era 5)
  
  private config: FingerDetectionConfig = {
    minSignalAmplitude: 0.05, // Mantener, pero su chequeo será más estricto
    minQualityThreshold: 35, // AUMENTADO de 30 a 35
    rhythmPatternWindowMs: 3000,
    minPeaksForRhythm: 5, 
    peakDetectionThreshold: 0.3, 
    requiredConsistentPatterns: 3, 
    minSignalVariance: 0.005, // Podría necesitar ajuste si el ruido tiene varianza
    minPeakIntervalMs: 250, 
    maxPeakIntervalMs: 1500, 
    maxIntervalDeviationMs: 100, // REDUCIDO de 120 a 100
    showToastFeedback: false, 
  };

  private constructor() {
    // this.validator = new SignalValidator(); // Eliminado
    this.vsSignalProcessor = new VitalSignsSignalProcessor(); // NUEVA INICIALIZACIÓN
    console.log("FingerDetectionManager: Initialized with VitalSignsSignalProcessor");
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
    // cvReady?: boolean // ELIMINADO OPENCV Y SU FLAG
  ): FingerDetectionResult {
    const currentTime = Date.now();
    let ppgFilteredValue = this.lastProcessedPpgValue; // Valor por defecto
    let ppgAmplitude = 0;
    let ppgQualityFromVSProcessor = 0; // NUEVO: para guardar calidad del VS processor
    let rhythmResult = { isPatternConsistent: false, confidence: 0, peaksFound: [] };
    let finalRhythmConfirmed = false;
    let effectivePpgValue = ppgValue; // Valor PPG que se usará para análisis de señal

    // --- Extracción de PPG (si imageData está presente y ppgValue no) ---
    if (imageData && typeof effectivePpgValue === 'undefined') {
        const data = imageData.data;
        let sum = 0;
        const width = imageData.width;
        const height = imageData.height;
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const roiSize = Math.min(width, height, 16) / 2; // Radio de 8px max (antes 10px)
        let count = 0;
        let minPixelVal = 255, maxPixelVal = 0;

        for (let y = Math.floor(centerY - roiSize); y < Math.ceil(centerY + roiSize); y++) {
          for (let x = Math.floor(centerX - roiSize); x < Math.ceil(centerX + roiSize); x++) {
            if (x >= 0 && x < width && y >= 0 && y < height) {
              const i = (y * width + x) * 4;
              const rValue = data[i]; // Canal Rojo
              sum += rValue;
              minPixelVal = Math.min(minPixelVal, rValue);
              maxPixelVal = Math.max(maxPixelVal, rValue);
              count++;
            }
          }
        }
        if (count > 0) {
            effectivePpgValue = sum / count;
            // Condición más estricta para la validez del PPG extraído de imagen
            // Necesita una mínima variación en el ROI y un valor promedio no demasiado bajo.
            if (effectivePpgValue < 20 || (maxPixelVal - minPixelVal) < 5) { 
                effectivePpgValue = undefined;
            }
        } else {
            effectivePpgValue = undefined;
        }
    }

    // --- Chequeo Primario de Señal Válida ---
    if (typeof effectivePpgValue !== 'number' || Math.abs(effectivePpgValue) < (this.config.minSignalAmplitude / 3)) { // Umbral un poco más estricto (era /5)
      this.consecutiveLowSignalFrames++;
      if (this.consecutiveLowSignalFrames >= this.MAX_CONSECUTIVE_LOW_SIGNAL_FRAMES) {
        this.resetSignalState(); // Resetear contadores de ritmo y picos
        return this.createNegativeResult("No se detecta señal persistente", effectivePpgValue, currentTime, 0);
      }
      // Aún no ha alcanzado el máximo de frames bajos, devolver un resultado intermedio negativo
      return this.createNegativeResult("Señal muy débil o ausente", effectivePpgValue, currentTime, 0);
    }

    this.consecutiveLowSignalFrames = 0; // Resetear contador si la señal es válida

    // Usar VitalSignsSignalProcessor para obtener valor filtrado y calidad base
    const processingResult = this.vsSignalProcessor.applyFilters(effectivePpgValue);
    ppgFilteredValue = processingResult.filteredValue;
    ppgQualityFromVSProcessor = processingResult.quality;

    this.signalHistory.push({ time: currentTime, value: ppgFilteredValue });
    while (this.signalHistory.length > 0 && currentTime - this.signalHistory[0].time > this.PPG_HISTORY_SIZE_MS) {
      this.signalHistory.shift();
    }
    this.lastProcessedPpgValue = ppgFilteredValue; 
    
    const signalWindow = this.signalHistory.map(p => p.value);
    ppgAmplitude = signalWindow.length > 1 ? Math.max(...signalWindow) - Math.min(...signalWindow) : 0;

    // --- Segundo Chequeo de Amplitud después del filtrado ---
    if (ppgAmplitude < this.config.minSignalAmplitude / 1.5) { // Antes era /2, ahora un poco más estricto
        this.detectedRhythmicPatternsCount = Math.max(0, this.detectedRhythmicPatternsCount - 2); // Penalizar más rápido
        if(this.detectedRhythmicPatternsCount === 0) {
            this.fingerConfirmedByRhythm = false;
        }
    }

    // --- Análisis de Señal PPG (Ritmo) ---
    // Solo si la amplitud da alguna esperanza.
    if (ppgAmplitude > this.config.minSignalAmplitude / 2) { // Antes /3
        rhythmResult = this.detectRhythmicPatternInternal(); 
        finalRhythmConfirmed = rhythmResult.isPatternConsistent && rhythmResult.confidence > 0.55; // Umbral de confianza de ritmo un poco mayor (era 0.5)
        if (!finalRhythmConfirmed && this.fingerConfirmedByRhythm) {
             this.resetRhythmState();
        } else if (finalRhythmConfirmed && !this.fingerConfirmedByRhythm) {
            this.fingerConfirmedByRhythm = true;
        }
    } else { // Si la amplitud es demasiado baja, no hay ritmo.
        rhythmResult = { isPatternConsistent: false, confidence: 0, peaksFound: [] };
        finalRhythmConfirmed = false;
        this.resetRhythmState(); // Resetear si la amplitud es demasiado baja para ritmo
    }
    
    const combinedPpgQuality = this.calculateCombinedPpgSignalQuality(ppgQualityFromVSProcessor, ppgFilteredValue, ppgAmplitude);

    // --- Sistema de Confianza Graduada y Detección Final ---
    let overallConfidence = 0;
    let isFingerActuallyDetected = false;

    if (combinedPpgQuality < this.config.minQualityThreshold / 2.5) { // Antes /2. Umbral más estricto
        isFingerActuallyDetected = false;
        overallConfidence = Math.min(0.05, this.calculateOverallConfidence( // Calcular pero luego aplastar
          finalRhythmConfirmed,
          rhythmResult.confidence,
          combinedPpgQuality, 
        ));
        this.resetRhythmState(); // Calidad muy mala, resetear confirmación de ritmo
    } else {
        overallConfidence = this.calculateOverallConfidence(
          finalRhythmConfirmed,
          rhythmResult.confidence,
          combinedPpgQuality, 
        );
        isFingerActuallyDetected = overallConfidence >= 0.62; // Umbral ligeramente más alto (era 0.60)
    }
    
    if (!isFingerActuallyDetected) {
        // Si no se detecta el dedo, y el ritmo estaba previamente confirmado, forzar reseteo de ritmo
        if(this.fingerConfirmedByRhythm) {
            this.resetRhythmState();
        }
        // No resetear detectedRhythmicPatternsCount aquí directamente si la calidad es decente pero la confianza no da.
        // Se maneja por la falta de confirmación y la baja amplitud.
    }

    // --- Generar Feedback ---
    const feedback = this.generateUserFeedback(
        isFingerActuallyDetected, 
        combinedPpgQuality,
        finalRhythmConfirmed,
        effectivePpgValue
    );

    // 5. Generar Resultado
    const result: FingerDetectionResult = {
      isFingerDetected: isFingerActuallyDetected,
      quality: isFingerActuallyDetected ? combinedPpgQuality : Math.min(combinedPpgQuality, 10), // Si no hay dedo, calidad baja
      confidence: overallConfidence,
      rhythmDetected: finalRhythmConfirmed,
      rhythmConfidence: rhythmResult.confidence,
      signalStrength: ppgAmplitude, // Usar amplitud en lugar de valor filtrado
      feedback,
      // roi: undefined, // ELIMINADO OPENCV
      // skinConfidence: undefined, // ELIMINADO OPENCV
      lastUpdate: currentTime,
      rawValue: effectivePpgValue // ASIGNAR el valor PPG efectivo usado
    };

    if (this.config.showToastFeedback) {
      this.handleUserFeedback(isFingerActuallyDetected, combinedPpgQuality, finalRhythmConfirmed);
    }

    return result;
  }
  
  // Adaptación de detectPeaks de useSignalQualityDetector
  private detectRhythmicPatternInternal(): { isPatternConsistent: boolean; confidence: number; peaksFound: number[] } {
    const currentTime = Date.now();
    const recentSignalData = this.signalHistory.filter(
      point => currentTime - point.time < this.config.rhythmPatternWindowMs
    );

    if (recentSignalData.length < 25) { // Aumentado de 20 a 25
      return { isPatternConsistent: false, confidence: 0, peaksFound: [] }; // Confianza 0
    }

    const values = recentSignalData.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    if (variance < this.config.minSignalVariance * 1.2) { // Umbral de varianza un poco más alto
      this.resetRhythmState();
      return { isPatternConsistent: false, confidence: 0.01, peaksFound: [] }; // Confianza casi 0
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
      return { isPatternConsistent: false, confidence: 0.05 + (0.05 * peaks.length / this.config.minPeaksForRhythm), peaksFound: this.lastPeakTimes }; // Confianza base más baja
    }

    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i].time - peaks[i - 1].time);
    }

    const validIntervals = intervals.filter(
      interval => interval >= this.config.minPeakIntervalMs && interval <= this.config.maxPeakIntervalMs
    );

    if (validIntervals.length < this.config.minPeaksForRhythm -1) {
      return { isPatternConsistent: false, confidence: 0.1 + (0.05 * validIntervals.length / (this.config.minPeaksForRhythm -1)), peaksFound: this.lastPeakTimes }; // Confianza base más baja
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
    const rhythmConfidence = (validIntervals.length > 0) ? (consistentIntervalCount / validIntervals.length) * 0.7 + 0.1 : 0.1; // Base más baja

    if (consistentIntervalCount >= this.config.minPeaksForRhythm - 1) { 
      this.detectedRhythmicPatternsCount = Math.min(this.config.requiredConsistentPatterns + 2, this.detectedRhythmicPatternsCount + 1); // Cap max count
      if(this.detectedRhythmicPatternsCount >= this.config.requiredConsistentPatterns){
        this.fingerConfirmedByRhythm = true;
      }
      return { isPatternConsistent: true, confidence: Math.max(0.55, rhythmConfidence) , peaksFound: this.lastPeakTimes }; // Umbral para true un poco mayor
    }
    
    this.detectedRhythmicPatternsCount = Math.max(0, this.detectedRhythmicPatternsCount -1);
    if (this.detectedRhythmicPatternsCount < this.config.requiredConsistentPatterns) {
        this.fingerConfirmedByRhythm = false;
    }
    return { isPatternConsistent: false, confidence: Math.max(0, rhythmConfidence - 0.1), peaksFound: this.lastPeakTimes }; // Penalizar confianza si no es consistente
  }

  // Renombrar y ajustar para que reciba la calidad del VitalSignsSignalProcessor
  private calculateCombinedPpgSignalQuality(qualityFromVSProcessor: number, currentFilteredValue: number, ppgAmplitude: number): number {
    const history = this.signalHistory.map(p => p.value); 
    
    if (ppgAmplitude < this.config.minSignalAmplitude / 3) { // Antes /4, un poco más permisivo para no matar la calidad tan rápido si hay un bajón momentáneo
        return 0;
    }

    if (history.length < 30) return Math.min(10, qualityFromVSProcessor / 5); // Calidad muy baja si no hay historial (antes 15 y /4)

    const range = Math.max(...history) - Math.min(...history); // es lo mismo que ppgAmplitude en este punto si history es signalWindow
    const amplitudeScore = Math.min(1, range / (this.config.minSignalAmplitude * 2.0)); // Más sensible a la amplitud (antes 2.5)

    if (amplitudeScore < 0.15) { // Antes 0.1
        return Math.min(3, qualityFromVSProcessor / 15); // Calidad casi nula (antes 5 y /10)
    }

    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    
    let stabilityScore = 0;
    if (variance < this.config.minSignalVariance * 0.3) stabilityScore = 0.1; 
    else if (variance < this.config.minSignalVariance * 0.7) stabilityScore = 0.4; 
    else if (variance > this.config.minSignalVariance * 15) stabilityScore = 0.2; 
    else stabilityScore = Math.min(1, (this.config.minSignalVariance * 5) / (variance + this.config.minSignalVariance * 2)); 
    
    const periodicityScore = this.calculatePpgPeriodicityScore(history);

    // Ponderar la calidad propia de FingerDetectionManager con la que viene de VitalSignsSignalProcessor
    let selfCalculatedQualityNormalized = 
        (amplitudeScore * 0.50 + // Mayor peso a la amplitud
        stabilityScore * 0.20 + // Menor peso a estabilidad
        periodicityScore * 0.3);
    selfCalculatedQualityNormalized = Math.min(1, Math.max(0, selfCalculatedQualityNormalized));

    // Si la calidad propia es muy mala, VSProcessor no debería rescatarla tanto.
    if (selfCalculatedQualityNormalized < 0.2) {
        qualityFromVSProcessor = Math.min(qualityFromVSProcessor, 30); // Limitar la influencia positiva de VSProcessor
    }

    let combinedWeightedQuality: number;
    if (qualityFromVSProcessor < 25) { // Antes 20
        combinedWeightedQuality = (qualityFromVSProcessor / 100) * 0.6 + selfCalculatedQualityNormalized * 0.4; // Menos peso a VS si es baja
    } else if (qualityFromVSProcessor < 45) { // Antes 40
        combinedWeightedQuality = (qualityFromVSProcessor / 100) * 0.5 + selfCalculatedQualityNormalized * 0.5;
    } else { // Calidad de VSProcessor es decente o alta
        combinedWeightedQuality = (qualityFromVSProcessor / 100) * 0.4 + selfCalculatedQualityNormalized * 0.6; // Dar más peso a la interna si VS es alta (para evitar que ruido con "calidad VS" alta domine)
    }

    let finalQuality = Math.round(Math.min(1, Math.max(0, combinedWeightedQuality)) * 100);

    if (this.fingerConfirmedByRhythm && this.detectedRhythmicPatternsCount >= this.config.requiredConsistentPatterns) {
        finalQuality = Math.max(finalQuality, 45); // Antes 50
        finalQuality = Math.min(100, finalQuality + (this.detectedRhythmicPatternsCount / this.config.requiredConsistentPatterns) * 10); // Menor bonus (era 15)
    } else { // Si no hay ritmo confirmado, penalizar más
        finalQuality *= 0.8;
    }
    
    if (range < this.config.minSignalAmplitude * 0.6) { // Antes 0.5
        finalQuality = Math.min(finalQuality, Math.max(0, finalQuality - 30)); // Mayor penalización (era 25)
    }
    if (range < this.config.minSignalAmplitude * 0.3) { // Antes 0.25
        finalQuality = Math.min(finalQuality, 10); // Antes 15
    }
     if (ppgAmplitude === 0 && history.length > 10) { // Si la amplitud es CERO absoluto con historial, calidad CERO
        finalQuality = 0;
    }

    return Math.max(0, Math.min(100, Math.round(finalQuality)));
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
    rhythmConfidenceValue: number,
    ppgQualityValue: number, // Calidad PPG (0-100)
  ): number {
    let totalWeightedScore = 0;
    let totalWeights = 0;

    const rhythmWeight = 0.55; // Reducido (era 0.6)
    let rhythmScoreContribution = rhythmConfidenceValue;
    if (!rhythmConfirmed) {
        rhythmScoreContribution *= 0.5; // Mayor penalización si no está confirmado (era 0.6)
    }
    totalWeightedScore += rhythmScoreContribution * rhythmWeight;
    totalWeights += rhythmWeight;

    const ppgQualityWeight = 0.45; // Aumentado (era 0.4)
    totalWeightedScore += (ppgQualityValue / 100) * ppgQualityWeight;
    totalWeights += ppgQualityWeight;
    
    if (totalWeights === 0) return 0;
    
    let finalConfidence = totalWeightedScore / totalWeights;
    
    // Penalizaciones más severas
    if (ppgQualityValue < this.config.minQualityThreshold * 0.8) { // Si la calidad está por debajo del 80% del umbral mínimo
      finalConfidence *= 0.1; // Reducción drástica (antes 0.4 o 0.2 para umbrales fijos)
    } else if (ppgQualityValue < this.config.minQualityThreshold) { // Si la calidad está por debajo del umbral mínimo
      finalConfidence *= 0.3;
    }
    
    if (rhythmConfidenceValue < 0.3 && !rhythmConfirmed) { // Si la confianza del ritmo es muy baja y no está confirmado
        finalConfidence *= 0.4;
    }

    return Math.min(1, Math.max(0, finalConfidence));
  }

  // Placeholder para la generación de feedback
  private generateUserFeedback(
    isDetected: boolean, 
    ppgQuality: number, 
    rhythmConfirmed: boolean,
    effectivePpgValue?: number
  ): string {
    if (isDetected) return `Dedo detectado (Q: ${ppgQuality}%)`;

    if (this.consecutiveLowSignalFrames > 0) {
        return "Señal muy débil o ausente. Asegure el dedo.";
    }
    if (typeof effectivePpgValue !== 'number' || Math.abs(effectivePpgValue) < (this.config.minSignalAmplitude / 3)) {
         return "Señal muy débil. Cubra bien la cámara.";
    }
    if (ppgQuality < this.config.minQualityThreshold && ppgQuality > 5) { // Evitar si la calidad es casi 0
        return `Calidad de señal baja (${ppgQuality}%). Ajuste el dedo.`;
    }
    if (!rhythmConfirmed && this.signalHistory.length > 50 && ppgQuality > 10) {
        const peaks = this.lastPeakTimes.length;
        if (peaks < this.config.minPeaksForRhythm && peaks > 0) return `Pocos picos (${peaks}). Mantenga quieto. (Q: ${ppgQuality}%)`;
        return `No se detecta ritmo. Mantenga quieto. (Q: ${ppgQuality}%)`;
    }
    
    return "Coloque el dedo en la cámara";
  }
  
  private handleUserFeedback(isFingerDetected: boolean, quality: number, rhythmDetected: boolean): void {
    // La lógica de Toast se puede mover aquí o manejarla en la UI basada en el `feedback` string.
    // Por simplicidad, la UI puede mostrar el string `feedback`.
  }

  public reset(): void {
    this.resetSignalState(); // Usa el nuevo método para resetear todo lo relacionado a la señal
    if (this.vsSignalProcessor) {
        this.vsSignalProcessor.reset();
    }
    this.consecutiveLowSignalFrames = 0; // Asegurarse de resetear esto también
    console.log("FingerDetectionManager: Reset completed");
  }

  private resetSignalState(): void {
    this.signalHistory = [];
    this.lastProcessedPpgValue = 0;
    this.resetRhythmState();
  }

  private resetRhythmState(): void {
    this.detectedRhythmicPatternsCount = 0;
    this.fingerConfirmedByRhythm = false;
    this.lastPeakTimes = [];
  }
  
  private createNegativeResult(feedback: string, rawValue: number | undefined, currentTime: number, quality: number = 0): FingerDetectionResult {
    return {
      isFingerDetected: false,
      quality: quality,
      confidence: 0,
      rhythmDetected: false,
      rhythmConfidence: 0,
      signalStrength: 0,
      feedback: feedback,
      lastUpdate: currentTime,
      rawValue: rawValue ?? 0
    };
  }

  // ELIMINADO EL MÉTODO COMPLETO DE OPENCV
  // private analyzeImageWithOpenCVInternal(imageData: ImageData): { roi?: FingerDetectionResult['roi'], skinConfidence?: number, extractedPpgValue?: number } {
    // ... toda la lógica de OpenCV eliminada ...
  // }
}

// Exportar la instancia singleton del nuevo manager
export const fingerDetectionManager = FingerDetectionManager.getInstance();
