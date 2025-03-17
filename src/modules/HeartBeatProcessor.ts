/**
 * HeartBeatProcessor implementation that works with the existing hook
 */
export class HeartBeatProcessor {
  private bpm: number = 0;
  private confidence: number = 0;
  private valueBuffer: number[] = [];
  private peakTimestamps: number[] = [];
  private lastPeakTime: number | null = null;
  private isMonitoring: boolean = false;
  private arrhythmiaDetected: boolean = false;
  
  constructor() {
    console.log("HeartBeatProcessor: Instance created");
    this.reset();
  }
  
  processValue(value: number): { 
    bpm: number; 
    confidence: number;
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  } {
    if (!this.isMonitoring) {
      return { bpm: 0, confidence: 0 };
    }
    
    // Store the value in buffer
    this.valueBuffer.push(value);
    if (this.valueBuffer.length > 20) {
      this.valueBuffer.shift();
    }
    
    // Simple peak detection
    this.detectPeaks();
    
    // Calculate BPM
    this.calculateBPM();
    
    // Get RR intervals
    const rrIntervals = this.calculateRRIntervals();
    
    console.log("HeartBeatProcessor: Processed value", {
      value: value.toFixed(3),
      bpm: this.bpm,
      confidence: this.confidence.toFixed(2),
      peakCount: this.peakTimestamps.length,
      rrIntervals: rrIntervals.intervals.length
    });
    
    return {
      bpm: Math.round(this.bpm),
      confidence: this.confidence,
      rrData: rrIntervals
    };
  }
  
  private detectPeaks(): void {
    if (this.valueBuffer.length < 3) return;
    
    const now = Date.now();
    const currentValue = this.valueBuffer[this.valueBuffer.length - 1];
    const prevValue = this.valueBuffer[this.valueBuffer.length - 2];
    const prevPrevValue = this.valueBuffer[this.valueBuffer.length - 3];
    
    // Simple peak detection: current value is less than previous and previous is greater than the one before
    if (prevValue > currentValue && prevValue > prevPrevValue) {
      // Found a peak
      if (this.lastPeakTime === null || (now - this.lastPeakTime) > 300) {
        this.peakTimestamps.push(now);
        this.lastPeakTime = now;
        
        // Keep only last 10 peaks
        if (this.peakTimestamps.length > 10) {
          this.peakTimestamps.shift();
        }
      }
    }
  }
  
  private calculateBPM(): void {
    if (this.peakTimestamps.length < 2) {
      this.bpm = 0;
      this.confidence = 0;
      return;
    }
    
    // Calculate average interval
    let totalInterval = 0;
    for (let i = 1; i < this.peakTimestamps.length; i++) {
      totalInterval += this.peakTimestamps[i] - this.peakTimestamps[i-1];
    }
    
    const avgInterval = totalInterval / (this.peakTimestamps.length - 1);
    
    // BPM = 60000 / average interval in ms
    this.bpm = 60000 / avgInterval;
    
    // Calculate confidence based on number of peaks and consistency
    const peakConfidence = Math.min(1, this.peakTimestamps.length / 6);
    
    // Calculate standard deviation of intervals
    let varianceSum = 0;
    for (let i = 1; i < this.peakTimestamps.length; i++) {
      const interval = this.peakTimestamps[i] - this.peakTimestamps[i-1];
      varianceSum += Math.pow(interval - avgInterval, 2);
    }
    
    const stdDev = Math.sqrt(varianceSum / (this.peakTimestamps.length - 1));
    const consistencyConfidence = Math.max(0, 1 - (stdDev / avgInterval) * 2);
    
    this.confidence = peakConfidence * 0.6 + consistencyConfidence * 0.4;
    
    // Check for arrhythmia
    if (stdDev > avgInterval * 0.4 && this.peakTimestamps.length > 5) {
      this.arrhythmiaDetected = true;
    } else {
      this.arrhythmiaDetected = false;
    }
  }
  
  private calculateRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    const intervals: number[] = [];
    
    for (let i = 1; i < this.peakTimestamps.length; i++) {
      intervals.push(this.peakTimestamps[i] - this.peakTimestamps[i-1]);
    }
    
    return {
      intervals,
      lastPeakTime: this.lastPeakTime
    };
  }
  
  startMonitoring(): void {
    this.isMonitoring = true;
    console.log("HeartBeatProcessor: Monitoring started");
  }
  
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log("HeartBeatProcessor: Monitoring stopped");
  }
  
  isArrhythmiaDetected(): boolean {
    return this.arrhythmiaDetected;
  }
  
  reset(): void {
    this.bpm = 0;
    this.confidence = 0;
    this.valueBuffer = [];
    this.peakTimestamps = [];
    this.lastPeakTime = null;
    this.arrhythmiaDetected = false;
    console.log("HeartBeatProcessor: Reset complete");
  }
}
