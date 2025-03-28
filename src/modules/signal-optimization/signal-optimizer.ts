
/**
 * Optimizador central de señal
 * Gestiona los canales especializados para cada signo vital
 * Implementando algoritmos de vanguardia para optimización específica por canal
 */

import { ProcessedPPGSignal } from '../signal-processing/types';
import { 
  SignalOptimizer, 
  VitalSignChannel, 
  OptimizedSignal, 
  FeedbackData, 
  ChannelOptimizer,
  ChannelOptimizerConfig
} from './types';

import { HeartRateOptimizer } from './channels/heart-rate-optimizer';
import { SPO2Optimizer } from './channels/spo2-optimizer';
import { BloodPressureOptimizer } from './channels/blood-pressure-optimizer';
import { GlucoseOptimizer } from './channels/glucose-optimizer';
import { CholesterolOptimizer } from './channels/cholesterol-optimizer';
import { TriglyceridesOptimizer } from './channels/triglycerides-optimizer';

/**
 * Implementación del optimizador central de señal
 * Divide la señal en canales especializados para cada signo vital
 * con algoritmos de vanguardia específicos para cada canal
 */
export class SignalOptimizerImpl implements SignalOptimizer {
  private optimizers: Map<VitalSignChannel, ChannelOptimizer> = new Map();
  private lastOptimized: Record<VitalSignChannel, OptimizedSignal | null> = {
    heartRate: null,
    spo2: null,
    bloodPressure: null,
    glucose: null,
    cholesterol: null,
    triglycerides: null
  };
  
  // Sistema avanzado de adaptación y mejora continua
  private adaptiveEngine: AdaptiveOptimizationEngine;
  private signalQualityTracker: SignalQualityTrackingSystem;
  private feedbackManager: OptimizationFeedbackManager;

  constructor() {
    // Inicializar optimizadores de canal con algoritmos avanzados
    this.optimizers.set('heartRate', new HeartRateOptimizer());
    this.optimizers.set('spo2', new SPO2Optimizer());
    this.optimizers.set('bloodPressure', new BloodPressureOptimizer());
    this.optimizers.set('glucose', new GlucoseOptimizer());
    this.optimizers.set('cholesterol', new CholesterolOptimizer());
    this.optimizers.set('triglycerides', new TriglyceridesOptimizer());
    
    // Inicializar sistemas avanzados de adaptación y mejora
    this.adaptiveEngine = new AdaptiveOptimizationEngine();
    this.signalQualityTracker = new SignalQualityTrackingSystem();
    this.feedbackManager = new OptimizationFeedbackManager();

    console.log("SignalOptimizer: Inicializado con 6 canales especializados y sistemas adaptativos avanzados");
  }

  /**
   * Optimiza la señal para todos los canales activos
   * Implementando algoritmos específicos para cada tipo de señal
   */
  public optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal> {
    const result: Record<VitalSignChannel, OptimizedSignal> = {} as Record<VitalSignChannel, OptimizedSignal>;
    
    // Registrar señal en sistema de calidad para análisis avanzado
    this.signalQualityTracker.trackSignal(signal);
    
    // Obtener perfil de calidad para adaptación inteligente
    const qualityProfile = this.signalQualityTracker.getQualityProfile();
    
    // Actualizar motor adaptativo con nuevos datos
    this.adaptiveEngine.update(signal, qualityProfile);

    // Procesar la señal en cada optimizador de canal con adaptación específica
    for (const [channel, optimizer] of this.optimizers.entries()) {
      try {
        // Obtener ajustes adaptativos para este canal específico
        const adaptiveSettings = this.adaptiveEngine.getAdaptiveSettings(channel, signal);
        
        // Aplicar ajustes adaptativos al optimizador antes de procesar
        if (adaptiveSettings) {
          optimizer.updateAdaptiveSettings(adaptiveSettings);
        }
        
        // Obtener sugerencias de feedback para este canal
        const feedbackSuggestions = this.feedbackManager.getSuggestions(channel);
        if (feedbackSuggestions) {
          optimizer.applyFeedbackSuggestions(feedbackSuggestions);
        }
        
        // Optimizar señal con todos los ajustes aplicados
        const optimized = optimizer.optimize(signal);
        result[channel] = optimized;
        this.lastOptimized[channel] = optimized;
        
        // Registrar resultado para análisis posterior
        this.signalQualityTracker.trackOptimizedResult(channel, optimized);
        this.adaptiveEngine.registerResult(channel, optimized);
      } catch (error) {
        console.error(`Error optimizando canal ${channel}:`, error);
        
        // En caso de error, usar el último valor optimizado si existe
        if (this.lastOptimized[channel]) {
          result[channel] = this.lastOptimized[channel]!;
        }
      }
    }

    return result;
  }

