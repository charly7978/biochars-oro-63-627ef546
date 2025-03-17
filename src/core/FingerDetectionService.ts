
import { ProcessedSignal } from '../types/signal';

/**
 * Servicio unificado para la detección de dedo
 * Consolida la lógica que estaba duplicada en varios archivos
 */
export class FingerDetectionService {
  // Configuración optimizada
  private readonly CONFIG = {
    MIN_RED_THRESHOLD: 85,
    MAX_RED_THRESHOLD: 245, 
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 3,
    REQUIRED_FINGER_FRAMES: 12,
    QUALITY_THRESHOLD: 50,
    MIN_AMPLITUDE_THRESHOLD: 1.5,
    MIN_DERIVATIVE_THRESHOLD: 0.5,
    MAX_NOISE_RATIO: 0.2,
    STABILITY_TIMEOUT_MS: 4000
  };

  // Historial para análisis robusto
  private qualityHistory: number[] = [];
  private detectionHistory: boolean[] = [];
  private signalAmplitudeHistory: number[] = [];
  private derivativeBuffer: number[] = [];
  private noiseBuffer: number[] = [];
  
  // Estado de detección
  private detectionStabilityCounter: number = 0;
  private consecutiveFingerFrames: number = 0;
  private lastStableDetectionTime: number = 0;
  private lastValue: number | null = null;
  
  // Variables adaptativas
  private detectionThreshold: number = 0.45;
  private adaptiveCounter: number = 0;
  private signalLockCounter: number = 0;
  private consecutiveNonDetection: number = 0;
  
  private readonly HISTORY_SIZE = 20;
  private readonly MAX_SIGNAL_LOCK = 4;
  private readonly RELEASE_GRACE_PERIOD = 3;
  private readonly ADAPTIVE_ADJUSTMENT_INTERVAL = 40;
  private readonly MIN_DETECTION_THRESHOLD = 0.30;

  constructor() {
    this.reset();
  }

  /**
   * Método unificado para procesar una señal y determinar si hay un dedo presente
   */
  public processSignal(signal: ProcessedSignal): ProcessedSignal {
    // Actualizar buffers y contadores
    this.updateBuffers(signal);
    
    // Actualizar estabilidad de detección
    this.updateStabilityCounters(signal);
    
    // Análisis adaptativo para mejorar detección
    this.updateAdaptiveThreshold();
    
    // Determinar detección final basada en criterios completos
    const isFingerDetected = this.determineFingerPresence();
    
    // Calcular calidad mejorada
    const enhancedQuality = this.calculateEnhancedQuality(isFingerDetected);
    
    return {
      ...signal,
      fingerDetected: isFingerDetected,
      quality: enhancedQuality
    };
  }
  
