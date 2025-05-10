
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

    // Calculate metrics
    const signalStrength = Math.abs(filteredValue);
    const rhythmDetected = this.validator.isFingerDetected();
    const quality = this.calculateSignalQuality();
    
    // Determine finger presence
    const isFingerDetected = this.determineFingerPresence(signalStrength, rhythmDetected, quality);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(signalStrength, rhythmDetected, quality);

    // Generate feedback
    const feedback = this.generateFeedback(isFingerDetected, quality, signalStrength, rhythmDetected);
    
    // Show user feedback if needed
    this.handleUserFeedback(isFingerDetected, quality, rhythmDetected);

    return {
      isFingerDetected,
      quality,
      confidence,
      rhythmDetected,
      signalStrength,
      lastUpdate: Date.now(),
      feedback
    };
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

  private generateFeedback(isFingerDetected: boolean, quality: number, signalStrength: number, rhythmDetected: boolean): string {
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
    console.log("FingerDetectionService: Reset completed");
  }
}

export const fingerDetectionService = FingerDetectionService.getInstance();
