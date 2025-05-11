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
  
  private config: FingerDetectionConfig = {
    minSignalAmplitude: 0.05,
    minQualityThreshold: 30,
    rhythmPatternWindowMs: 3000,
    minPeaksForRhythm: 5,
    peakDetectionThreshold: 0.3,
    requiredConsistentPatterns: 3,
    minSignalVariance: 0.005,
    minPeakIntervalMs: 250, // Corresponde a 240 BPM max
    maxPeakIntervalMs: 1500, // Corresponde a 40 BPM min
    maxIntervalDeviationMs: 120,
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
        // Usar un ROI un poco más grande para promediar, pero no demasiado
        const roiSize = Math.min(width, height, 20) / 2; // Radio de 10px max, o más pequeño si la imagen es pequeña
        let count = 0;
        for (let y = Math.floor(centerY - roiSize); y < Math.ceil(centerY + roiSize); y++) {
          for (let x = Math.floor(centerX - roiSize); x < Math.ceil(centerX + roiSize); x++) {
            if (x >= 0 && x < width && y >= 0 && y < height) {
              const i = (y * width + x) * 4;
              sum += data[i]; // Canal Rojo
              count++;
            }
          }
        }
        if (count > 0) {
            effectivePpgValue = sum / count;
            // Si el valor extraído es muy bajo o casi constante (poco cambio), podría ser ruido.
            // Esta es una heurística simple. Una mejor sería analizar varianza en el ROI.
            if (effectivePpgValue < 10) { // Asumiendo que la señal PPG útil es mayor que 10 (en escala 0-255)
                effectivePpgValue = undefined; // Tratar como no señal
            }
        } else {
            effectivePpgValue = undefined; // No se pudo extraer nada
        }
    }

    // --- Chequeo Primario de Señal Válida ---
    if (typeof effectivePpgValue !== 'number' || Math.abs(effectivePpgValue) < (this.config.minSignalAmplitude / 5)) { // Umbral muy bajo para considerar señal nula
      this.signalHistory = [];
      this.lastProcessedPpgValue = 0;
      this.detectedRhythmicPatternsCount = 0;
      this.fingerConfirmedByRhythm = false;
      this.lastPeakTimes = [];
      return {
        isFingerDetected: false,
        quality: 0,
        confidence: 0,
        rhythmDetected: false,
        rhythmConfidence: 0,
        signalStrength: 0,
        feedback: "No se detecta señal (dedo no presente o señal muy débil)",
        lastUpdate: currentTime,
        rawValue: effectivePpgValue ?? 0
      };
    }

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
    if (signalWindow.length > 1) {
      ppgAmplitude = Math.max(...signalWindow) - Math.min(...signalWindow);
    } else {
      ppgAmplitude = 0;
    }

    // --- Segundo Chequeo de Amplitud después del filtrado ---
    if (ppgAmplitude < this.config.minSignalAmplitude / 2) {
        // Si la amplitud es consistentemente muy baja, incluso después del filtrado, es probable que no haya dedo.
        // Reducir gradualmente la confianza en el ritmo.
        this.detectedRhythmicPatternsCount = Math.max(0, this.detectedRhythmicPatternsCount -1);
        if(this.detectedRhythmicPatternsCount === 0) {
            this.fingerConfirmedByRhythm = false;
        }
        // No retornar inmediatamente aquí, permitir que la calidad y confianza reflejen esto.
    }

    // --- Análisis de Señal PPG (Ritmo) ---
    // Solo si la amplitud da alguna esperanza.
    if (ppgAmplitude > this.config.minSignalAmplitude / 3) {
        rhythmResult = this.detectRhythmicPatternInternal(); 
        finalRhythmConfirmed = rhythmResult.isPatternConsistent && rhythmResult.confidence > 0.5;
        if (!finalRhythmConfirmed && this.fingerConfirmedByRhythm) { // Si el ritmo se pierde
             this.detectedRhythmicPatternsCount = 0; // Resetear contador de patrones
             this.fingerConfirmedByRhythm = false; // Perder confirmación de ritmo
        } else if (finalRhythmConfirmed && !this.fingerConfirmedByRhythm) {
            // Si se detecta un nuevo ritmo consistente
            this.fingerConfirmedByRhythm = true;
            // this.detectedRhythmicPatternsCount se maneja dentro de detectRhythmicPatternInternal
        }
    } else { // Si la amplitud es demasiado baja, no hay ritmo.
        rhythmResult = { isPatternConsistent: false, confidence: 0, peaksFound: [] };
        finalRhythmConfirmed = false;
        this.fingerConfirmedByRhythm = false;
        this.detectedRhythmicPatternsCount = 0;
    }
    
    const combinedPpgQuality = this.calculateCombinedPpgSignalQuality(ppgQualityFromVSProcessor, ppgFilteredValue, ppgAmplitude);

    // --- Sistema de Confianza Graduada y Detección Final ---
    let overallConfidence = 0;
    let isFingerActuallyDetected = false;

    overallConfidence = this.calculateOverallConfidence(
      finalRhythmConfirmed,
      rhythmResult.confidence,
      combinedPpgQuality, 
    );
    
    // Si la calidad combinada es muy baja, forzar no detección independientemente de la confianza calculada.
    if (combinedPpgQuality < this.config.minQualityThreshold / 2) { // ej. si minQuality es 30, umbral aquí es 15
        isFingerActuallyDetected = false;
        overallConfidence = Math.min(overallConfidence, 0.1); // Reducir confianza drásticamente
    } else {
        isFingerActuallyDetected = overallConfidence >= 0.60; 
    }
    
    // Si no se detecta el dedo, resetear la confirmación por ritmo para la próxima vez
    if (!isFingerActuallyDetected) {
        this.fingerConfirmedByRhythm = false;
        // No resetear detectedRhythmicPatternsCount aquí directamente, 
        // se maneja por la falta de confirmación y la baja amplitud.
    }

    // --- Generar Feedback ---
    const feedback = this.generateUserFeedback(
        isFingerActuallyDetected, 
        combinedPpgQuality, // Usar calidad combinada
        finalRhythmConfirmed,
    );

    // 5. Generar Resultado
    const result: FingerDetectionResult = {
      isFingerDetected: isFingerActuallyDetected,
      quality: combinedPpgQuality, // Usar calidad combinada
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

    if (recentSignalData.length < 20) { // Necesita suficientes puntos (ej. ~0.6s a 30fps)
      return { isPatternConsistent: false, confidence: 0, peaksFound: [] };
    }

    const values = recentSignalData.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    if (variance < this.config.minSignalVariance) {
      this.fingerConfirmedByRhythm = false; // Añadido: si varianza baja, no hay ritmo confirmado
      this.detectedRhythmicPatternsCount = 0; // Añadido: resetear contador de patrones
      return { isPatternConsistent: false, confidence: 0.1, peaksFound: [] }; 
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

    if (consistentIntervalCount >= this.config.minPeaksForRhythm - 1) { 
      this.detectedRhythmicPatternsCount++; // Incrementar aquí los patrones consistentes
      if(this.detectedRhythmicPatternsCount >= this.config.requiredConsistentPatterns){
        this.fingerConfirmedByRhythm = true; // Confirmar dedo por ritmo si se alcanzan suficientes patrones
      }
      return { isPatternConsistent: true, confidence: Math.max(0.5, rhythmConfidence) , peaksFound: this.lastPeakTimes };
    }
    // Si no es consistente, reducir el contador de patrones detectados
    this.detectedRhythmicPatternsCount = Math.max(0, this.detectedRhythmicPatternsCount -1);
    if (this.detectedRhythmicPatternsCount < this.config.requiredConsistentPatterns) {
        this.fingerConfirmedByRhythm = false; // Perder confirmación si cae por debajo
    }
    return { isPatternConsistent: false, confidence: rhythmConfidence, peaksFound: this.lastPeakTimes };
  }

  // Renombrar y ajustar para que reciba la calidad del VitalSignsSignalProcessor
  private calculateCombinedPpgSignalQuality(qualityFromVSProcessor: number, currentFilteredValue: number, ppgAmplitude: number): number {
    const history = this.signalHistory.map(p => p.value); 
    
    // Si la amplitud es casi nula, la calidad es cero.
    if (ppgAmplitude < this.config.minSignalAmplitude / 4) { // Umbral más estricto aquí
        return 0;
    }

    if (history.length < 30) return Math.min(15, qualityFromVSProcessor / 4);

    const range = Math.max(...history) - Math.min(...history);
    const amplitudeScore = Math.min(1, range / (this.config.minSignalAmplitude * 2.5)); 

    if (amplitudeScore < 0.1) { // Si la puntuación de amplitud es muy baja
        return Math.min(5, qualityFromVSProcessor / 10); // Calidad muy baja, influenciada mínimamente por VS processor
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
        (amplitudeScore * 0.45 +
        stabilityScore * 0.25 +
        periodicityScore * 0.3);
    selfCalculatedQualityNormalized = Math.min(1, Math.max(0, selfCalculatedQualityNormalized));

    // Combinar: Por ejemplo, 60% de la calidad de VSProcessor y 40% de la calculada aquí
    // O si VSProcessor da muy baja calidad, que pese más.
    let combinedWeightedQuality: number;
    if (qualityFromVSProcessor < 20) {
        combinedWeightedQuality = (qualityFromVSProcessor / 100) * 0.7 + selfCalculatedQualityNormalized * 0.3;
    } else if (qualityFromVSProcessor < 40) {
        combinedWeightedQuality = (qualityFromVSProcessor / 100) * 0.6 + selfCalculatedQualityNormalized * 0.4;
    } else {
        combinedWeightedQuality = (qualityFromVSProcessor / 100) * 0.5 + selfCalculatedQualityNormalized * 0.5; 
    }

    let finalQuality = Math.round(Math.min(1, Math.max(0, combinedWeightedQuality)) * 100);

    if (this.fingerConfirmedByRhythm) {
        finalQuality = Math.max(finalQuality, 50);
        finalQuality = Math.min(100, finalQuality + (this.detectedRhythmicPatternsCount / this.config.requiredConsistentPatterns) * 15);
    }
    
    if (range < this.config.minSignalAmplitude * 0.5) {
        finalQuality = Math.min(finalQuality, Math.max(0, finalQuality - 25)); 
    }
    if (range < this.config.minSignalAmplitude * 0.25) {
        finalQuality = Math.min(finalQuality, 15); 
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
  ): string {
    if (isDetected) return "Dedo detectado";

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
    if (this.vsSignalProcessor) { // Asegurarse que está instanciado
        this.vsSignalProcessor.reset();
    }
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