  /**
   * Procesa retroalimentación del módulo de cálculo
   * Permite ajustes finos en los optimizadores con algoritmos adaptativos
   */
  public processFeedback(feedback: FeedbackData): void {
    // Registrar feedback en el gestor avanzado
    this.feedbackManager.registerFeedback(feedback);
    
    // Obtener optimizador específico
    const optimizer = this.optimizers.get(feedback.channel);
    
    if (optimizer) {
      // Procesar feedback directo en el optimizador
      optimizer.processFeedback(feedback);
      
      // Adaptar motor adaptativo en base al feedback
      this.adaptiveEngine.adaptFromFeedback(feedback);
      
      console.log(`Feedback avanzado aplicado al canal ${feedback.channel}`, feedback.suggestedAdjustments);
    }
  }

  /**
   * Obtiene un optimizador específico por canal
   */
  public getOptimizer(channel: VitalSignChannel): ChannelOptimizer | null {
    return this.optimizers.get(channel) || null;
  }

  /**
   * Configura un canal específico
   */
  public setChannelConfig(config: ChannelOptimizerConfig): void {
    const optimizer = this.optimizers.get(config.channel);
    
    if (optimizer) {
      optimizer.setParameters(config.parameters);
      
      // Registrar nueva configuración en sistemas adaptativos
      this.adaptiveEngine.registerConfig(config);
      this.feedbackManager.registerConfig(config);
    }
  }

  /**
   * Reinicia todos los optimizadores y sistemas adaptativos
   */
  public reset(): void {
    // Reiniciar optimizadores de canal
    for (const optimizer of this.optimizers.values()) {
      optimizer.reset();
    }
    
    // Reiniciar sistemas adaptativos
    this.adaptiveEngine.reset();
    this.signalQualityTracker.reset();
    this.feedbackManager.reset();
    
    this.lastOptimized = {
      heartRate: null,
      spo2: null,
      bloodPressure: null,
      glucose: null,
      cholesterol: null,
      triglycerides: null
    };
    
    console.log("SignalOptimizer: Reset completo de todos los sistemas de optimización");
  }
}

// ===== SISTEMAS AVANZADOS DE OPTIMIZACIÓN =====

/**
 * Motor de optimización adaptativa avanzado
 * Ajusta parámetros de optimización en tiempo real según las características de la señal
 */
class AdaptiveOptimizationEngine {
  private signalHistory: ProcessedPPGSignal[] = [];
  private readonly HISTORY_SIZE = 100;
  private channelSettings: Map<VitalSignChannel, any> = new Map();
  private channelResults: Map<VitalSignChannel, OptimizedSignal[]> = new Map();
  private readonly RESULT_HISTORY_SIZE = 30;
  
