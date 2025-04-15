
/**
 * Central service for bidirectional feedback between optimization and calculation algorithms
 * Only processes real data - no simulation
 */

import { VitalSignsResult } from '@/modules/vital-signs/types/vital-signs-result';
import { toast } from "sonner";
import AudioFeedbackService from './AudioFeedbackService';
import ArrhythmiaDetectionService from './ArrhythmiaDetectionService';
import { FeedbackService } from './FeedbackService';

// Feedback channel types for each vital sign
export type VitalSignMetric = 
  | 'heartRate' 
  | 'spo2' 
  | 'bloodPressure' 
  | 'arrhythmia' 
  | 'glucose' 
  | 'lipids' 
  | 'hemoglobin'
  | 'hydration';

// Signal quality classification
export type SignalQualityLevel = 'excellent' | 'good' | 'moderate' | 'poor' | 'unusable';

// Feedback data structure for bidirectional communication
export interface FeedbackData {
  metric: VitalSignMetric;
  value: number | string | object;
  quality: number; // 0-100
  confidence: number; // 0-1
  timestamp: number;
  algorithmId?: string;
  optimizationApplied?: boolean;
  signalCharacteristics?: {
    amplitude?: number;
    frequency?: number;
    noise?: number;
    stability?: number;
  };
}

// Feedback listener type definition
export type FeedbackListener = (data: FeedbackData) => void;

// Optimization parameters for each vital sign
export interface OptimizationParameters {
  signalAmplificationFactor: number;
  noiseReductionLevel: number;
  samplingRate: number;
  adaptiveThreshold: number;
  algorithmPrecision: number;
}

/**
 * Central service that orchestrates bidirectional feedback between 
 * algorithms, optimizers, and UI for all vital signs
 */
class BidirectionalFeedbackService {
  private static instance: BidirectionalFeedbackService;
  
  // Channel listeners for each vital sign
  private listeners: Map<VitalSignMetric, FeedbackListener[]> = new Map();
  
  // Latest feedback data for each vital sign
  private latestFeedback: Map<VitalSignMetric, FeedbackData> = new Map();
  
  // Optimization parameters for each vital sign
  private optimizationParams: Map<VitalSignMetric, OptimizationParameters> = new Map();
  
  // Metrics statistics
  private metricsHistory: Map<VitalSignMetric, FeedbackData[]> = new Map();
  
