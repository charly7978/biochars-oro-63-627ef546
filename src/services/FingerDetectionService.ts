/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SignalValidator } from '../modules/vital-signs/validators/signal-validator';
import { KalmanFilter } from '../core/signal/filters/KalmanFilter';
import { BandpassFilter } from '../core/signal/filters/BandpassFilter';
import { toast } from 'sonner';

export interface FingerDetectionConfig {
  minSignalAmplitude: number;
  minQualityThreshold: number;
  maxWeakSignalsCount: number;
  rhythmPatternWindow: number;
  minConsistentPatterns: number;
}

export interface FingerDetectionResult {
  isFingerDetected: boolean;
  quality: number;
  confidence: number;
  rhythmDetected: boolean;
  signalStrength: number;
  lastUpdate: number;
  feedback?: string;
}

class FingerDetectionService {
  private static instance: FingerDetectionService;
  private validator: SignalValidator;
  private kalmanFilter: KalmanFilter;
  private bandpassFilter: BandpassFilter;
  
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 90; // 3 seconds at 30fps
  private lastNotificationTime = 0;
  private readonly NOTIFICATION_COOLDOWN = 3000; // 3 seconds between notifications
  
  private config: FingerDetectionConfig = {
    minSignalAmplitude: 0.01,
    minQualityThreshold: 35,
    maxWeakSignalsCount: 5,
    rhythmPatternWindow: 3000,
    minConsistentPatterns: 4
  };

  private fingerDetectionWindow = 0;
  private fingerDetected = false;
  // Propiedades para cooldown y último resultado
  private _cooldownStart: number | null = null;
  private _lastResult: FingerDetectionResult | null = null;

  private constructor() {
    this.validator = new SignalValidator();
    this.kalmanFilter = new KalmanFilter();
    this.bandpassFilter = new BandpassFilter(0.5, 4, 30);
    console.log("FingerDetectionService: Initialized with default config");
  }

  public static getInstance(): FingerDetectionService {
    if (!FingerDetectionService.instance) {
      FingerDetectionService.instance = new FingerDetectionService();
    }
    return FingerDetectionService.instance;
  }

  public updateConfig(newConfig: Partial<FingerDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("FingerDetectionService: Config updated", this.config);
  }

  public processSignal(rawValue: number): FingerDetectionResult {
    // Apply filters
    const kalmanFiltered = this.kalmanFilter.filter(rawValue);
    const filteredValue = this.bandpassFilter.filter(kalmanFiltered);
    
    // Update history
    this.signalHistory.push(filteredValue);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }

    // Track for rhythm pattern detection
    this.validator.trackSignalForPatternDetection(filteredValue);

