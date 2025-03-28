/**
 * Vital Signs Processor
 * Central processing module that combines signal data to calculate vital signs
 */

import { EventType, eventBus } from '../events/EventBus';
import { HeartBeatResult, PPGSignal, VitalSignsResult } from '../types/signal';
import { SpO2Processor } from '../vital-signs/spo2-processor';
import { BloodPressureProcessor } from '../vital-signs/blood-pressure-processor';
import { GlucoseProcessor } from '../vital-signs/glucose-processor'; 
import { LipidProcessor } from '../vital-signs/lipid-processor';
import { ArrhythmiaDetector } from '../vital-signs/ArrhythmiaDetector';

export class VitalSignsProcessor {
  // Buffers for signal analysis
  private ppgBuffer: PPGSignal[] = [];
  private heartbeatBuffer: HeartBeatResult[] = [];
  private signalStartTime: number = 0;
  
  // Results tracking
  private lastVitalSigns: VitalSignsResult | null = null;
  private lastValidResults: VitalSignsResult | null = null;
  private arrhythmiaWindows: {start: number; end: number}[] = [];
  
  // Processing state
  private isProcessing: boolean = false;
  private processingInterval: number | null = null;
  private measurementDuration: number = 0;
  
  // Constants
  private readonly BUFFER_SIZE = 300;
  private readonly RESULT_INTERVAL_MS = 1000;
  private readonly MIN_MEASUREMENT_TIME_MS = 15000;
  
  // Specialized processors
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  private arrhythmiaDetector: ArrhythmiaDetector;
  
  constructor() {
    // Initialize specialized processors
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.arrhythmiaDetector = new ArrhythmiaDetector();
  
    // Subscribe to signal events
    eventBus.subscribe(EventType.SIGNAL_EXTRACTED, this.onPPGSignal.bind(this));
    eventBus.subscribe(EventType.HEARTBEAT_DETECTED, this.onHeartBeat.bind(this));
    
    // Subscribe to monitoring state events
    eventBus.subscribe(EventType.MONITORING_STARTED, this.startProcessing.bind(this));
    eventBus.subscribe(EventType.MONITORING_STOPPED, this.stopProcessing.bind(this));
    eventBus.subscribe(EventType.MONITORING_RESET, this.reset.bind(this));
    
    console.log('Vital Signs Processor initialized');
  }
  
  /**
   * Handle incoming PPG signals
   */
  private onPPGSignal(signal: PPGSignal): void {
    if (!this.isProcessing) return;
    
    // Add to buffer
    this.ppgBuffer.push(signal);
    
    // Keep buffer at fixed size
    if (this.ppgBuffer.length > this.BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }
    
    // Update measurement duration
    if (this.signalStartTime === 0 && signal.fingerDetected) {
      this.signalStartTime = signal.timestamp;
    }
    
    if (this.signalStartTime > 0) {
      this.measurementDuration = signal.timestamp - this.signalStartTime;
    }
  }
  
  /**
   * Handle incoming heart beat events
   */
  private onHeartBeat(heartBeat: HeartBeatResult): void {
    if (!this.isProcessing) return;
    
    // Add to buffer
    this.heartbeatBuffer.push(heartBeat);
    
    // Keep buffer at fixed size
    if (this.heartbeatBuffer.length > 50) {
      this.heartbeatBuffer.shift();
    }
  }
  
  /**
   * Start processing vital signs
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.signalStartTime = 0;
    this.measurementDuration = 0;
    
    // Start periodic processing
    this.processingInterval = window.setInterval(() => {
      this.processVitalSigns();
    }, this.RESULT_INTERVAL_MS);
    
    console.log('Started vital signs processing');
  }
  
  /**
   * Stop processing and finalize results
   */
  private stopProcessing(): void {
    if (!this.isProcessing) return;
    
    this.isProcessing = false;
    
    // Clear interval
    if (this.processingInterval !== null) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Process final results
    const finalResults = this.processVitalSigns(true);
    
    // Save valid results
    if (finalResults && this.isValidResult(finalResults)) {
      this.lastValidResults = finalResults;
      eventBus.publish(EventType.VITAL_SIGNS_FINAL, finalResults);
    } else if (this.lastValidResults) {
      // Use last valid results if available
      eventBus.publish(EventType.VITAL_SIGNS_FINAL, this.lastValidResults);
    }
    
    console.log('Stopped vital signs processing');
  }
  