  constructor() {
    // Inicializar mapas de resultados para cada canal
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.channelResults.set(channel, []);
    }
  }
  
  /**
   * Actualiza el motor con nuevos datos de señal
   */
  public update(signal: ProcessedPPGSignal, qualityProfile: any): void {
    // Actualizar historial de señales
    this.signalHistory.push(signal);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }
    
    // Análisis avanzado de tendencias para cada canal
    for (const channel of this.channelResults.keys()) {
      this.analyzeChannelTrends(channel);
    }
  }
  
  /**
   * Obtiene ajustes adaptativos para un canal específico
   */
  public getAdaptiveSettings(channel: VitalSignChannel, signal: ProcessedPPGSignal): any {
    if (this.signalHistory.length < 10) {
      return null;
    }
    
    // Crear ajustes adaptativos basados en las características de la señal
    const settings: any = {};
    
    // Análisis de características de la señal actual
    const signalStrength = signal.signalStrength;
    const hasFingerContact = signal.fingerDetected;
    const signalQuality = signal.quality / 100; // Normalizar a 0-1
    
    // Ajustes específicos por canal
    switch (channel) {
      case 'heartRate':
        settings.amplificationFactor = this.calculateHeartRateAmplification(signalQuality);
        settings.peakEnhancement = hasFingerContact ? 1.2 : 0.8;
        settings.adaptiveThreshold = true;
        break;
        
      case 'spo2':
        settings.redSignalBoost = signalQuality < 0.6 ? 1.3 : 1.0;
        settings.noiseReduction = signalQuality < 0.5 ? 1.5 : 1.0;
        settings.baselineCorrectionStrength = 0.8 + (0.2 * (1 - signalQuality));
        break;
        
      case 'bloodPressure':
        settings.waveformSensitivity = 0.7 + (0.3 * signalQuality);
        settings.pulseTransitAdjustment = hasFingerContact ? 1.0 : 0.5;
        break;
        
      case 'glucose':
      case 'cholesterol':
      case 'triglycerides':
        settings.spectralFilterStrength = 0.5 + (0.5 * signalQuality);
        settings.temporalSmoothing = signalQuality < 0.7 ? 0.8 : 0.5;
        break;
    }
    
    return settings;
  }
  
  /**
   * Registra un resultado optimizado para análisis
   */
  public registerResult(channel: VitalSignChannel, result: OptimizedSignal): void {
    const results = this.channelResults.get(channel) || [];
    results.push(result);
    
    if (results.length > this.RESULT_HISTORY_SIZE) {
      results.shift();
    }
    
    this.channelResults.set(channel, results);
  }
  
  /**
   * Registra una nueva configuración de canal
   */
  public registerConfig(config: ChannelOptimizerConfig): void {
    this.channelSettings.set(config.channel, { ...config.parameters });
  }
  
  /**
   * Adapta parámetros en base a feedback recibido
   */
  public adaptFromFeedback(feedback: FeedbackData): void {
    const channel = feedback.channel;
    const currentSettings = this.channelSettings.get(channel) || {};
    
    // Adaptar configuración basada en feedback
    if (feedback.suggestedAdjustments) {
      const newSettings = { ...currentSettings, ...feedback.suggestedAdjustments };
      this.channelSettings.set(channel, newSettings);
    }
  }
  
  /**
   * Calcula factor de amplificación adaptativo para ritmo cardíaco
   */
  private calculateHeartRateAmplification(signalQuality: number): number {
    // Adaptar amplificación según calidad
    if (signalQuality > 0.8) {
      return 1.0; // Señal excelente, no requiere amplificación
    } else if (signalQuality > 0.6) {
      return 1.2; // Señal buena, amplificación ligera
    } else if (signalQuality > 0.4) {
      return 1.5; // Señal regular, amplificación moderada
    } else {
      return 2.0; // Señal débil, amplificación fuerte
    }
  }
  
  /**
   * Analiza tendencias en los resultados de un canal
   */
  private analyzeChannelTrends(channel: VitalSignChannel): void {
    const results = this.channelResults.get(channel);
    if (!results || results.length < 10) return;
    
    // Análisis de tendencias (implementación básica)
    const recentResults = results.slice(-10);
    const qualities = recentResults.map(r => r.quality);
    const avgQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    
    // Actualizar configuración basada en tendencias
    const currentSettings = this.channelSettings.get(channel) || {};
    
    // Ejemplo: ajustar sensibilidad según tendencia de calidad
    if (avgQuality < 30) {
      currentSettings.sensitivityFactor = Math.min(1.5, currentSettings.sensitivityFactor || 1.0 + 0.1);
    } else if (avgQuality > 70) {
      currentSettings.sensitivityFactor = Math.max(0.8, currentSettings.sensitivityFactor || 1.0 - 0.05);
    }
    
    this.channelSettings.set(channel, currentSettings);
  }
  
  /**
   * Reinicia el motor adaptativo
   */
  public reset(): void {
    this.signalHistory = [];
    this.channelSettings = new Map();
    
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.channelResults.set(channel, []);
    }
  }
}

