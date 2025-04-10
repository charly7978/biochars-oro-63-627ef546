/**
 * Signal Channel - Represents a specialized processing channel for a specific vital sign
 */

export interface ChannelMetadata {
  quality: number;
  timestamp: number;
  timeDelta: number;
  rawValue: number;
  [key: string]: any;
}

export interface ChannelStatistics {
  mean: number;
  min: number;
  max: number;
  amplitude: number;
  variance: number;
  dominantFrequency: number | null;
  periodicityScore: number;
}

export class SignalChannel {
  private values: number[] = [];
  private metadata: ChannelMetadata[] = [];
  private statistics: ChannelStatistics;
  private bufferSize: number;
  private name: string;
  private feedback: Map<string, number> = new Map();
  
  constructor(name: string, bufferSize: number = 300) {
    this.name = name;
    this.bufferSize = bufferSize;
    this.statistics = this.initializeStatistics();
  }
  
  /**
   * Initialize statistics with default values
   */
  private initializeStatistics(): ChannelStatistics {
    return {
      mean: 0,
      min: 0,
      max: 0,
      amplitude: 0,
      variance: 0,
      dominantFrequency: null,
      periodicityScore: 0
    };
  }
  
  /**
   * Add a new value to the channel with metadata
   */
  public addValue(value: number, metadata: ChannelMetadata): void {
    // Add to buffer
    this.values.push(value);
    this.metadata.push(metadata);
    
    // Keep buffer size limited
    if (this.values.length > this.bufferSize) {
      this.values.shift();
      this.metadata.shift();
    }
    
    // Update statistics
    this.updateStatistics();
  }
  
  /**
   * Update channel statistics
   */
  private updateStatistics(): void {
    if (this.values.length === 0) {
      this.statistics = this.initializeStatistics();
      return;
    }
    
    // Calculate basic statistics
    const min = Math.min(...this.values);
    const max = Math.max(...this.values);
    const mean = this.values.reduce((sum, val) => sum + val, 0) / this.values.length;
    
    // Calculate variance
    const variance = this.values.reduce((sum, val) => {
      return sum + Math.pow(val - mean, 2);
    }, 0) / this.values.length;
    
    // Calculate dominant frequency if we have enough data
    let dominantFrequency = null;
    let periodicityScore = 0;
    
    if (this.values.length > 30) {
      const result = this.calculateFrequencyMetrics();
      dominantFrequency = result.dominantFrequency;
      periodicityScore = result.periodicityScore;
    }
    
    // Update statistics
    this.statistics = {
      mean,
      min,
      max,
      amplitude: max - min,
      variance,
      dominantFrequency,
      periodicityScore
    };
  }
  
  /**
   * Calculate frequency domain metrics
   */
  private calculateFrequencyMetrics(): { dominantFrequency: number | null, periodicityScore: number } {
    // Simple autocorrelation for periodicity detection
    const values = this.values.slice(-60); // Use last 60 samples
    const n = values.length;
    
    if (n < 30) {
      return { dominantFrequency: null, periodicityScore: 0 };
    }
    
    // Normalize the signal
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const normalizedValues = values.map(val => val - mean);
    
    // Calculate autocorrelation
    const correlations: number[] = [];
    const maxLag = Math.floor(n / 2);
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += normalizedValues[i] * normalizedValues[i + lag];
      }
      correlations.push(sum);
    }
    
    // Find peaks in autocorrelation
    const peaks: number[] = [];
    for (let i = 1; i < correlations.length - 1; i++) {
      if (
        correlations[i] > correlations[i - 1] && 
        correlations[i] > correlations[i + 1] &&
        correlations[i] > 0
      ) {
        peaks.push(i + 1); // +1 because lag starts at 1
      }
    }
    
    // No peaks found
    if (peaks.length === 0) {
      return { dominantFrequency: null, periodicityScore: 0 };
    }
    
    // Find the dominant peak
    let maxPeakIdx = 0;
    let maxPeakValue = correlations[peaks[0] - 1];
    
    for (let i = 1; i < peaks.length; i++) {
      const peakValue = correlations[peaks[i] - 1];
      if (peakValue > maxPeakValue) {
        maxPeakValue = peakValue;
        maxPeakIdx = i;
      }
    }
    
    // Convert peak lag to frequency
    // Assuming timeDelta is consistent, use the average
    const avgTimeDelta = this.metadata
      .slice(-n)
      .reduce((sum, meta) => sum + (meta.timeDelta || 0), 0) / n;
    
    // Calculate frequency from lag
    const dominantLag = peaks[maxPeakIdx];
    const dominantFrequency = dominantLag > 0 ? 
      1000 / (dominantLag * avgTimeDelta) : null;
    
    // Calculate periodicity score (0-1)
    const maxAutocorr = Math.max(...correlations);
    const periodicityScore = maxAutocorr / (normalizedValues.reduce((sum, val) => sum + val * val, 0) / n);
    
    return {
      dominantFrequency,
      periodicityScore: Math.min(1, Math.max(0, periodicityScore))
    };
  }
  
  /**
   * Provide feedback to the channel for optimization
   */
  public provideFeedback(key: string, value: number): void {
    this.feedback.set(key, value);
  }
  
  /**
   * Get feedback value
   */
  public getFeedback(key: string): number {
    return this.feedback.get(key) || 0;
  }
  
  /**
   * Get the channel name
   */
  public getName(): string {
    return this.name;
  }
  
  /**
   * Get all values in the channel
   */
  public getValues(): number[] {
    return [...this.values];
  }
  
  /**
   * Get the most recent value
   */
  public getLastValue(): number | null {
    return this.values.length > 0 ? this.values[this.values.length - 1] : null;
  }
  
  /**
   * Get channel statistics
   */
  public getStatistics(): ChannelStatistics {
    return { ...this.statistics };
  }
  
  /**
   * Get all metadata
   */
  public getMetadata(): ChannelMetadata[] {
    return [...this.metadata];
  }
  
  /**
   * Get the last metadata entry
   */
  public getLastMetadata(): ChannelMetadata | null {
    return this.metadata.length > 0 ? this.metadata[this.metadata.length - 1] : null;
  }
  
  /**
   * Reset the channel
   */
  public reset(): void {
    this.values = [];
    this.metadata = [];
    this.statistics = this.initializeStatistics();
    this.feedback.clear();
  }
}
