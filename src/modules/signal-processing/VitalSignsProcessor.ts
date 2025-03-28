
/**
 * Vital Signs Processor
 * Central processing module that combines signal data to calculate vital signs
 */

import { EventType, eventBus } from '../events/EventBus';
import { HeartBeatResult, PPGSignal, VitalSignsResult } from '../types/signal';

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
  private readonly SPO2_CALIBRATION_FACTOR = 1.05;
  private readonly RMSSD_THRESHOLD = 22;
  
  constructor() {
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
      
      // Calculate SpO2
      const spo2 = this.calculateSpO2(recentPPG);
      
      // Calculate blood pressure
      const pressure = this.calculateBloodPressure(heartRate, recentPPG);
      
      // Check for arrhythmia
      const arrhythmiaData = this.detectArrhythmia(recentHeartbeats);
      
      // Create glucose and lipids estimates (these would need real calibration)
      const glucose = this.simulateGlucoseEstimate();
      const lipids = this.simulateLipidsEstimate();
      
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
   * Calculate SpO2 from PPG signals
   */
  private calculateSpO2(ppgSignals: PPGSignal[]): number {
    if (ppgSignals.length < 30) return 0;
    
    // This is a simulated calculation - a real implementation would use:
    // - Red and infrared PPG signals
    // - Ratio of ratios method (AC/DC ratio of red vs infrared)
    
    // Calculate average perfusion index
    const avgPI = ppgSignals
      .filter(s => s.perfusionIndex !== undefined)
      .map(s => s.perfusionIndex!)
      .reduce((acc, pi) => acc + pi, 0) / ppgSignals.length;
    
    // Calculate amplitude ratios
    const values = ppgSignals.map(s => s.filteredValue);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const amplitude = max - min;
    
    // Calculate baseline using low-pass filter
    const baseline = values.reduce((acc, val) => acc + val, 0) / values.length;
    
    // Calculate simulated ratio of ratios
    const r = (amplitude / baseline) * this.SPO2_CALIBRATION_FACTOR;
    
    // Apply standard SpO2 formula (simplified approximation)
    let spo2 = Math.round(110 - 25 * r);
    
    // Ensure realistic SpO2 range
    spo2 = Math.min(100, Math.max(90, spo2));
    
    // Adjust based on signal quality
    const avgQuality = ppgSignals.reduce((acc, s) => acc + s.quality, 0) / ppgSignals.length;
    if (avgQuality < 50) {
      // Lower confidence - adjust toward normal range
      spo2 = Math.round(0.7 * spo2 + 0.3 * 97);
    }
    
    return spo2;
  }
  
  /**
   * Calculate blood pressure estimate
   */
  private calculateBloodPressure(heartRate: number, ppgSignals: PPGSignal[]): string {
    if (heartRate === 0 || ppgSignals.length < 30) return "--/--";
    
    // This is a simulated calculation - a real implementation would use:
    // - Pulse transit time
    // - Pulse wave morphology analysis
    // - Personalized calibration
    
    // Calculate pulse wave features
    const values = ppgSignals.map(s => s.filteredValue);
    
    // Simulate systolic based on heart rate and signal variance
    const variance = this.calculateVariance(values);
    const normalizedVariance = Math.min(1, Math.max(0.1, variance / 0.5));
    
    // Base systolic on heart rate relationship (higher HR often means higher BP)
    let systolic = 100 + (heartRate - 60) * 0.5 + normalizedVariance * 20;
    
    // Adjust toward normal range
    systolic = 0.7 * systolic + 0.3 * 120;
    
    // Diastolic typically follows systolic
    let diastolic = systolic * 0.65 + 10;
    
    // Round to nearest integers
    const systolicRounded = Math.round(systolic);
    const diastolicRounded = Math.round(diastolic);
    
    return `${systolicRounded}/${diastolicRounded}`;
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
    
    // Get RR intervals from recent heartbeats
    const intervals: number[] = [];
    for (let i = 1; i < heartbeats.length; i++) {
      if (heartbeats[i].lastPeakTime && heartbeats[i-1].lastPeakTime) {
        const interval = heartbeats[i].lastPeakTime - heartbeats[i-1].lastPeakTime;
        if (interval > 300 && interval < 1500) {  // Valid interval range (40-200 BPM)
          intervals.push(interval);
        }
      }
    }
    
    if (intervals.length < 4) {
      return { 
        timestamp: Date.now(),
        rmssd: 0, 
        rrVariation: 0,
        windows: [], 
        detected: false 
      };
    }
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    // Key HRV metric for arrhythmia detection
    const successiveDiffs: number[] = [];
    for (let i = 1; i < intervals.length; i++) {
      const diff = Math.abs(intervals[i] - intervals[i - 1]);
      successiveDiffs.push(diff);
    }
    
    // Square the differences
    const squaredDiffs = successiveDiffs.map(diff => diff * diff);
    
    // Calculate mean of squared differences
    const meanSquared = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / squaredDiffs.length;
    
    // RMSSD
    const rmssd = Math.sqrt(meanSquared);
    
    // Calculate average RR interval for rrVariation
    const avgRR = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const lastRR = intervals[intervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Detect arrhythmia based on RMSSD threshold
    const isArrhythmia = rmssd > this.RMSSD_THRESHOLD;
    
    // Create visual window for arrhythmia section
    if (isArrhythmia && heartbeats.length > 0) {
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
      timestamp: Date.now(),
      rmssd,
      rrVariation,
      windows: [...this.arrhythmiaWindows],
      detected: isArrhythmia
    };
  }
  
  /**
   * Simulate glucose estimate
   */
  private simulateGlucoseEstimate(): number {
    // This is purely a simulation - PPG cannot directly measure glucose
    // Would require calibration with actual glucose measurements
    
    // Generate value in normal range (70-120 mg/dL)
    return Math.round(85 + Math.random() * 20);
  }
  
  /**
   * Simulate lipids estimate
   */
  private simulateLipidsEstimate(): {
    totalCholesterol: number;
    triglycerides: number;
  } {
    // This is purely a simulation - PPG cannot directly measure lipids
    // Would require calibration with actual blood tests
    
    // Generate values in normal ranges
    const totalCholesterol = Math.round(150 + Math.random() * 40);
    const triglycerides = Math.round(100 + Math.random() * 50);
    
    return {
      totalCholesterol,
      triglycerides
    };
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
   * Calculate variance of an array of values
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
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
