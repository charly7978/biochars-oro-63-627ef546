
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
  private readonly HISTORY_SIZE = 120; // 4 seconds at 30fps for better robustness
  private lastNotificationTime = 0;
  private readonly NOTIFICATION_COOLDOWN = 5000; // 5 seconds to avoid spamming
  
  private config: FingerDetectionConfig = {
    minSignalAmplitude: 0.02, // Slightly increased for more strictness
    minQualityThreshold: 45,  // Increased threshold for quality
    maxWeakSignalsCount: 3,
    rhythmPatternWindow: 4000,
    minConsistentPatterns: 5
  };

  private fingerDetectionWindow = 0;
  private fingerDetected = false;
  // Properties for cooldown and last result
  private _cooldownStart: number | null = null;
  private _lastResult: FingerDetectionResult | null = null;

  private constructor() {
    this.validator = new SignalValidator(0.02, 10);
    this.kalmanFilter = new KalmanFilter();
    this.bandpassFilter = new BandpassFilter(0.5, 4, 30);
    console.log("FingerDetectionService: Initialized with enhanced config");
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

    // Verify buffer length for robust analysis
    const ANALYSIS_BUFFER_SIZE = 120; // 4 seconds at 30Hz
    const recentSignals = this.signalHistory.slice(-ANALYSIS_BUFFER_SIZE);
    const amplitude = Math.max(...recentSignals) - Math.min(...recentSignals);
    const mean = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const variance = recentSignals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentSignals.length;
    const stdDev = Math.sqrt(variance);
    const isFlat = stdDev < 0.0015;
    const isSaturated = recentSignals.filter(v => Math.abs(v) > 0.92).length > recentSignals.length * 0.15;
    const signalPower = mean * mean;
    const noisePower = variance;
    const snr = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 0;
    const snrLow = snr < 12; // Raised minimum SNR
    
    // Detect physiological peaks
    const peaks = [];
    for (let i = 2; i < recentSignals.length - 2; i++) {
      if (
        recentSignals[i] > recentSignals[i - 1] && recentSignals[i] > recentSignals[i - 2] &&
        recentSignals[i] > recentSignals[i + 1] && recentSignals[i] > recentSignals[i + 2] &&
        recentSignals[i] - mean > 0.015 // higher amplitude minimum
      ) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > 8) {
          peaks.push(i);
        }
      }
    }
    
    // Peak intervals
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    const validIntervals = intervals.filter(iv => iv >= 8 && iv <= 45);
    let cv = 1;
    if (validIntervals.length >= 2) {
      const avgIv = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
      const varIv = validIntervals.reduce((a, b) => a + Math.pow(b - avgIv, 2), 0) / validIntervals.length;
      cv = Math.sqrt(varIv) / avgIv;
    }

    // Periodicity using autocorrelation
    function autocorr(sig, lag) {
      let sum = 0;
      for (let i = 0; i < sig.length - lag; i++) {
        sum += (sig[i] - mean) * (sig[i + lag] - mean);
      }
      return sum / (sig.length - lag);
    }
    let periodicityScore = 0;
    for (let lag = 10; lag <= 40; lag++) {
      const ac = autocorr(recentSignals, lag);
      if (ac > periodicityScore) periodicityScore = ac;
    }
    periodicityScore = Math.max(0, Math.min(1, periodicityScore / (variance || 1)));

    // Shape analysis: up/down timing ratio
    let upTime = 0, downTime = 0;
    for (let i = 1; i < recentSignals.length; i++) {
      if (recentSignals[i] > recentSignals[i-1]) upTime++;
      else if (recentSignals[i] < recentSignals[i-1]) downTime++;
    }
    const upDownRatio = downTime > 0 ? upTime / downTime : 0;
    const physiologicalShape = upDownRatio > 0.95 && upDownRatio < 1.05;

    // Check sudden jumps
    let hasJump = false;
    for (let i = 1; i < recentSignals.length; i++) {
      if (Math.abs(recentSignals[i] - recentSignals[i-1]) > 0.18) { // stricter limit
        hasJump = true;
        break;
      }
    }

    // Combine strict physiological criteria
    const allCriteria = (
      amplitude > 0.025 &&
      !isFlat &&
      !isSaturated &&
      !snrLow &&
      periodicityScore > 0.55 &&
      validIntervals.length >= 4 &&
      cv < 0.14 &&
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
    
    // Build feedback and confidence
    const confidence = this.calculateConfidence(amplitude, this.fingerDetected, periodicityScore, snr, cv, !hasJump, physiologicalShape);

    this._lastResult = {
      isFingerDetected: this.fingerDetected,
      quality: Math.round(periodicityScore * 100),
      confidence: confidence,
      rhythmDetected: this.validator.isFingerDetected(),
      signalStrength: amplitude,
      lastUpdate: Date.now(),
      feedback: this.generateFeedback(allCriteria, amplitude, isFlat, isSaturated, snr, cv, hasJump, physiologicalShape)
    };
    
    return this._lastResult;
  }

  private calculateConfidence(amplitude: number, fingerDetected: boolean, periodicity: number, snr: number, cv: number, noJump: boolean, shape: boolean): number {
    const amplitudeScore = Math.min(1, amplitude / (this.config.minSignalAmplitude * 3));
    const periodicityScore = periodicity;
    const snrScore = snr > 15 ? 1 : snr / 15;
    const cvScore = 1 - cv;
    const jumpScore = noJump ? 1 : 0;
    const shapeScore = shape ? 1 : 0;

    const combined = 0.3 * amplitudeScore + 0.3 * periodicityScore + 0.2 * snrScore + 0.1 * cvScore + 0.1 * jumpScore + 0.1 * shapeScore;
    return Math.min(1, combined);
  }

  private generateFeedback(allCriteria: boolean, amplitude: number, isFlat: boolean, isSaturated: boolean, snr: number, cv: number, hasJump: boolean, shape: boolean): string {
    if (!allCriteria) {
      if (amplitude < 0.025) return "Amplitud insuficiente: asegure el dedo correctamente";
      if (isFlat) return "Señal plana detectada: ajuste la presión del dedo";
      if (isSaturated) return "Saturación detectada: ajuste la presión del dedo";
      if (snr < 12) return "Relación señal/ruido insuficiente (SNR < 12dB)";
      if (cv >= 0.14) return "Variabilidad irregular en señal";
      if (hasJump) return "Saltos bruscos detectados: mantenga el dedo quieto";
      if (!shape) return "Forma de onda no fisiológica";
      if (!this.validator.isFingerDetected()) return "No se detecta patrón fisiológico";
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
        toast.warning("Por favor, ajuste la posición del dedo sobre la cámara.");
      } else if (!rhythmDetected) {
        toast.warning("Mantenga el dedo quieto para detectar el ritmo cardíaco.");
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