  /**
   * Actualiza directamente la calidad de la señal
   * Método agregado para componentes externos
   */
  public updateQuality(quality: number): void {
    if (quality > 5) {
      this.qualityHistory.push(quality);
    } else {
      this.qualityHistory.push(Math.max(0, quality * 0.75));
    }
    
    if (this.qualityHistory.length > this.HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
  }
  
  /**
   * Establece directamente el estado de detección
   * Método agregado para componentes externos
   */
  public setDetected(isDetected: boolean): void {
    this.detectionHistory.push(isDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
  }

  /**
   * Actualiza los buffers históricos para análisis
   */
  private updateBuffers(signal: ProcessedSignal): void {
    // Actualizar historial de calidad
    if (signal.fingerDetected && signal.quality > 5) {
      this.qualityHistory.push(signal.quality);
    } else {
      this.qualityHistory.push(Math.max(0, signal.quality * 0.75));
    }
    
    if (this.qualityHistory.length > this.HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Actualizar detección
    this.detectionHistory.push(signal.fingerDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    // Actualizar buffer de derivada
    if (this.lastValue !== null) {
      const derivative = Math.abs(signal.filteredValue - this.lastValue);
      this.derivativeBuffer.push(derivative);
      if (this.derivativeBuffer.length > this.HISTORY_SIZE) {
        this.derivativeBuffer.shift();
      }
    }
    this.lastValue = signal.filteredValue;
    
    // Actualizar amplitud y ruido
    if (signal.rawValue > 0) {
      // Amplitud para detección de señal válida
      this.signalAmplitudeHistory.push(signal.perfusionIndex || 0.01);
      if (this.signalAmplitudeHistory.length > this.HISTORY_SIZE) {
        this.signalAmplitudeHistory.shift();
      }
      
      // Buffer de ruido para análisis de calidad
      this.noiseBuffer.push(signal.rawValue);
      if (this.noiseBuffer.length > this.HISTORY_SIZE) {
        this.noiseBuffer.shift();
      }
    }
  }

  /**
   * Actualiza contadores de estabilidad para detección robusta
   */
  private updateStabilityCounters(signal: ProcessedSignal): void {
    const now = Date.now();
    
    // Reset de estabilidad tras timeout
    if (now - this.lastStableDetectionTime > this.CONFIG.STABILITY_TIMEOUT_MS) {
      this.detectionStabilityCounter = 0;
      this.consecutiveFingerFrames = 0;
    }
    
    if (signal.fingerDetected) {
      if (signal.quality > 55) {
        this.consecutiveFingerFrames++;
        this.detectionStabilityCounter = Math.min(10, this.detectionStabilityCounter + 0.5);
        
        if (this.detectionStabilityCounter >= this.CONFIG.MIN_STABILITY_COUNT) {
          this.lastStableDetectionTime = now;
        }
      } else {
        this.consecutiveFingerFrames = Math.max(0, this.consecutiveFingerFrames - 0.3);
        this.detectionStabilityCounter = Math.max(0, this.detectionStabilityCounter - 0.7);
      }
      
      // Actualizar lock-in para estabilidad
      this.consecutiveNonDetection = 0;
      this.signalLockCounter = Math.min(this.MAX_SIGNAL_LOCK, this.signalLockCounter + 1);
    } else {
      this.consecutiveFingerFrames = Math.max(0, this.consecutiveFingerFrames - 1.5);
      this.detectionStabilityCounter = Math.max(0, this.detectionStabilityCounter - 1.2);
      
      // Logica de lock-out gradual
      if (this.signalLockCounter >= this.MAX_SIGNAL_LOCK) {
        this.consecutiveNonDetection++;
        
        if (this.consecutiveNonDetection > this.RELEASE_GRACE_PERIOD) {
          this.signalLockCounter = Math.max(0, this.signalLockCounter - 1);
        }
      } else {
        this.signalLockCounter = Math.max(0, this.signalLockCounter - 1);
      }
    }
  }

  /**
   * Actualiza el umbral adaptativo para mejorar detección
   */
  private updateAdaptiveThreshold(): void {
    this.adaptiveCounter++;
    if (this.adaptiveCounter >= this.ADAPTIVE_ADJUSTMENT_INTERVAL) {
      this.adaptiveCounter = 0;
      
      // Calcular ratio de detección para adaptación
      const rawDetectionRatio = this.detectionHistory.filter(d => d).length / 
                              Math.max(1, this.detectionHistory.length);
      
      const consistentDetection = rawDetectionRatio > 0.8;
      const consistentNonDetection = rawDetectionRatio < 0.2;
      
      const avgQuality = this.calculateAverageQuality();
      
      if (consistentNonDetection) {
        // Hacer más fácil la detección
        this.detectionThreshold = Math.max(
          this.MIN_DETECTION_THRESHOLD,
          this.detectionThreshold - 0.08
        );
      } else if (consistentDetection && avgQuality < 35) {
        // Ser más estrictos con detección pero baja calidad
        this.detectionThreshold = Math.min(
          0.6,
          this.detectionThreshold + 0.05
        );
      }
    }
  }

  /**
   * Determina la presencia del dedo usando criterios consolidados
   */
  private determineFingerPresence(): boolean {
    const avgQuality = this.calculateAverageQuality();
    
    // Criterios centrales de detección
    const hasStableDetection = this.detectionStabilityCounter >= this.CONFIG.MIN_STABILITY_COUNT;
    const hasMinimumQuality = avgQuality > 35;
    const hasRequiredFrames = this.consecutiveFingerFrames >= this.CONFIG.REQUIRED_FINGER_FRAMES;
    
    // Verificación de variabilidad de señal
    let hasSignalVariability = false;
    if (this.derivativeBuffer.length > 10) {
      const maxDerivative = Math.max(...this.derivativeBuffer);
      hasSignalVariability = maxDerivative > this.CONFIG.MIN_DERIVATIVE_THRESHOLD;
    }
    
    // Verificación de amplitud suficiente
    let hasSufficientAmplitude = false;
    if (this.signalAmplitudeHistory.length > 10) {
      const avgAmplitude = this.signalAmplitudeHistory.reduce((sum, a) => sum + a, 0) / 
                         this.signalAmplitudeHistory.length;
      hasSufficientAmplitude = avgAmplitude > this.CONFIG.MIN_AMPLITUDE_THRESHOLD;
    }
    
    // Usar lock-in para estabilidad
    const isLockedIn = this.signalLockCounter >= this.MAX_SIGNAL_LOCK - 1;
    
    // Determinar detección combinando todos los criterios
    const rawDetectionRatio = this.detectionHistory.filter(d => d).length / 
                            Math.max(1, this.detectionHistory.length);
                            
    return isLockedIn || 
           (hasStableDetection && hasMinimumQuality && hasRequiredFrames && 
           (hasSignalVariability || hasSufficientAmplitude)) ||
           rawDetectionRatio >= this.detectionThreshold;
  }

  /**
   * Calcula la calidad ponderada y mejorada
   */
  private calculateAverageQuality(): number {
    if (this.qualityHistory.length === 0) return 0;
    
    // Cálculo ponderado con más peso a valores recientes
    let weightedSum = 0;
    let weightSum = 0;
    
    this.qualityHistory.forEach((q, index) => {
      const weight = Math.pow(1.3, index);
      weightedSum += q * weight;
      weightSum += weight;
    });
    
    let avgQuality = weightSum > 0 ? weightedSum / weightSum : 0;
    
    // Ajustar por amplitud
    if (this.signalAmplitudeHistory.length > 10) {
      const avgAmplitude = this.signalAmplitudeHistory.reduce((sum, amp) => sum + amp, 0) / 
                         this.signalAmplitudeHistory.length;
      
      if (avgAmplitude < this.CONFIG.MIN_AMPLITUDE_THRESHOLD) {
        avgQuality = Math.max(0, avgQuality * 0.4);
      }
    }
    
    // Ajustar por nivel de ruido
    if (this.noiseBuffer.length > 10) {
      const noiseLevel = this.calculateNoiseLevel();
      if (noiseLevel > this.CONFIG.MAX_NOISE_RATIO) {
        avgQuality = Math.max(0, avgQuality * 0.5);
      }
    }
    
    // Ajustar por derivada (cambio)
    if (this.derivativeBuffer.length > 10) {
      const avgDerivative = this.derivativeBuffer.reduce((sum, d) => sum + d, 0) / 
                           this.derivativeBuffer.length;
      
      if (avgDerivative < this.CONFIG.MIN_DERIVATIVE_THRESHOLD) {
        avgQuality = Math.max(0, avgQuality * 0.6);
      }
    }
    
    return avgQuality;
  }

  /**
   * Calcula calidad ajustada para experiencia de usuario
   */
  private calculateEnhancedQuality(isFingerDetected: boolean): number {
    const avgQuality = this.calculateAverageQuality();
    const enhancementFactor = isFingerDetected ? 1.08 : 1.0;
    return Math.min(100, avgQuality * enhancementFactor);
  }

  /**
   * Calcula nivel de ruido normalizado
   */
  private calculateNoiseLevel(): number {
    if (this.noiseBuffer.length < 3) return 0;
    
    const mean = this.noiseBuffer.reduce((sum, val) => sum + val, 0) / this.noiseBuffer.length;
    const variance = this.noiseBuffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.noiseBuffer.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / (Math.abs(mean) + 0.001);
  }

  /**
   * Reinicia todos los contadores y buffers
   */
  public reset(): void {
    this.qualityHistory = [];
    this.detectionHistory = [];
    this.signalAmplitudeHistory = [];
    this.derivativeBuffer = [];
    this.noiseBuffer = [];
    this.detectionStabilityCounter = 0;
    this.consecutiveFingerFrames = 0;
    this.lastStableDetectionTime = 0;
    this.lastValue = null;
    this.detectionThreshold = 0.45;
    this.adaptiveCounter = 0;
    this.signalLockCounter = 0;
    this.consecutiveNonDetection = 0;
  }
}

// Instancia singleton para uso global
export const fingerDetectionService = new FingerDetectionService();
