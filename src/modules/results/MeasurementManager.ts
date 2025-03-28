
/**
 * Measurement Manager
 * Manages the measurement process and results
 */

import { EventType, eventBus } from '../events/EventBus';
import { VitalSignsResult } from '../types/signal';
import { cameraModule } from '../camera/CameraModule';
import { ppgSignalExtractor } from '../signal-extraction/PPGSignalExtractor';
import { heartBeatExtractor } from '../signal-extraction/HeartBeatExtractor';
import { vitalSignsProcessor } from '../signal-processing/VitalSignsProcessor';
import { signalOptimizer } from '../optimization/SignalOptimizer';

export class MeasurementManager {
  // Measurement state
  private isMonitoring: boolean = false;
  private isCameraOn: boolean = false;
  private elapsedTime: number = 0;
  private measurementTimer: number | null = null;
  private maxMeasurementTime: number = 30; // seconds
  private signalQuality: number = 0;
  private heartRate: number = 0;
  private showResults: boolean = false;
  private lastSignal: {
    fingerDetected: boolean;
    filteredValue: number;
    quality: number;
  } | null = null;
  
  constructor() {
    // Subscribe to vital signs events
    eventBus.subscribe(EventType.VITAL_SIGNS_UPDATED, this.handleVitalSignsUpdate.bind(this));
    eventBus.subscribe(EventType.HEARTBEAT_RATE_CHANGED, this.handleHeartRateChange.bind(this));
    eventBus.subscribe(EventType.SIGNAL_EXTRACTED, this.handleSignalExtracted.bind(this));
    
    console.log('Measurement Manager initialized');
  }
  
  /**
   * Start a new measurement
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      this.stopMonitoring();
      return;
    }
    
    console.log('Starting vital signs monitoring');
    
    // Reset all processors
    this.reset();
    
    // Update state
    this.isMonitoring = true;
    this.isCameraOn = true;
    this.showResults = false;
    this.elapsedTime = 0;
    
    // Start camera
    cameraModule.start().then(() => {
      cameraModule.startProcessing();
    }).catch(error => {
      console.error('Failed to start camera:', error);
      this.stopMonitoring();
    });
    
    // Start measurement timer
    this.measurementTimer = window.setInterval(() => {
      this.elapsedTime++;
      
      // Auto-stop when max time is reached
      if (this.elapsedTime >= this.maxMeasurementTime) {
        this.stopMonitoring();
      }
    }, 1000);
    
    // Publish monitoring started event
    eventBus.publish(EventType.MONITORING_STARTED, {
      timestamp: Date.now()
    });
  }
  
  /**
   * Stop the current measurement
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    console.log('Stopping vital signs monitoring');
    
    // Update state
    this.isMonitoring = false;
    this.isCameraOn = false;
    
    // Stop camera
    cameraModule.stopProcessing();
    cameraModule.stop();
    
    // Clear timer
    if (this.measurementTimer !== null) {
      clearInterval(this.measurementTimer);
      this.measurementTimer = null;
    }
    
    // Show results
    this.showResults = true;
    
    // Publish monitoring stopped event
    eventBus.publish(EventType.MONITORING_STOPPED, {
      timestamp: Date.now(),
      duration: this.elapsedTime
    });
  }
  
  /**
   * Reset all state and measurements
   */
  reset(): void {
    console.log('Resetting all vital signs monitoring');
    
    // Stop monitoring if active
    if (this.isMonitoring) {
      this.stopMonitoring();
    }
    
    // Reset state
    this.isMonitoring = false;
    this.isCameraOn = false;
    this.elapsedTime = 0;
    this.signalQuality = 0;
    this.heartRate = 0;
    this.showResults = false;
    this.lastSignal = null;
    
    // Publish reset event
    eventBus.publish(EventType.MONITORING_RESET, {
      timestamp: Date.now()
    });
  }
  
  /**
   * Handle stream ready event from camera view
   */
  handleStreamReady(stream: MediaStream): void {
    if (!this.isMonitoring) return;
    
    // Nothing to do here - the camera module handles the stream directly
  }
  
  /**
   * Handle vital signs update
   */
  private handleVitalSignsUpdate(vitalSigns: VitalSignsResult): void {
    // Nothing to do here - these are already being published on the event bus
  }
  
  /**
   * Handle heart rate change
   */
  private handleHeartRateChange(data: { heartRate: number }): void {
    this.heartRate = data.heartRate;
  }
  
  /**
   * Handle signal extracted
   */
  private handleSignalExtracted(signal: {
    fingerDetected: boolean;
    filteredValue: number;
    quality: number;
  }): void {
    this.lastSignal = {
      fingerDetected: signal.fingerDetected,
      filteredValue: signal.filteredValue,
      quality: signal.quality
    };
    
    this.signalQuality = signal.quality;
  }
  
  /**
   * Get the current measurement state
   */
  getState(): {
    isMonitoring: boolean;
    isCameraOn: boolean;
    signalQuality: number;
    heartRate: number;
    elapsedTime: number;
    showResults: boolean;
    lastSignal: {
      fingerDetected: boolean;
      filteredValue: number;
      quality: number;
    } | null;
  } {
    return {
      isMonitoring: this.isMonitoring,
      isCameraOn: this.isCameraOn,
      signalQuality: this.signalQuality,
      heartRate: this.heartRate,
      elapsedTime: this.elapsedTime,
      showResults: this.showResults,
      lastSignal: this.lastSignal
    };
  }
  
  /**
   * Get the last vital signs results
   */
  getVitalSigns(): VitalSignsResult {
    // Get from processor or return default empty result
    const result = vitalSignsProcessor.getLastValidResults() || vitalSignsProcessor.getLastVitalSigns();
    
    if (result) return result;
    
    // Default empty result
    return {
      timestamp: Date.now(),
      heartRate: 0,
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      reliability: 0
    };
  }
}

// Export singleton instance
export const measurementManager = new MeasurementManager();