/**
 * Sistema avanzado de seguimiento de calidad de señal
 * Analiza características de calidad específicas para cada tipo de señal
 */
class SignalQualityTrackingSystem {
  private signals: ProcessedPPGSignal[] = [];
  private readonly SIGNAL_HISTORY_SIZE = 150;
  private channelQuality: Map<VitalSignChannel, number[]> = new Map();
  private readonly QUALITY_HISTORY_SIZE = 50;
  
  constructor() {
    // Inicializar historiales de calidad para cada canal
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.channelQuality.set(channel, []);
    }
  }
  
  /**
   * Registra una nueva señal para análisis
   */
  public trackSignal(signal: ProcessedPPGSignal): void {
    this.signals.push(signal);
    if (this.signals.length > this.SIGNAL_HISTORY_SIZE) {
      this.signals.shift();
    }
  }
  
  /**
   * Registra un resultado optimizado para análisis de calidad
   */
  public trackOptimizedResult(channel: VitalSignChannel, result: OptimizedSignal): void {
    const qualities = this.channelQuality.get(channel) || [];
    qualities.push(result.quality);
    
    if (qualities.length > this.QUALITY_HISTORY_SIZE) {
      qualities.shift();
    }
    
    this.channelQuality.set(channel, qualities);
  }
  
  /**
   * Obtiene perfil de calidad de señal basado en análisis avanzado
   */
  public getQualityProfile(): any {
    if (this.signals.length < 30) {
      return {
        overall: 0.5,
        stability: 0.5,
        noise: 0.5,
        channelSpecific: {}
      };
    }
    
    // Análisis de los últimos 30 segundos de señal
    const recentSignals = this.signals.slice(-30);
    
    // Calcular estabilidad de la señal
    const amplitudes = recentSignals.map(s => s.amplifiedValue);
    const mean = amplitudes.reduce((sum, a) => sum + a, 0) / amplitudes.length;
    const variance = amplitudes.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amplitudes.length;
    const stability = Math.max(0, 1 - Math.min(1, Math.sqrt(variance) / mean));
    
    // Estimar nivel de ruido
    const filteredValues = recentSignals.map(s => s.filteredValue);
    const diffSum = filteredValues.slice(1).reduce(
      (sum, val, i) => sum + Math.abs(val - filteredValues[i]), 0
    );
    const noiseLevel = Math.max(0, 1 - Math.min(1, diffSum / filteredValues.length / mean));
    
    // Calidad específica por canal
    const channelSpecific: Record<string, number> = {};
    
    for (const [channel, qualities] of this.channelQuality.entries()) {
      if (qualities.length > 0) {
        const avgQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
        channelSpecific[channel] = avgQuality / 100; // Normalizar a 0-1
      } else {
        channelSpecific[channel] = 0.5; // Valor por defecto
      }
    }
    
    // Calidad global
    const overall = (stability * 0.4) + (noiseLevel * 0.4) + 
                    (Object.values(channelSpecific).reduce((sum, q) => sum + q, 0) / 
                     Math.max(1, Object.values(channelSpecific).length) * 0.2);
    
    return {
      overall,
      stability,
      noise: noiseLevel,
      channelSpecific
    };
  }
  
  /**
   * Reinicia el sistema de seguimiento
   */
  public reset(): void {
    this.signals = [];
    
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.channelQuality.set(channel, []);
    }
  }
}

