
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';
import { checkSignalQuality } from './heart-beat/signal-quality';

/**
 * Wrapper using the PPGSignalMeter's finger detection and quality
 * No simulation or data manipulation allowed.
 * Improved resistance to false positives
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Signal measurement parameters
  private readonly WINDOW_SIZE = 300;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.035; // Increased from 0.025
  private readonly SPO2_WINDOW = 5;
  private readonly SMA_WINDOW = 5;
  private readonly RR_WINDOW_SIZE = 6;
  private readonly RMSSD_THRESHOLD = 15;
  private readonly PEAK_THRESHOLD = 0.25;
  
  // Extended guard period to prevent false positives
  private readonly FALSE_POSITIVE_GUARD_PERIOD = 800; // Increased from 500ms
  private lastDetectionTime: number = 0;
  
  // Improved counter for weak signals with higher thresholds
  private readonly LOW_SIGNAL_THRESHOLD = 0.15; // Increased from 0.05
  private readonly MAX_WEAK_SIGNALS = 5; // Increased from 3
  private weakSignalsCount: number = 0;
  
  // Signal stability tracking to reduce false positives
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 10;
  private readonly STABILITY_THRESHOLD = 0.2;
  
  /**
   * Constructor that initializes the processor
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing with direct measurement mode only");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal with improved false positive detection
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Apply simple verification
    const now = Date.now();
    const timeSinceLastDetection = now - this.lastDetectionTime;
    
    // Update signal history for stability analysis
    this.updateSignalHistory(ppgValue);
    
    // Enhanced signal verification with stability check
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      ppgValue,
      this.weakSignalsCount,
      {
        lowSignalThreshold: this.LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: this.MAX_WEAK_SIGNALS
      }
    );
    
    this.weakSignalsCount = updatedWeakSignalsCount;
    
    // Additional stability check to prevent false positives
    const isStable = this.checkSignalStability();
    
    // Enhanced verification with stability requirement
    const signalVerified = !isWeakSignal && Math.abs(ppgValue) > 0 && isStable;
    
    if (signalVerified) {
      this.lastDetectionTime = now;
    }
    
    // Only process verified and stable signals or within guard period
    if (signalVerified || timeSinceLastDetection < this.FALSE_POSITIVE_GUARD_PERIOD) {
      return this.processor.processSignal(ppgValue, rrData);
    } else {
      // Return empty result without processing when signal is uncertain
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
  }
  
  /**
   * Update signal history for stability analysis
   */
  private updateSignalHistory(ppgValue: number): void {
    this.signalHistory.push(ppgValue);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }
  }
  
  /**
   * Check signal stability to prevent false positives
   * Returns true if signal is stable enough to process
   */
  private checkSignalStability(): boolean {
    if (this.signalHistory.length < this.HISTORY_SIZE / 2) {
      return false;
    }
    
    // Calculate signal variation
    const values = this.signalHistory.slice(-5);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    
    // Check if stability is within acceptable range
    return variance < this.STABILITY_THRESHOLD;
  }
  
  /**
   * Basic signal verification
   */
  private verifySignal(ppgValue: number): boolean {
    // Basic validation to ensure reasonable values
    if (ppgValue < 0 || ppgValue > 255 || isNaN(ppgValue)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Reset the processor
   */
  public reset() {
    console.log("VitalSignsProcessor: Reset - all measurements start from zero");
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Full reset - removing all data history");
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    this.processor.fullReset();
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.processor.getArrhythmiaCounter();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/types/vital-signs-result';
