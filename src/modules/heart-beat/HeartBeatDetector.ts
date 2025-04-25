
import { SignalFilterPipeline } from '../vital-signs/signal/SignalFilterPipeline';

export class HeartBeatDetector {
  private readonly MIN_PEAK_PROMINENCE = 0.4;
  private readonly MIN_PEAK_DISTANCE_MS = 300;
  private readonly MAX_PEAK_DISTANCE_MS = 2000;
  private readonly TREND_WINDOW_SIZE = 8;
  
  private filterPipeline: SignalFilterPipeline;
  private lastPeakTime: number | null = null;
  private peakHistory: Array<{time: number, value: number}> = [];
  private trendBuffer: number[] = [];
  
  constructor() {
    this.filterPipeline = new SignalFilterPipeline();
  }
  
  /**
   * Process new signal value and detect peaks
   */
  public processValue(rawValue: number): {
    isPeak: boolean;
    confidence: number;
    filteredValue: number;
    isStable: boolean;
  } {
    // Apply enhanced filtering
    const { filteredValue, snr, isStable } = this.filterPipeline.processValue(rawValue);
    
    // Check for minimum signal quality
    if (snr < 2.0 || !isStable) {
      return { isPeak: false, confidence: 0, filteredValue, isStable };
    }
    
    const now = Date.now();
    
    // Check peak prominence
    if (!this.checkPeakProminence(filteredValue)) {
      return { isPeak: false, confidence: 0, filteredValue, isStable };
    }
    
    // Validate peak timing
    if (!this.validatePeakTiming(now)) {
      return { isPeak: false, confidence: 0, filteredValue, isStable };
    }
    
    // Check trend consistency
    this.updateTrendBuffer(filteredValue);
    if (!this.checkTrendConsistency()) {
      return { isPeak: false, confidence: 0, filteredValue, isStable };
    }
    
    // Calculate confidence based on multiple factors
    const confidence = this.calculatePeakConfidence(filteredValue, snr);
    
    // Update peak history
    if (confidence > 0.5) {
      this.updatePeakHistory(now, filteredValue);
      this.lastPeakTime = now;
    }
    
    return {
      isPeak: confidence > 0.5,
      confidence,
      filteredValue,
      isStable
    };
  }
  
  /**
   * Check if value is prominent enough to be a peak
   */
  private checkPeakProminence(value: number): boolean {
    if (this.peakHistory.length < 2) return true;
    
    const recentPeaks = this.peakHistory.slice(-3);
    const avgPeakValue = recentPeaks.reduce((sum, p) => sum + p.value, 0) / recentPeaks.length;
    
    return Math.abs(value) > avgPeakValue * this.MIN_PEAK_PROMINENCE;
  }
  
  /**
   * Validate timing between peaks
   */
  private validatePeakTiming(now: number): boolean {
    if (!this.lastPeakTime) return true;
    
    const timeSinceLastPeak = now - this.lastPeakTime;
    return timeSinceLastPeak >= this.MIN_PEAK_DISTANCE_MS && 
           timeSinceLastPeak <= this.MAX_PEAK_DISTANCE_MS;
  }
  
  /**
   * Update and check trend consistency
   */
  private updateTrendBuffer(value: number): void {
    this.trendBuffer.push(value);
    if (this.trendBuffer.length > this.TREND_WINDOW_SIZE) {
      this.trendBuffer.shift();
    }
  }
  
  private checkTrendConsistency(): boolean {
    if (this.trendBuffer.length < this.TREND_WINDOW_SIZE) return true;
    
    let positiveSlopes = 0;
    let negativeSlopes = 0;
    
    for (let i = 1; i < this.trendBuffer.length; i++) {
      const slope = this.trendBuffer[i] - this.trendBuffer[i-1];
      if (slope > 0) positiveSlopes++;
      if (slope < 0) negativeSlopes++;
    }
    
    // Require balanced slope distribution for natural peaks
    const slopeRatio = Math.min(positiveSlopes, negativeSlopes) / 
                      Math.max(positiveSlopes, negativeSlopes);
                      
    return slopeRatio > 0.3;
  }
  
  /**
   * Calculate peak confidence based on multiple factors
   */
  private calculatePeakConfidence(value: number, snr: number): number {
    let confidence = 0;
    
    // SNR contribution
    confidence += Math.min(1, snr / 5.0) * 0.4;
    
    // Amplitude contribution
    if (this.peakHistory.length > 0) {
      const avgPeakValue = this.peakHistory.reduce((sum, p) => sum + p.value, 0) / 
                          this.peakHistory.length;
      confidence += Math.min(1, Math.abs(value) / avgPeakValue) * 0.3;
    } else {
      confidence += 0.3;
    }
    
    // Timing contribution
    if (this.lastPeakTime) {
      const timeSinceLastPeak = Date.now() - this.lastPeakTime;
      const expectedInterval = 60000 / 75; // Assume ~75 BPM as reference
      const timingScore = 1 - Math.min(1, Math.abs(timeSinceLastPeak - expectedInterval) / 
                                        expectedInterval);
      confidence += timingScore * 0.3;
    } else {
      confidence += 0.3;
    }
    
    return confidence;
  }
  
  /**
   * Update peak history
   */
  private updatePeakHistory(time: number, value: number): void {
    this.peakHistory.push({ time, value });
    if (this.peakHistory.length > 10) {
      this.peakHistory.shift();
    }
  }
  
  /**
   * Reset detector state
   */
  public reset(): void {
    this.filterPipeline.reset();
    this.lastPeakTime = null;
    this.peakHistory = [];
    this.trendBuffer = [];
  }
}
