/**
 * HeartBeatProcessor module for processing heart rate signals
 * This module is properly implemented to avoid the stopMonitoring error
 */

interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

export class HeartBeatProcessor {
  private readonly BUFFER_SIZE = 200;
  private signalBuffer: number[] = [];
  private peakTimes: number[] = [];
  private lastPeakTime: number | null = null;
  private bpm: number = 0;
  private confidence: number = 0;
  private isMonitoring: boolean = false;
  private arrhythmiaDetected: boolean = false;
  private rmssd: number = 0;

  constructor() {
    this.reset();
    console.log("HeartBeatProcessor: New instance created");
  }

  /**
   * Start monitoring heartbeats
   */
  public startMonitoring(): void {
    this.isMonitoring = true;
    console.log("HeartBeatProcessor: Monitoring started");
  }

  /**
   * Stop monitoring heartbeats
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    console.log("HeartBeatProcessor: Monitoring stopped");
  }

  /**
   * Process a new PPG signal value
   */
  public processValue(value: number): { bpm: number; confidence: number; rrData?: RRData } {
    if (!this.isMonitoring) {
      return { bpm: 0, confidence: 0 };
    }

    // Add value to buffer
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.BUFFER_SIZE) {
      this.signalBuffer.shift();
    }

    // Simple peak detection
    if (this.signalBuffer.length >= 3) {
      const current = value;
      const prev = this.signalBuffer[this.signalBuffer.length - 2];
      const prevPrev = this.signalBuffer[this.signalBuffer.length - 3];

      // Detect peak (local maximum)
      if (prev > current && prev > prevPrev) {
        const now = Date.now();
        
        // Only process if we have a previous peak
        if (this.lastPeakTime !== null) {
          const interval = now - this.lastPeakTime;
          
          // Valid heart rate intervals (300-2000ms correspond to 30-200bpm)
          if (interval >= 300 && interval <= 2000) {
            this.peakTimes.push(now);
            
            // Calculate heart rate from recent intervals
            if (this.peakTimes.length > 2) {
              // Keep only recent peak times
              if (this.peakTimes.length > 10) {
                this.peakTimes.shift();
              }
              
              // Calculate intervals between peaks
              const intervals: number[] = [];
              for (let i = 1; i < this.peakTimes.length; i++) {
                intervals.push(this.peakTimes[i] - this.peakTimes[i - 1]);
              }
              
              // Calculate average interval
              const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
              
              // Convert to BPM
              this.bpm = Math.round(60000 / avgInterval);
              
              // Calculate RMSSD (Root Mean Square of Successive Differences)
              if (intervals.length > 1) {
                let sumSquaredDiffs = 0;
                for (let i = 1; i < intervals.length; i++) {
                  const diff = intervals[i] - intervals[i - 1];
                  sumSquaredDiffs += diff * diff;
                }
                this.rmssd = Math.sqrt(sumSquaredDiffs / (intervals.length - 1));
                
                // Simple arrhythmia detection based on high RMSSD
                this.arrhythmiaDetected = this.rmssd > 70;
              }
              
              // Set confidence based on number of peaks and consistency
              this.confidence = Math.min(1.0, this.peakTimes.length / 10);
              
              return {
                bpm: this.bpm,
                confidence: this.confidence,
                rrData: {
                  intervals: intervals,
                  lastPeakTime: this.lastPeakTime
                }
              };
            }
          }
        }
        
        this.lastPeakTime = now;
      }
    }

    return {
      bpm: this.bpm,
      confidence: this.confidence,
      rrData: {
        intervals: this.peakTimes.length > 1 ? 
          this.peakTimes.slice(1).map((time, i) => time - this.peakTimes[i]) : 
          [],
        lastPeakTime: this.lastPeakTime
      }
    };
  }

  /**
   * Reset all internal state
   */
  public reset(): void {
    this.signalBuffer = [];
    this.peakTimes = [];
    this.lastPeakTime = null;
    this.bpm = 0;
    this.confidence = 0;
    this.rmssd = 0;
    this.arrhythmiaDetected = false;
    console.log("HeartBeatProcessor: Reset complete");
  }

  /**
   * Check if arrhythmia is detected
   */
  public isArrhythmiaDetected(): boolean {
    return this.arrhythmiaDetected;
  }
}