  /**
   * Process vital signs from current signal data
   */
  private processVitalSigns(isFinal: boolean = false): VitalSignsResult | null {
    // Skip processing if no data or not enough time elapsed
    if (this.ppgBuffer.length < 30 || this.heartbeatBuffer.length < 3) {
      return null;
    }
    
    try {
      // Get recent PPG signals with finger detected
      const recentPPG = this.ppgBuffer
        .filter(s => s.fingerDetected)
        .slice(-60);
      
      if (recentPPG.length < 30 && !isFinal) {
        return null;
      }
      
      // Get recent heart beats
      const recentHeartbeats = this.heartbeatBuffer.slice(-10);
      
      // Calculate heart rate
      const heartRate = this.calculateHeartRate(recentHeartbeats);
      
      // Extract raw values for processing
      const ppgValues = recentPPG.map(s => s.filteredValue);
      
      // Use specialized processors for each vital sign
      const spo2 = this.spo2Processor.calculateSpO2(ppgValues);
      const pressure = this.bpProcessor.calculateBloodPressure(heartRate, ppgValues);
      
      // Check for arrhythmia using the specialized detector
      const arrhythmiaData = this.detectArrhythmia(recentHeartbeats);
      
      // Create glucose and lipids estimates using specialized processors
      const glucose = this.glucoseProcessor.estimateGlucose(spo2, heartRate, ppgValues);
      const lipids = this.lipidProcessor.estimateLipids(spo2, heartRate, ppgValues);
      
      // Calculate reliability score based on measurement quality
      const reliability = this.calculateReliabilityScore(
        recentPPG, 
        heartRate, 
        this.measurementDuration
      );
      
      // Create vital signs result
      const result: VitalSignsResult = {
        timestamp: Date.now(),
        heartRate,
        spo2,
        pressure,
        glucose,
        lipids,
        arrhythmiaStatus: arrhythmiaData.detected ? "Irregular" : "Normal",
        reliability,
        arrhythmiaData
      };
      
      // Save as last result
      this.lastVitalSigns = result;
      
      // Publish result event
      eventBus.publish(EventType.VITAL_SIGNS_UPDATED, result);
      
      // Publish arrhythmia event if detected
      if (arrhythmiaData.detected) {
        eventBus.publish(EventType.ARRHYTHMIA_DETECTED, arrhythmiaData);
      }
      
      return result;
    } catch (error) {
      console.error('Error processing vital signs:', error);
      return null;
    }
  }
  