  // Debug mode
  private debugMode: boolean = false;
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.initializeOptimizationParams();
    this.setupCleanupInterval();
    console.log("BidirectionalFeedbackService: Initialized with real-time optimization");
  }
  
  /**
   * Initialize default optimization parameters for each vital sign
   */
  private initializeOptimizationParams(): void {
    const defaultParams: OptimizationParameters = {
      signalAmplificationFactor: 1.0,
      noiseReductionLevel: 0.5,
      samplingRate: 30,
      adaptiveThreshold: 0.25,
      algorithmPrecision: 0.9
    };
    
    // Set default parameters for each vital sign
    this.optimizationParams.set('heartRate', { 
      ...defaultParams, 
      signalAmplificationFactor: 1.2,
      adaptiveThreshold: 0.2
    });
    
    this.optimizationParams.set('spo2', { 
      ...defaultParams, 
      noiseReductionLevel: 0.7,
      samplingRate: 25
    });
    
    this.optimizationParams.set('bloodPressure', { 
      ...defaultParams, 
      signalAmplificationFactor: 1.3,
      algorithmPrecision: 0.85
    });
    
    this.optimizationParams.set('arrhythmia', { 
      ...defaultParams, 
      noiseReductionLevel: 0.8,
      adaptiveThreshold: 0.3
    });
    
    this.optimizationParams.set('glucose', { 
      ...defaultParams, 
      signalAmplificationFactor: 1.4,
      algorithmPrecision: 0.8
    });
    
    this.optimizationParams.set('lipids', { 
      ...defaultParams, 
      signalAmplificationFactor: 1.5,
      algorithmPrecision: 0.75
    });
    
    this.optimizationParams.set('hemoglobin', { 
      ...defaultParams, 
      signalAmplificationFactor: 1.2,
      algorithmPrecision: 0.85
    });
    
    this.optimizationParams.set('hydration', { 
      ...defaultParams, 
      signalAmplificationFactor: 1.1,
      algorithmPrecision: 0.8
    });
  }
  
  /**
   * Setup automatic cleanup interval
   */
  private setupCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60000); // Clean up every minute
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): BidirectionalFeedbackService {
    if (!BidirectionalFeedbackService.instance) {
      BidirectionalFeedbackService.instance = new BidirectionalFeedbackService();
    }
    return BidirectionalFeedbackService.instance;
  }
  
  /**
   * Subscribe to feedback for a specific vital sign
   */
  public subscribe(metric: VitalSignMetric, listener: FeedbackListener): void {
    if (!this.listeners.has(metric)) {
      this.listeners.set(metric, []);
    }
    
    this.listeners.get(metric)?.push(listener);
    
    console.log(`BidirectionalFeedbackService: New listener subscribed to ${metric}`);
  }
  
  /**
   * Unsubscribe from feedback for a specific vital sign
   */
  public unsubscribe(metric: VitalSignMetric, listener: FeedbackListener): void {
    if (!this.listeners.has(metric)) return;
    
    const currentListeners = this.listeners.get(metric) || [];
    this.listeners.set(metric, currentListeners.filter(l => l !== listener));
    
    console.log(`BidirectionalFeedbackService: Listener unsubscribed from ${metric}`);
  }
  
  /**
   * Send feedback data from algorithm to optimizer and listeners
   */
  public sendFeedback(data: FeedbackData): void {
    const { metric } = data;
    
    // Store latest feedback
    this.latestFeedback.set(metric, data);
    
    // Store in history
    if (!this.metricsHistory.has(metric)) {
      this.metricsHistory.set(metric, []);
    }
    
    const history = this.metricsHistory.get(metric) || [];
    history.push(data);
    
    // Limit history size to prevent memory leaks
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    // Notify all listeners
    this.notifyListeners(data);
    
    // Apply optimization if needed
    this.applyOptimizationIfNeeded(data);
    
    // Debug logging
    if (this.debugMode) {
      console.log(`BidirectionalFeedbackService: Feedback sent for ${metric}`, data);
    }
  }
  
  /**
   * Notify all listeners for a specific metric
   */
  private notifyListeners(data: FeedbackData): void {
    const { metric } = data;
    const listeners = this.listeners.get(metric) || [];
    
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`BidirectionalFeedbackService: Error in listener for ${metric}`, error);
      }
    });
  }
  
  /**
   * Apply optimization based on received feedback
   */
  private applyOptimizationIfNeeded(data: FeedbackData): void {
    const { metric, quality, confidence } = data;
    
    // Get current optimization parameters
    const params = this.optimizationParams.get(metric);
    if (!params) return;
    
    // Calculate if optimization is needed
    const needsOptimization = quality < 70 || confidence < 0.7;
    
    if (needsOptimization) {
      // Adaptive optimization based on signal quality
      const updatedParams = this.calculateOptimizedParameters(metric, data, params);
      
      // Update optimization parameters
      this.optimizationParams.set(metric, updatedParams);
      
      // Log optimization
      if (this.debugMode) {
        console.log(`BidirectionalFeedbackService: Optimization applied for ${metric}`, {
          before: params,
          after: updatedParams,
          quality,
          confidence
        });
      }
      
      // Notify system about optimization
      this.notifyOptimization(metric, updatedParams);
    }
  }
  
  /**
   * Calculate optimized parameters based on feedback data
   */
  private calculateOptimizedParameters(
    metric: VitalSignMetric,
    data: FeedbackData,
    currentParams: OptimizationParameters
  ): OptimizationParameters {
    const { quality, confidence, signalCharacteristics } = data;
    
    // Create a copy of current parameters
    const newParams = { ...currentParams };
    
    // Apply optimization logic based on metric type and signal quality
    if (quality < 50) {
      // For low quality signals, increase amplification
      newParams.signalAmplificationFactor = Math.min(
        currentParams.signalAmplificationFactor * 1.2,
        2.0
      );
      
      // Increase noise reduction
      newParams.noiseReductionLevel = Math.min(
        currentParams.noiseReductionLevel + 0.1,
        0.9
      );
    } else if (quality >= 50 && quality < 70) {
      // For moderate quality signals, make smaller adjustments
      newParams.signalAmplificationFactor = Math.min(
        currentParams.signalAmplificationFactor * 1.1,
        1.8
      );
    } else if (quality >= 85) {
      // For excellent quality signals, gradually return to default
      newParams.signalAmplificationFactor = currentParams.signalAmplificationFactor * 0.95;
      newParams.noiseReductionLevel = Math.max(
        currentParams.noiseReductionLevel - 0.05,
        0.3
      );
    }
    
    // Adjust adaptive threshold based on signal characteristics
    if (signalCharacteristics) {
      if (signalCharacteristics.noise && signalCharacteristics.noise > 0.3) {
        newParams.adaptiveThreshold = Math.min(
          currentParams.adaptiveThreshold + 0.05,
          0.5
        );
      } else if (signalCharacteristics.stability && signalCharacteristics.stability > 0.8) {
        newParams.adaptiveThreshold = Math.max(
          currentParams.adaptiveThreshold - 0.05,
          0.1
        );
      }
    }
    
    // Special optimizations for specific metrics
    switch (metric) {
      case 'heartRate':
        // Heart rate needs precise peak detection
        if (confidence < 0.6) {
          newParams.algorithmPrecision = Math.min(currentParams.algorithmPrecision + 0.05, 0.98);
        }
        break;
        
      case 'spo2':
        // SpO2 needs stable readings
        if (confidence < 0.7) {
          newParams.samplingRate = Math.max(currentParams.samplingRate - 5, 15);
          newParams.noiseReductionLevel = Math.min(currentParams.noiseReductionLevel + 0.1, 0.9);
        }
        break;
        
      case 'bloodPressure':
        // Blood pressure needs amplitude information
        if (confidence < 0.6) {
          newParams.signalAmplificationFactor = Math.min(
            currentParams.signalAmplificationFactor + 0.1,
            1.8
          );
        }
        break;
        
      case 'glucose':
      case 'lipids':
        // Metabolic markers need precise algorithms
        if (confidence < 0.5) {
          newParams.algorithmPrecision = Math.min(currentParams.algorithmPrecision + 0.1, 0.95);
          newParams.samplingRate = Math.min(currentParams.samplingRate + 5, 45);
        }
        break;
        
      default:
        // General optimization for other metrics
        break;
    }
    
    return newParams;
  }
  
  /**
   * Notify system about optimization changes
   */
  private notifyOptimization(metric: VitalSignMetric, params: OptimizationParameters): void {
    // Create optimization feedback
    const optimizationFeedback: FeedbackData = {
      metric,
      value: params,
      quality: 100, // This is a system message with perfect quality
      confidence: 1.0,
      timestamp: Date.now(),
      optimizationApplied: true
    };
    
    // Notify listeners about optimization
    this.notifyListeners(optimizationFeedback);
  }
  
  /**
   * Get current optimization parameters for a specific metric
   */
  public getOptimizationParameters(metric: VitalSignMetric): OptimizationParameters | null {
    return this.optimizationParams.get(metric) || null;
  }
  
  /**
   * Update optimization parameters for a specific metric
   */
  public updateOptimizationParameters(metric: VitalSignMetric, params: Partial<OptimizationParameters>): void {
    const currentParams = this.optimizationParams.get(metric);
    if (!currentParams) return;
    
    this.optimizationParams.set(metric, {
      ...currentParams,
      ...params
    });
    
    console.log(`BidirectionalFeedbackService: Parameters updated for ${metric}`, this.optimizationParams.get(metric));
  }
  
  /**
   * Get the latest feedback for a specific metric
   */
  public getLatestFeedback(metric: VitalSignMetric): FeedbackData | null {
    return this.latestFeedback.get(metric) || null;
  }
  
  /**
   * Get signal quality level based on numeric quality
   */
  public getSignalQualityLevel(quality: number): SignalQualityLevel {
    if (quality >= 90) return 'excellent';
    if (quality >= 75) return 'good';
    if (quality >= 50) return 'moderate';
    if (quality >= 25) return 'poor';
    return 'unusable';
  }
  
  /**
   * Process vital signs results and send feedback for all metrics
   */
  public processVitalSignsResults(results: VitalSignsResult, signalQuality: number): void {
    const timestamp = Date.now();
    
    // Process heart rate
    if (results.heartRate && results.heartRate > 0) {
      this.sendFeedback({
        metric: 'heartRate',
        value: results.heartRate,
        quality: signalQuality,
        confidence: this.calculateConfidence('heartRate', results.heartRate, signalQuality),
        timestamp,
        signalCharacteristics: {
          stability: this.calculateStability('heartRate')
        }
      });
    }
    
    // Process SpO2
    if (results.spo2 && results.spo2 > 0) {
      this.sendFeedback({
        metric: 'spo2',
        value: results.spo2,
        quality: signalQuality,
        confidence: this.calculateConfidence('spo2', results.spo2, signalQuality),
        timestamp,
        signalCharacteristics: {
          stability: this.calculateStability('spo2')
        }
      });
    }
    
    // Process blood pressure
    if (results.pressure && results.pressure !== "--/--") {
      const [systolic, diastolic] = results.pressure.split('/').map(Number);
      
      if (!isNaN(systolic) && !isNaN(diastolic)) {
        this.sendFeedback({
          metric: 'bloodPressure',
          value: { systolic, diastolic },
          quality: signalQuality,
          confidence: this.calculateConfidence('bloodPressure', systolic, signalQuality),
          timestamp,
          signalCharacteristics: {
            stability: this.calculateStability('bloodPressure')
          }
        });
      }
    }
    
    // Process arrhythmia
    if (results.arrhythmiaStatus && results.arrhythmiaStatus !== "--") {
      const isArrhythmia = results.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED");
      const arrhythmiaCount = parseInt(results.arrhythmiaStatus.split('|')[1] || '0', 10);
      
      this.sendFeedback({
        metric: 'arrhythmia',
        value: { isArrhythmia, arrhythmiaCount },
        quality: signalQuality,
        confidence: this.calculateConfidence('arrhythmia', isArrhythmia ? 1 : 0, signalQuality),
        timestamp,
        signalCharacteristics: {
          stability: this.calculateStability('arrhythmia')
        }
      });
    }
    
    // Process glucose
    if (results.glucose && results.glucose > 0) {
      this.sendFeedback({
        metric: 'glucose',
        value: results.glucose,
        quality: signalQuality * 0.8, // Glucose has lower quality from camera
        confidence: this.calculateConfidence('glucose', results.glucose, signalQuality),
        timestamp,
        signalCharacteristics: {
          stability: this.calculateStability('glucose')
        }
      });
    }
    
    // Process lipids
    if (results.lipids && results.lipids.totalCholesterol > 0) {
      this.sendFeedback({
        metric: 'lipids',
        value: results.lipids,
        quality: signalQuality * 0.7, // Lipids have lower quality from camera
        confidence: this.calculateConfidence('lipids', results.lipids.totalCholesterol, signalQuality),
        timestamp,
        signalCharacteristics: {
          stability: this.calculateStability('lipids')
        }
      });
    }
    
    // Process hemoglobin
    if (results.hemoglobin && results.hemoglobin > 0) {
      this.sendFeedback({
        metric: 'hemoglobin',
        value: results.hemoglobin,
        quality: signalQuality * 0.75,
        confidence: this.calculateConfidence('hemoglobin', results.hemoglobin, signalQuality),
        timestamp,
        signalCharacteristics: {
          stability: this.calculateStability('hemoglobin')
        }
      });
    }
    
    // Process hydration
    if (results.hydration && results.hydration > 0) {
      this.sendFeedback({
        metric: 'hydration',
        value: results.hydration,
        quality: signalQuality * 0.85,
        confidence: this.calculateConfidence('hydration', results.hydration, signalQuality),
        timestamp,
        signalCharacteristics: {
          stability: this.calculateStability('hydration')
        }
      });
    }
  }
  
  /**
   * Calculate confidence based on metric type, value and signal quality
   */
  private calculateConfidence(metric: VitalSignMetric, value: number, quality: number): number {
    // Base confidence on signal quality
    let confidence = quality / 100;
    
    // Additional confidence adjustments based on metric type and physiological ranges
    switch (metric) {
      case 'heartRate':
        // Heart rate validity check
        if (value < 40 || value > 200) {
          confidence *= 0.5;
        } else if (value >= 60 && value <= 100) {
          confidence *= 1.2; // Boost confidence for normal range
        }
        break;
        
      case 'spo2':
        // SpO2 validity check
        if (value < 80 || value > 100) {
          confidence *= 0.5;
        } else if (value >= 95 && value <= 100) {
          confidence *= 1.2; // Boost confidence for normal range
        }
        break;
        
      case 'bloodPressure':
        // Blood pressure validity check
        if (value < 80 || value > 200) {
          confidence *= 0.6;
        } else if (value >= 100 && value <= 140) {
          confidence *= 1.1; // Boost confidence for normal systolic range
        }
        break;
        
      case 'glucose':
        // Glucose validity check
        if (value < 60 || value > 300) {
          confidence *= 0.4;
        } else if (value >= 70 && value <= 120) {
          confidence *= 1.1; // Boost confidence for normal range
        }
        break;
        
      case 'lipids':
        // Cholesterol validity check
        if (value < 100 || value > 400) {
          confidence *= 0.3;
        } else if (value >= 150 && value <= 200) {
          confidence *= 1.1; // Boost confidence for normal range
        }
        break;
        
      default:
        // Default adjustment
        break;
    }
    
    // Additional adjustments based on stability
    const stability = this.calculateStability(metric);
    if (stability > 0.8) {
      confidence *= 1.1; // Boost confidence for stable measurements
    } else if (stability < 0.5) {
      confidence *= 0.9; // Reduce confidence for unstable measurements
    }
    
    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Calculate stability based on recent history
   */
  private calculateStability(metric: VitalSignMetric): number {
    const history = this.metricsHistory.get(metric);
    
    if (!history || history.length < 3) {
      return 0.5; // Default stability when not enough history
    }
    
    // Get the last few measurements
    const recentValues = history.slice(-5).map(item => {
      if (typeof item.value === 'number') {
        return item.value;
      } else if (typeof item.value === 'object' && item.value !== null) {
        // For complex objects like blood pressure, use a representative value
        const obj = item.value as any;
        if (obj.systolic) return obj.systolic;
        if (obj.totalCholesterol) return obj.totalCholesterol;
        
        // For other objects, try to find a numeric value
        const numericValue = Object.values(obj).find(v => typeof v === 'number');
        return numericValue !== undefined ? numericValue as number : 0;
      }
      return 0;
    });
    
    // Calculate coefficient of variation (CV = standard deviation / mean)
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    if (mean === 0) return 0.5;
    
    const sumSquaredDiff = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    const stdDev = Math.sqrt(sumSquaredDiff / recentValues.length);
    const cv = stdDev / mean;
    
    // Convert CV to stability (lower CV = higher stability)
    // Typical CV ranges from 0 to 0.3 for stable vital signs
    const stability = Math.max(0, Math.min(1, 1 - (cv / 0.3)));
    
    return stability;
  }
  
  /**
   * Get optimization advice for improving a specific metric
   */
  public getOptimizationAdvice(metric: VitalSignMetric): string {
    const latestFeedback = this.latestFeedback.get(metric);
    
    if (!latestFeedback) {
      return "No hay datos suficientes para generar recomendaciones.";
    }
    
    const { quality, confidence } = latestFeedback;
    const qualityLevel = this.getSignalQualityLevel(quality);
    
    switch (qualityLevel) {
      case 'excellent':
        return "La señal es excelente. Mantenga la posición actual.";
        
      case 'good':
        return "Buena calidad de señal. Para optimizar, mantenga el dedo estable sobre la cámara.";
        
      case 'moderate':
        return "Calidad moderada. Intente aplicar menos presión y asegúrese de que su dedo cubra completamente la cámara.";
        
      case 'poor':
        return "Calidad baja. Asegúrese de que su dedo esté limpio y seco, y cubra completamente la cámara.";
        
      case 'unusable':
        return "Señal muy débil. Verifique que su dedo esté correctamente colocado sobre la cámara y que no haya luz externa.";
    }
  }
  
  /**
   * Apply UI feedback based on recent measurements
   */
  public applyUIFeedback(): void {
    // Check heart rate feedback
    const hrFeedback = this.latestFeedback.get('heartRate');
    if (hrFeedback && hrFeedback.quality < 50) {
      toast("Señal del pulso débil", {
        description: "Coloque su dedo firmemente sobre la cámara",
        duration: 3000
      });
    }
    
    // Check oxygen feedback
    const spo2Feedback = this.latestFeedback.get('spo2');
    if (spo2Feedback && Number(spo2Feedback.value) < 95 && spo2Feedback.confidence > 0.7) {
      toast("Nivel de oxígeno bajo", {
        description: "Respire profundamente y verifique medición",
        duration: 4000
      });
    }
    
    // Check hydration feedback
    const hydrationFeedback = this.latestFeedback.get('hydration');
    if (hydrationFeedback && Number(hydrationFeedback.value) < 60 && hydrationFeedback.confidence > 0.7) {
      toast("Nivel de hidratación bajo", {
        description: "Considere beber agua para mejorar su hidratación",
        duration: 4000
      });
    }
  }
  
  /**
   * Generate audio feedback for heart rate and arrhythmia
   */
  public generateAudioFeedback(): void {
    // Check arrhythmia feedback
    const arrhythmiaFeedback = this.latestFeedback.get('arrhythmia');
    if (arrhythmiaFeedback && typeof arrhythmiaFeedback.value === 'object') {
      const arrhythmiaValue = arrhythmiaFeedback.value as any;
      if (arrhythmiaValue.isArrhythmia && arrhythmiaFeedback.confidence > 0.7) {
        AudioFeedbackService.triggerHeartbeatFeedback('arrhythmia');
        return;
      }
    }
    
    // Check heart rate feedback for normal beep
    const hrFeedback = this.latestFeedback.get('heartRate');
    if (hrFeedback && hrFeedback.quality > 60 && hrFeedback.confidence > 0.5) {
      AudioFeedbackService.triggerHeartbeatFeedback('normal');
    }
  }
  
  /**
   * Clean up old data to prevent memory issues
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
    
    // Clean up history for each metric
    this.metricsHistory.forEach((history, metric) => {
      const filteredHistory = history.filter(data => now - data.timestamp < MAX_AGE_MS);
      this.metricsHistory.set(metric, filteredHistory);
    });
    
    if (this.debugMode) {
      console.log("BidirectionalFeedbackService: Cleaned up old data");
    }
  }
  
  /**
   * Enable/disable debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`BidirectionalFeedbackService: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Clean up resources
   */
  public cleanUp(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.listeners.clear();
    this.latestFeedback.clear();
    this.metricsHistory.clear();
    
    console.log("BidirectionalFeedbackService: Cleaned up resources");
  }
}

// Create and export singleton instance
const bidirectionalFeedbackService = BidirectionalFeedbackService.getInstance();
export default bidirectionalFeedbackService;

