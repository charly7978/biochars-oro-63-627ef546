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
    const ANALYSIS_BUFFER_SIZE = 120;
    const recentSignals = this.signalHistory.slice(-ANALYSIS_BUFFER_SIZE);
    const amplitude = Math.max(...recentSignals) - Math.min(...recentSignals);
    const mean = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const variance = recentSignals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentSignals.length;
    const stdDev = Math.sqrt(variance);
    // Flatline: desviación muy baja
    const isFlat = stdDev < 0.002;
    // Saturación: valores muy cerca de los extremos
    const isSaturated = recentSignals.filter(v => Math.abs(v) > 0.95).length > recentSignals.length * 0.2;
    // SNR (Signal-to-Noise Ratio)
    const signalPower = mean * mean;
    const noisePower = variance;
    const snr = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 0;
    const snrLow = snr < 5; // 5 dB mínimo
    // Periodicidad: autocorrelación simple
    function autocorr(sig: number[], lag: number) {
      let sum = 0;
      for (let i = 0; i < sig.length - lag; i++) {
        sum += (sig[i] - mean) * (sig[i + lag] - mean);
      }
      return sum / (sig.length - lag);
    }
    let periodicityScore = 0;
    for (let lag = 8; lag <= 45; lag++) { // 40-200 BPM
      const ac = autocorr(recentSignals, lag);
      if (ac > periodicityScore) periodicityScore = ac;
    }
    periodicityScore = Math.max(0, Math.min(1, periodicityScore / (variance || 1)));
    // Ruido: varianza de la derivada
    const diffs = recentSignals.slice(1).map((v, i) => v - recentSignals[i]);
    const noise = Math.sqrt(diffs.reduce((s, v) => s + v * v, 0) / diffs.length);
    const noiseScore = 1 - Math.min(1, noise / 0.05);
    // Amplitud normalizada
    const ampScore = Math.max(0, Math.min(1, (amplitude - 0.01) / 0.2));
    // Estabilidad (1 - coeficiente de variación)
    const stabilityScore = 1 - Math.min(1, stdDev / (mean === 0 ? 1 : Math.abs(mean)));
    // Forma de onda fisiológica: subida más rápida que bajada
    let upTime = 0, downTime = 0;
    for (let i = 1; i < recentSignals.length; i++) {
      if (recentSignals[i] > recentSignals[i-1]) upTime++;
      else if (recentSignals[i] < recentSignals[i-1]) downTime++;
    }
    const upDownRatio = downTime > 0 ? upTime / downTime : 0;
    const physiologicalShape = upDownRatio > 0.7 && upDownRatio < 1.5;
    // Calidad compuesta
    const flatPenalty = isFlat ? 0 : 1;
    const satPenalty = isSaturated ? 0 : 1;
    let quality = (
      0.3 * ampScore +
      0.3 * periodicityScore +
      0.2 * stabilityScore +
      0.2 * noiseScore
    ) * flatPenalty * satPenalty;
    if (typeof (this as any)._lastQuality === 'undefined') (this as any)._lastQuality = quality;
    quality = 0.2 * quality + 0.8 * (this as any)._lastQuality;
    (this as any)._lastQuality = quality;
    quality = Math.round(quality * 100);
    // Detección robusta de dedo (mejorada)
    const isFingerDetected = (
      ampScore > 0.35 &&
      periodicityScore > 0.35 &&
      stabilityScore > 0.35 &&
      !isFlat &&
      !isSaturated &&
      noiseScore > 0.7 &&
      !snrLow &&
      physiologicalShape &&
      this.validator.isFingerDetected()
    );
    // Cooldown tras detección falsa
    if (!isFingerDetected && this.fingerDetectionWindow > 0) {
      if (!this._cooldownStart) this._cooldownStart = Date.now();
      if (Date.now() - this._cooldownStart < 1000) {
        // Mantener ventana en 0 durante cooldown
        this.fingerDetectionWindow = 0;
        this.fingerDetected = false;
        return this._lastResult || {
          isFingerDetected: false,
          quality,
          confidence: 0,
          rhythmDetected: false,
          signalStrength: amplitude,
          lastUpdate: Date.now(),
          feedback: 'Cooldown tras detección falsa'
        };
      } else {
        this._cooldownStart = null;
      }
    }
    // Ventana de confirmación más larga
    if (isFingerDetected) {
      this.fingerDetectionWindow++;
      if (this.fingerDetectionWindow > 75) this.fingerDetected = true;
    } else {
      this.fingerDetectionWindow = 0;
      this.fingerDetected = false;
    }
    // Chequeo de caídas bruscas o saltos grandes
    if (recentSignals.length > 1 && Math.abs(recentSignals[recentSignals.length-2] - recentSignals[recentSignals.length-1]) > 0.3) {
      this.fingerDetectionWindow = 0;
      this.fingerDetected = false;
    }
    // Guardar último resultado
    this._lastResult = {
      isFingerDetected: this.fingerDetected,
      quality,
      confidence: (ampScore * 0.3 + periodicityScore * 0.3 + stabilityScore * 0.2 + noiseScore * 0.2) * flatPenalty * satPenalty,
      rhythmDetected: this.validator.isFingerDetected(),
      signalStrength: amplitude,
      lastUpdate: Date.now(),
      feedback: this.generateFeedback(isFingerDetected, quality, amplitude, this.validator.isFingerDetected(), snr, physiologicalShape)
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

  private generateFeedback(isFingerDetected: boolean, quality: number, signalStrength: number, rhythmDetected: boolean, snr?: number, physiologicalShape?: boolean): string {
    if (!isFingerDetected) {
      if (signalStrength < this.config.minSignalAmplitude) {
        return "Señal muy débil - Asegure que su dedo cubra completamente la cámara";
      }
      if (!rhythmDetected) {
        return "No se detecta ritmo cardíaco - Mantenga el dedo quieto";
      }
      if (quality < this.config.minQualityThreshold) {
        return "Calidad de señal baja - Ajuste la posición del dedo";
      }
      if (snr !== undefined && snr < 5) {
        return "Relación señal/ruido baja - Evite movimiento y luz ambiental excesiva";
      }
      if (physiologicalShape === false) {
        return "Forma de onda no fisiológica - Ajuste el dedo para mejor contacto";
      }
    }
    return "Señal OK";
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