  /**
   * Calculate heart rate from recent heartbeats
   */
  private calculateHeartRate(heartbeats: HeartBeatResult[]): number {
    if (heartbeats.length < 3) return 0;
    
    // Use the most recent valid heart rate
    const recentRates = heartbeats
      .filter(hb => hb.bpm >= 40 && hb.bpm <= 200)
      .map(hb => hb.bpm);
    
    if (recentRates.length === 0) return 0;
    
    // Use median to avoid outliers
    const sorted = [...recentRates].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  /**
   * Detect arrhythmia from heart beat intervals
   */
  private detectArrhythmia(heartbeats: HeartBeatResult[]): {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    windows?: {start: number; end: number}[];
    detected?: boolean;
  } {
    if (heartbeats.length < 5) {
      return { 
        timestamp: Date.now(),
        rmssd: 0, 
        rrVariation: 0,
        windows: [], 
        detected: false 
      };
    }
    
    // Use the arrhythmia detector to analyze the heartbeats
    const heartbeatIntervals = this.extractRRIntervals(heartbeats);
    
    if (heartbeatIntervals.length < 4) {
      return { 
        timestamp: Date.now(),
        rmssd: 0, 
        rrVariation: 0,
        windows: [], 
        detected: false 
      };
    }
    
    // Analyze RR intervals using the arrhythmia detector
    const currentTime = Date.now();
    const signalQuality = this.calculateSignalQuality(this.ppgBuffer.slice(-30));
    const result = this.arrhythmiaDetector.analyzeRRIntervals(
      heartbeatIntervals,
      currentTime,
      signalQuality
    );
    
    // If arrhythmia is detected, update the windows
    if (result.isArrhythmia && heartbeats.length > 0) {
      const lastBeat = heartbeats[heartbeats.length - 1];
      if (lastBeat.timestamp) {
        const window = {
          start: lastBeat.timestamp - 2000,
          end: lastBeat.timestamp
        };
        
        // Add to arrhythmia windows
        this.arrhythmiaWindows.push(window);
        
        // Keep only last 3 windows
        if (this.arrhythmiaWindows.length > 3) {
          this.arrhythmiaWindows.shift();
        }
      }
    }
    
    return {
      timestamp: currentTime,
      rmssd: result.rmssd || 0,
      rrVariation: result.rrVariation || 0,
      windows: [...this.arrhythmiaWindows],
      detected: result.isArrhythmia
    };
  }
  
  /**
   * Extract RR intervals from heartbeats
   */
  private extractRRIntervals(heartbeats: HeartBeatResult[]): number[] {
    const intervals: number[] = [];
    
    for (let i = 1; i < heartbeats.length; i++) {
      if (heartbeats[i].lastPeakTime && heartbeats[i-1].lastPeakTime) {
        const interval = heartbeats[i].lastPeakTime - heartbeats[i-1].lastPeakTime;
        if (interval > 300 && interval < 1500) {  // Valid interval range (40-200 BPM)
          intervals.push(interval);
        }
      }
    }
    
    return intervals;
  }
  
  /**
   * Calculate signal quality for reliability assessment
   */
  private calculateSignalQuality(signals: PPGSignal[]): number {
    if (signals.length === 0) return 0;
    
    // Average the quality values from the signals
    const avgQuality = signals.reduce((sum, signal) => sum + signal.quality, 0) / signals.length;
    
    // Check finger detection consistency
    const fingerDetectionRatio = signals.filter(s => s.fingerDetected).length / signals.length;
    
    // Combined quality score
    return Math.round(avgQuality * 0.7 + fingerDetectionRatio * 100 * 0.3);
  }
  
  /**
   * Calculate reliability score for the measurement
   */
  private calculateReliabilityScore(
    ppgSignals: PPGSignal[],
    heartRate: number,
    duration: number
  ): number {
    if (ppgSignals.length < 10 || heartRate === 0) return 0;
    
    // Calculate average signal quality
    const avgQuality = ppgSignals.reduce((acc, s) => acc + s.quality, 0) / ppgSignals.length;
    
    // Duration factor (longer measurements typically more reliable)
    const durationFactor = Math.min(1, duration / this.MIN_MEASUREMENT_TIME_MS);
    
    // Heart rate factor (extremely low or high heart rates might indicate problems)
    const hrFactor = heartRate >= 50 && heartRate <= 150 ? 1 : 0.7;
    
    // Calculate weighted reliability score
    const reliability = Math.round(
      (avgQuality * 0.5) + 
      (durationFactor * 0.3) + 
      (hrFactor * 0.2)
    );
    
    return Math.min(100, Math.max(0, reliability));
  }
  
  /**
   * Check if a result is valid/complete
   */
  private isValidResult(result: VitalSignsResult): boolean {
    return (
      result.heartRate > 40 &&
      result.spo2 >= 90 &&
      result.pressure !== "--/--" &&
      result.reliability > 50
    );
  }
  
  /**
   * Get the last calculated vital signs
   */
  getLastVitalSigns(): VitalSignsResult | null {
    return this.lastVitalSigns;
  }
  
  /**
   * Get the last valid results (preserved after stopping)
   */
  getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  /**
   * Reset processor state
   */
  reset(): void {
    this.ppgBuffer = [];
    this.heartbeatBuffer = [];
    this.signalStartTime = 0;
    this.measurementDuration = 0;
    this.lastVitalSigns = null;
    this.arrhythmiaWindows = [];
    
    // Reset all specialized processors
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.arrhythmiaDetector.reset();
    
    // Stop processing if active
    if (this.isProcessing) {
      this.stopProcessing();
    }
    
    // Complete reset clears saved results too
    this.lastValidResults = null;
    
    console.log('Vital Signs Processor reset');
  }
}

// Export singleton instance
export const vitalSignsProcessor = new VitalSignsProcessor();