/**
 * Gestor avanzado de feedback para optimización
 * Analiza y procesa feedback para mejorar optimizadores
 */
class OptimizationFeedbackManager {
  private feedbackHistory: Map<VitalSignChannel, FeedbackData[]> = new Map();
  private readonly FEEDBACK_HISTORY_SIZE = 20;
  private channelConfigs: Map<VitalSignChannel, any> = new Map();
  
  constructor() {
    // Inicializar historiales de feedback para cada canal
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.feedbackHistory.set(channel, []);
    }
  }
  
  /**
   * Registra nuevo feedback para análisis
   */
  public registerFeedback(feedback: FeedbackData): void {
    const history = this.feedbackHistory.get(feedback.channel) || [];
    history.push(feedback);
    
    if (history.length > this.FEEDBACK_HISTORY_SIZE) {
      history.shift();
    }
    
    this.feedbackHistory.set(feedback.channel, history);
    
    // Análisis inmediato para ajustes rápidos
    this.analyzeChannelFeedback(feedback.channel);
  }
  
  /**
   * Registra nueva configuración de canal
   */
  public registerConfig(config: ChannelOptimizerConfig): void {
    this.channelConfigs.set(config.channel, { ...config.parameters });
  }
  
  /**
   * Obtiene sugerencias de optimización basadas en feedback
   */
  public getSuggestions(channel: VitalSignChannel): any {
    const history = this.feedbackHistory.get(channel);
    if (!history || history.length < 3) return null;
    
    // Analizar últimos 3 feedbacks
    const recentFeedback = history.slice(-3);
    const avgConfidence = recentFeedback.reduce((sum, f) => sum + f.confidence, 0) / recentFeedback.length;
    
    // Extraer ajustes sugeridos
    const suggestions: any = {};
    const currentConfig = this.channelConfigs.get(channel) || {};
    
    // Si hay baja confianza, reforzar sugerencias
    const confidenceFactor = avgConfidence < 0.5 ? 1.5 : 1.0;
    
    // Combinar sugerencias con pesos según confianza
    recentFeedback.forEach((feedback, index) => {
      const weight = (index + 1) / recentFeedback.length * confidenceFactor;
      
      if (feedback.suggestedAdjustments) {
        Object.entries(feedback.suggestedAdjustments).forEach(([key, value]) => {
          if (suggestions[key] === undefined) {
            suggestions[key] = value * weight;
          } else {
            suggestions[key] += value * weight;
          }
        });
      }
    });
    
    // Normalizar sugerencias
    Object.keys(suggestions).forEach(key => {
      suggestions[key] = suggestions[key] / recentFeedback.length;
      
      // Limitar cambios extremos
      const currentValue = currentConfig[key] || 0;
      const maxChange = Math.abs(currentValue) * 0.3; // Máx 30% de cambio
      
      if (suggestions[key] > currentValue + maxChange) {
        suggestions[key] = currentValue + maxChange;
      } else if (suggestions[key] < currentValue - maxChange) {
        suggestions[key] = currentValue - maxChange;
      }
    });
    
    return Object.keys(suggestions).length > 0 ? suggestions : null;
  }
  
  /**
   * Analiza feedback para identificar tendencias y patrones
   */
  private analyzeChannelFeedback(channel: VitalSignChannel): void {
    const history = this.feedbackHistory.get(channel);
    if (!history || history.length < 5) return;
    
    // Implementar análisis avanzado de tendencias aquí
  }
  
  /**
   * Reinicia el gestor de feedback
   */
  public reset(): void {
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.feedbackHistory.set(channel, []);
    }
    
    this.channelConfigs = new Map();
  }
}

/**
 * Crea una nueva instancia del optimizador de señal
 */
export function createSignalOptimizer(): SignalOptimizer {
  return new SignalOptimizerImpl();
}
