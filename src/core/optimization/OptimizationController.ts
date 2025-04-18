
/**
 * Optimization Controller
 * Central hub for managing bidirectional feedback and optimization for all vital sign channels
 */
import { SignalChannel } from '../signal-processing/SignalChannel';
import { ChannelOptimizer } from './ChannelOptimizer';
import { OptimizationFeedback } from './types/OptimizationTypes';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';

export class OptimizationController {
  private channelOptimizers: Map<string, ChannelOptimizer> = new Map();
  private feedbackHistory: Map<string, OptimizationFeedback[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 50;
  
  constructor() {
    console.log("OptimizationController: Initialized bidirectional feedback system");
    this.initializeOptimizers();
  }
  
  /**
   * Initialize optimizers for each vital sign channel
   */
  private initializeOptimizers(): void {
    // Create specialized optimizers for each vital sign
    this.registerOptimizer('heartRate', new ChannelOptimizer('heartRate', {
      amplificationFactor: 1.2,
      noiseReductionLevel: 0.8,
      baselineCorrection: true,
      adaptiveFiltering: true
    }));
    
    this.registerOptimizer('spo2', new ChannelOptimizer('spo2', {
      amplificationFactor: 1.0,
      noiseReductionLevel: 0.9,
      baselineCorrection: true,
      frequencyDomainProcessing: true
    }));
    
    this.registerOptimizer('bloodPressure', new ChannelOptimizer('bloodPressure', {
      amplificationFactor: 1.1,
      noiseReductionLevel: 0.85,
      adaptiveThresholds: true,
      morphologicalAnalysis: true
    }));
    
    this.registerOptimizer('glucose', new ChannelOptimizer('glucose', {
      amplificationFactor: 1.3,
      noiseReductionLevel: 0.95,
      spectralAnalysis: true,
      waveletDecomposition: true
    }));
    
    this.registerOptimizer('lipids', new ChannelOptimizer('lipids', {
      amplificationFactor: 1.25,
      noiseReductionLevel: 0.9,
      spectralAnalysis: true,
      harmonicFiltering: true
    }));
    
    this.registerOptimizer('hemoglobin', new ChannelOptimizer('hemoglobin', {
      amplificationFactor: 1.15,
      noiseReductionLevel: 0.9,
      spectralAnalysis: true,
      peakEnhancement: true
    }));
    
    this.registerOptimizer('hydration', new ChannelOptimizer('hydration', {
      amplificationFactor: 1.1,
      noiseReductionLevel: 0.85,
      baselineCorrection: true,
      lowFrequencyEnhancement: true
    }));
    
    this.registerOptimizer('arrhythmia', new ChannelOptimizer('arrhythmia', {
      amplificationFactor: 1.0,
      noiseReductionLevel: 0.95,
      patternRecognition: true,
      timeSeriesAnalysis: true
    }));
  }
  
  /**
   * Register a new channel optimizer
   */
  private registerOptimizer(channelName: string, optimizer: ChannelOptimizer): void {
    this.channelOptimizers.set(channelName, optimizer);
    this.feedbackHistory.set(channelName, []);
    console.log(`OptimizationController: Registered optimizer for ${channelName}`);
  }
  
  /**
   * Optimize a signal channel using specialized parameters
   */
  public optimizeChannel(channel: SignalChannel): SignalChannel {
    const channelName = channel.getName();
    const optimizer = this.channelOptimizers.get(channelName);
    
    if (!optimizer) {
      console.warn(`OptimizationController: No optimizer found for channel ${channelName}`);
      return channel;
    }
    
    // Apply specialized optimization
    return optimizer.optimize(channel);
  }
  
  /**
   * Provide feedback to improve future optimizations
   */
  public provideFeedback(channelName: string, feedback: OptimizationFeedback): void {
    const optimizer = this.channelOptimizers.get(channelName);
    const history = this.feedbackHistory.get(channelName) || [];
    
    if (optimizer) {
      // Update the optimizer with new feedback
      optimizer.processFeedback(feedback);
      
      // Store feedback history
      history.push(feedback);
      if (history.length > this.MAX_HISTORY_SIZE) {
        history.shift();
      }
      this.feedbackHistory.set(channelName, history);
      
      console.log(`OptimizationController: Processed feedback for ${channelName}`, {
        qualityDelta: feedback.qualityDelta,
        confidenceLevel: feedback.confidenceLevel
      });
    }
  }
  
  /**
   * Process measurement results and generate feedback
   */
  public processResults(results: VitalSignsResult, previousResults?: VitalSignsResult): void {
    if (!previousResults) return;
    
    // Generate feedback for heart rate
    if (results.spo2 > 0 && previousResults.spo2 > 0) {
      this.provideFeedback('spo2', {
        timestamp: Date.now(),
        measuredValue: results.spo2,
        previousValue: previousResults.spo2,
        qualityDelta: this.calculateQualityDelta(results.spo2, previousResults.spo2),
        confidenceLevel: results.overallConfidence || 0.7
      });
    }
    
    // Generate feedback for blood pressure
    if (results.pressure !== "--/--" && previousResults.pressure !== "--/--") {
      const [currentSys, currentDia] = results.pressure.split('/').map(Number);
      const [prevSys, prevDia] = previousResults.pressure.split('/').map(Number);
      
      if (!isNaN(currentSys) && !isNaN(prevSys)) {
        this.provideFeedback('bloodPressure', {
          timestamp: Date.now(),
          measuredValue: currentSys,
          previousValue: prevSys,
          qualityDelta: this.calculateQualityDelta(currentSys, prevSys),
          confidenceLevel: results.overallConfidence || 0.7
        });
      }
    }
    
    // Generate feedback for glucose
    if (results.glucose > 0 && previousResults.glucose > 0) {
      this.provideFeedback('glucose', {
        timestamp: Date.now(),
        measuredValue: results.glucose,
        previousValue: previousResults.glucose,
        qualityDelta: this.calculateQualityDelta(results.glucose, previousResults.glucose),
        confidenceLevel: results.glucoseConfidence || 0.6
      });
    }
    
    // Generate feedback for lipids
    if (results.lipids.totalCholesterol > 0 && previousResults.lipids.totalCholesterol > 0) {
      this.provideFeedback('lipids', {
        timestamp: Date.now(),
        measuredValue: results.lipids.totalCholesterol,
        previousValue: previousResults.lipids.totalCholesterol,
        qualityDelta: this.calculateQualityDelta(
          results.lipids.totalCholesterol, 
          previousResults.lipids.totalCholesterol
        ),
        confidenceLevel: results.lipidsConfidence || 0.6
      });
    }
    
    // Generate feedback for hemoglobin
    if (results.hemoglobin > 0 && previousResults.hemoglobin > 0) {
      this.provideFeedback('hemoglobin', {
        timestamp: Date.now(),
        measuredValue: results.hemoglobin,
        previousValue: previousResults.hemoglobin,
        qualityDelta: this.calculateQualityDelta(results.hemoglobin, previousResults.hemoglobin),
        confidenceLevel: results.overallConfidence || 0.7
      });
    }
    
    // Generate feedback for hydration
    if (results.hydration > 0 && previousResults.hydration > 0) {
      this.provideFeedback('hydration', {
        timestamp: Date.now(),
        measuredValue: results.hydration,
        previousValue: previousResults.hydration,
        qualityDelta: this.calculateQualityDelta(results.hydration, previousResults.hydration),
        confidenceLevel: results.overallConfidence || 0.7
      });
    }
  }
  
  /**
   * Calculate quality delta between current and previous measurements
   */
  private calculateQualityDelta(current: number, previous: number): number {
    // Calculate relative stability (lower variance is better)
    const percentChange = Math.abs((current - previous) / previous);
    
    // Convert to a quality score (0-1)
    // Small changes are good for stability, but total lack of change could be a bad sign
    if (percentChange === 0) return 0.7; // Some change is expected in real measurements
    if (percentChange < 0.02) return 0.9; // Small changes are ideal for most vital signs
    if (percentChange < 0.05) return 0.8;
    if (percentChange < 0.1) return 0.6;
    if (percentChange < 0.2) return 0.4;
    return 0.2; // Large changes suggest unstable measurements
  }
  
  /**
   * Get optimization statistics for a specific channel
   */
  public getOptimizationStats(channelName: string): {
    improvementFactor: number;
    stability: number;
    adaptationLevel: number;
  } {
    const optimizer = this.channelOptimizers.get(channelName);
    if (!optimizer) {
      return {
        improvementFactor: 0,
        stability: 0,
        adaptationLevel: 0
      };
    }
    
    return optimizer.getOptimizationStats();
  }
  
  /**
   * Reset the optimization controller
   */
  public reset(): void {
    this.channelOptimizers.forEach(optimizer => {
      optimizer.reset();
    });
    
    this.feedbackHistory.clear();
    console.log("OptimizationController: Reset complete");
  }
}