    // Ampliar el buffer de análisis a 120 muestras (~4 segundos)
    const ANALYSIS_BUFFER_SIZE = 120; // 4 segundos a 30Hz
    const recentSignals = this.signalHistory.slice(-ANALYSIS_BUFFER_SIZE);
    const amplitude = Math.max(...recentSignals) - Math.min(...recentSignals);
    const mean = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const variance = recentSignals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentSignals.length;
    const stdDev = Math.sqrt(variance);
    const isFlat = stdDev < 0.002;
    const isSaturated = recentSignals.filter(v => Math.abs(v) > 0.95).length > recentSignals.length * 0.2;
    const signalPower = mean * mean;
    const noisePower = variance;
    const snr = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 0;
    const snrLow = snr < 10; // SNR mínimo 10dB
    // Detección de picos fisiológicos
    const peaks = [];
    for (let i = 2; i < recentSignals.length - 2; i++) {
      if (
        recentSignals[i] > recentSignals[i-1] && recentSignals[i] > recentSignals[i-2] &&
        recentSignals[i] > recentSignals[i+1] && recentSignals[i] > recentSignals[i+2] &&
        recentSignals[i] - mean > 0.01
      ) {
        if (peaks.length === 0 || i - peaks[peaks.length-1] > 8) {
          peaks.push(i);
        }
      }
    }
    // Intervalos entre picos
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    const validIntervals = intervals.filter(iv => iv >= 8 && iv <= 45);
    let cv = 1;
    if (validIntervals.length >= 2) {
      const avgIv = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
      const varIv = validIntervals.reduce((a, b) => a + Math.pow(b - avgIv, 2), 0) / validIntervals.length;
      cv = Math.sqrt(varIv) / avgIv;
    }
    // Periodicidad (autocorrelación máxima en ventana fisiológica)
    function autocorr(sig, lag) {
      let sum = 0;
      for (let i = 0; i < sig.length - lag; i++) {
        sum += (sig[i] - mean) * (sig[i + lag] - mean);
      }
      return sum / (sig.length - lag);
    }
    let periodicityScore = 0;
    for (let lag = 8; lag <= 45; lag++) {
      const ac = autocorr(recentSignals, lag);
      if (ac > periodicityScore) periodicityScore = ac;
    }
    periodicityScore = Math.max(0, Math.min(1, periodicityScore / (variance || 1)));
    // Forma de onda fisiológica: subida/bajada
    let upTime = 0, downTime = 0;
    for (let i = 1; i < recentSignals.length; i++) {
      if (recentSignals[i] > recentSignals[i-1]) upTime++;
      else if (recentSignals[i] < recentSignals[i-1]) downTime++;
    }
    const upDownRatio = downTime > 0 ? upTime / downTime : 0;
    const physiologicalShape = upDownRatio > 0.9 && upDownRatio < 1.1;
    // Chequeo de saltos grandes
    let hasJump = false;
    for (let i = 1; i < recentSignals.length; i++) {
      if (Math.abs(recentSignals[i] - recentSignals[i-1]) > 0.2) {
        hasJump = true;
        break;
      }
    }
    // Criterios fisiológicos estrictos
    const allCriteria = (
      amplitude > 0.02 &&
      !isFlat &&
      !isSaturated &&
      !snrLow &&
      periodicityScore > 0.5 &&
      validIntervals.length >= 3 &&
      cv < 0.15 &&
      !hasJump &&
      physiologicalShape &&
      this.validator.isFingerDetected()
    );
    if (allCriteria) {
      this.fingerDetectionWindow++;
      if (this.fingerDetectionWindow >= ANALYSIS_BUFFER_SIZE) {
        this.fingerDetected = true;
      }
    } else {
      this.fingerDetectionWindow = 0;
      this.fingerDetected = false;
    }
    // Guardar último resultado
    this._lastResult = {
      isFingerDetected: this.fingerDetected,
      quality: 0,
      confidence: 0,
      rhythmDetected: this.validator.isFingerDetected(),
      signalStrength: amplitude,
      lastUpdate: Date.now(),
      feedback: this.generateFeedback(
        allCriteria,
        0,
        amplitude,
        this.validator.isFingerDetected(),
        snr,
        physiologicalShape,
        periodicityScore,
        cv,
        hasJump,
        isFlat,
        isSaturated
      )
    };
    return this._lastResult;
  }

  private calculateSignalQuality(): number {
    if (this.signalHistory.length < 30) return 0;
    
    const recentSignals = this.signalHistory.slice(-30);
    const mean = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const variance = recentSignals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentSignals.length;
    
    // Normalize quality score between 0-100
    const amplitude = Math.max(...recentSignals) - Math.min(...recentSignals);
    const baseQuality = Math.min(100, Math.max(0, (amplitude / this.config.minSignalAmplitude) * 50));
    const stabilityScore = Math.min(50, Math.max(0, (1 - Math.sqrt(variance)) * 50));
    
    return Math.round(baseQuality + stabilityScore);
  }

  private calculateConfidence(signalStrength: number, rhythmDetected: boolean, quality: number): number {
    const strengthScore = Math.min(1, signalStrength / (this.config.minSignalAmplitude * 2));
    const qualityScore = quality / 100;
    const rhythmScore = rhythmDetected ? 1 : 0;
    
    return (strengthScore * 0.3 + qualityScore * 0.4 + rhythmScore * 0.3);
  }

  private determineFingerPresence(signalStrength: number, rhythmDetected: boolean, quality: number): boolean {
    return (
      signalStrength >= this.config.minSignalAmplitude &&
      quality >= this.config.minQualityThreshold &&
      rhythmDetected
    );
  }

  private generateFeedback(isFingerDetected: boolean, quality: number, signalStrength: number, rhythmDetected: boolean, snr?: number, physiologicalShape?: boolean, periodicityScore?: number, cv?: number, hasJump?: boolean, isFlat?: boolean, isSaturated?: boolean): string {
    if (!isFingerDetected) {
      if (signalStrength < 0.02) return "Amplitud insuficiente: coloque el dedo correctamente";
      if (isFlat) return "Señal plana: sin variación fisiológica";
      if (isSaturated) return "Saturación: ajuste la presión del dedo";
      if (snr < 10) return "Relación señal/ruido insuficiente (SNR < 10dB)";
      if (periodicityScore <= 0.5) return "No hay periodicidad fisiológica (no hay pulso claro)";
      if (cv >= 0.15) return "Intervalos irregulares: ritmo no fisiológico";
      if (hasJump) return "Saltos o artefactos detectados: mantenga el dedo firme";
      if (!physiologicalShape) return "Forma de onda no fisiológica";
      if (!rhythmDetected) return "No se detecta patrón rítmico consistente";
    }
    return "Señal fisiológica detectada";
  }

  private handleUserFeedback(isFingerDetected: boolean, quality: number, rhythmDetected: boolean): void {
    const now = Date.now();
    if (now - this.lastNotificationTime < this.NOTIFICATION_COOLDOWN) {
      return;
    }

    if (!isFingerDetected) {
      if (quality < this.config.minQualityThreshold) {
        toast.warning("Ajuste la posición del dedo sobre la cámara");
      } else if (!rhythmDetected) {
        toast.warning("Mantenga el dedo quieto para detectar el ritmo cardíaco");
      }
      this.lastNotificationTime = now;
    }
  }

  public reset(): void {
    this.signalHistory = [];
    this.kalmanFilter.reset();
    this.bandpassFilter.reset();
    this.validator.resetFingerDetection();
    this.lastNotificationTime = 0;
    this.fingerDetectionWindow = 0;
    this.fingerDetected = false;
    console.log("FingerDetectionService: Reset completed");
  }
}

export const fingerDetectionService = FingerDetectionService.getInstance();
