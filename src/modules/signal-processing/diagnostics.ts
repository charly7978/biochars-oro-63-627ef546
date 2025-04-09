/**
 * Signal processing diagnostics system
 * Centralizes diagnostic information and provides monitoring capabilities
 */
import { SignalDiagnosticInfo } from '../../types/signal';

/**
 * Interface for diagnostics subscriber
 */
export interface DiagnosticsSubscriber {
  onDiagnosticUpdate: (info: SignalDiagnosticInfo) => void;
}

/**
 * Signal processing diagnostics manager
 */
export class SignalProcessingDiagnostics {
  private static instance: SignalProcessingDiagnostics;
  private diagnosticHistory: SignalDiagnosticInfo[] = [];
  private subscribers: DiagnosticsSubscriber[] = [];
  private readonly MAX_HISTORY_SIZE = 1000; // Maximum items to keep in history
  private enabled: boolean = true;
  private performanceMetrics: Record<string, number[]> = {};

  private constructor() {
    // Initialize performance metrics
    this.performanceMetrics = {
      processingTime: [],
      signalQuality: [],
      fingerDetectionConfidence: []
    };
    console.log('Signal processing diagnostics system initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SignalProcessingDiagnostics {
    if (!SignalProcessingDiagnostics.instance) {
      SignalProcessingDiagnostics.instance = new SignalProcessingDiagnostics();
    }
    return SignalProcessingDiagnostics.instance;
  }

  /**
   * Record diagnostic information
   */
  public recordDiagnosticInfo(info: SignalDiagnosticInfo): void {
    if (!this.enabled) return;

    // Add timestamp if not present
    const enhancedInfo: SignalDiagnosticInfo = {
      ...info,
      timestamp: info.timestamp || Date.now()
    };

    // Add to history
    this.diagnosticHistory.push(enhancedInfo);
    
    // Trim history if needed
    if (this.diagnosticHistory.length > this.MAX_HISTORY_SIZE) {
      this.diagnosticHistory.shift();
    }

    // Update performance metrics
    if (info.processingTimeMs !== undefined) {
      this.updateMetric('processingTime', info.processingTimeMs);
    }
    if (info.signalQualityMetrics?.snr !== undefined) {
      this.updateMetric('signalQuality', info.signalQualityMetrics.snr);
    }
    if (info.fingerDetectionConfidence !== undefined) {
      this.updateMetric('fingerDetectionConfidence', info.fingerDetectionConfidence);
    }

    // Notify subscribers
    this.notifySubscribers(enhancedInfo);
  }

  /**
   * Update a performance metric
   */
  private updateMetric(name: string, value: number): void {
    if (!this.performanceMetrics[name]) {
      this.performanceMetrics[name] = [];
    }
    
    this.performanceMetrics[name].push(value);
    
    // Keep only recent metrics
    const MAX_METRICS = 100;
    if (this.performanceMetrics[name].length > MAX_METRICS) {
      this.performanceMetrics[name].shift();
    }
  }

  /**
   * Subscribe to diagnostic updates
   */
  public subscribe(subscriber: DiagnosticsSubscriber): void {
    this.subscribers.push(subscriber);
  }

  /**
   * Unsubscribe from diagnostic updates
   */
  public unsubscribe(subscriber: DiagnosticsSubscriber): void {
    this.subscribers = this.subscribers.filter(s => s !== subscriber);
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(info: SignalDiagnosticInfo): void {
    this.subscribers.forEach(subscriber => {
      try {
        subscriber.onDiagnosticUpdate(info);
      } catch (error) {
        console.error('Error notifying diagnostics subscriber:', error);
      }
    });
  }

  /**
   * Enable or disable diagnostics
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`Signal processing diagnostics ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get diagnostic history
   */
  public getDiagnosticHistory(): SignalDiagnosticInfo[] {
    return [...this.diagnosticHistory];
  }

  /**
   * Get history for a specific processing stage
   */
  public getStageHistory(stage: string): SignalDiagnosticInfo[] {
    return this.diagnosticHistory.filter(info => info.processingStage === stage);
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): Record<string, { 
    avg: number, 
    min: number, 
    max: number,
    current: number
  }> {
    const metrics: Record<string, { avg: number, min: number, max: number, current: number }> = {};
    
    for (const [name, values] of Object.entries(this.performanceMetrics)) {
      if (values.length === 0) {
        metrics[name] = { avg: 0, min: 0, max: 0, current: 0 };
      } else {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        metrics[name] = {
          avg,
          min: Math.min(...values),
          max: Math.max(...values),
          current: values[values.length - 1]
        };
      }
    }
    
    return metrics;
  }

  /**
   * Clear all diagnostic data
   */
  public clearDiagnosticData(): void {
    this.diagnosticHistory = [];
    for (const key in this.performanceMetrics) {
      this.performanceMetrics[key] = [];
    }
  }
}

// Export factory function for easy access
export const getDiagnostics = () => SignalProcessingDiagnostics.getInstance();
