
/**
 * Signal processor for PPG signals
 * Implements various filtering and analysis techniques
 * Enhanced to drastically reduce false positives in finger detection
 */

import { applyFilters } from './signal-filtering';
import { findPeaksEnhanced, calculateHeartRate } from './peak-detection';
import { calculateSignalQuality } from './signal-quality';

export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly SMA_WINDOW_SIZE = 7; // Increased window size for better smoothing
  private readonly MEDIAN_WINDOW_SIZE = 5; // Increased median filter window
  private readonly LOW_PASS_ALPHA = 0.15; // More aggressive low pass filter
  
  // Noise detection parameters
  private readonly NOISE_THRESHOLD = 20; // Lowered threshold for more sensitive noise detection
  private noiseLevel: number = 0;
  
  /**
   * Get current PPG values buffer
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Apply combined filtering for robust signal processing
   * Uses multiple filters in sequence for better results
   */
  public applyFilters(value: number): { filteredValue: number, quality: number } {
    const result = applyFilters(
      value, 
      this.ppgValues, 
      this.noiseLevel,
      this.SMA_WINDOW_SIZE,
      this.MEDIAN_WINDOW_SIZE,
      this.LOW_PASS_ALPHA
    );
    
    // Update noise level from the filter result
    this.noiseLevel = result.updatedNoiseLevel;
    
    // Store the filtered value in the buffer
    this.ppgValues.push(result.filteredValue);
    if (this.ppgValues.length > 40) { // Increased buffer size for better pattern detection
      this.ppgValues.shift();
    }
    
    return { 
      filteredValue: result.filteredValue,
      quality: result.quality
    };
  }
  
  /**
   * Calculate heart rate from PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    return calculateHeartRate(this.ppgValues, sampleRate);
  }
  
  /**
   * Reset the signal processor
   */
  public reset(): void {
    this.ppgValues = [];
    this.noiseLevel = 0;
  }
}
