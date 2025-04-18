
/**
 * Represents a specialized channel for processing a specific vital sign
 */
export class SignalChannel {
  private name: string;
  private bufferSize: number;
  private values: number[] = [];
  private metadata: Map<string, any> = new Map();
  private lastProcessTime: number = 0;
  
  constructor(name: string, bufferSize: number = 300) {
    this.name = name;
    this.bufferSize = bufferSize;
  }
  
  /**
   * Add a value to the channel and automatically limit buffer size
   */
  public addValue(value: number, options?: {
    quality?: number;
    timestamp?: number;
    timeDelta?: number;
    rawValue?: number;
  }): void {
    this.values.push(value);
    
    if (this.values.length > this.bufferSize) {
      this.values.shift();
    }
    
    if (options) {
      if (options.quality !== undefined) {
        this.setMetadata('quality', options.quality);
      }
      
      if (options.timestamp !== undefined) {
        this.lastProcessTime = options.timestamp;
        this.setMetadata('lastProcessTime', options.timestamp);
      }
      
      if (options.timeDelta !== undefined) {
        this.setMetadata('timeDelta', options.timeDelta);
      }
      
      if (options.rawValue !== undefined) {
        this.setMetadata('rawValue', options.rawValue);
      }
    }
  }
  
  /**
   * Get all values in the channel
   */
  public getValues(): number[] {
    return [...this.values];
  }
  
  /**
   * Get the latest value
   */
  public getLatestValue(): number | undefined {
    return this.values.length > 0 ? this.values[this.values.length - 1] : undefined;
  }
  
  /**
   * Set metadata for the channel
   */
  public setMetadata(key: string, value: any): void {
    this.metadata.set(key, value);
  }
  
  /**
   * Get metadata from the channel
   */
  public getMetadata(key: string): any {
    return this.metadata.get(key);
  }
  
  /**
   * Get all metadata as an object
   */
  public getAllMetadata(): Record<string, any> {
    const result: Record<string, any> = {};
    this.metadata.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  
  /**
   * Reset the channel
   */
  public reset(): void {
    this.values = [];
    this.metadata.clear();
    this.lastProcessTime = 0;
  }
  
  /**
   * Get channel name
   */
  public getName(): string {
    return this.name;
  }
  
  /**
   * Calculate the average of the last N values
   */
  public getAverage(count?: number): number {
    if (this.values.length === 0) return 0;
    
    const n = count && count < this.values.length ? count : this.values.length;
    const valuesToAverage = this.values.slice(-n);
    
    return valuesToAverage.reduce((sum, val) => sum + val, 0) / valuesToAverage.length;
  }
  
  /**
   * Calculate the standard deviation of the last N values
   */
  public getStandardDeviation(count?: number): number {
    if (this.values.length === 0) return 0;
    
    const n = count && count < this.values.length ? count : this.values.length;
    const valuesToProcess = this.values.slice(-n);
    const avg = this.getAverage(n);
    
    const squaredDiffs = valuesToProcess.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / n;
    
    return Math.sqrt(avgSquaredDiff);
  }
  
  /**
   * Calculate the minimum value of the last N values
   */
  public getMinimum(count?: number): number {
    if (this.values.length === 0) return 0;
    
    const n = count && count < this.values.length ? count : this.values.length;
    const valuesToProcess = this.values.slice(-n);
    
    return Math.min(...valuesToProcess);
  }
  
  /**
   * Calculate the maximum value of the last N values
   */
  public getMaximum(count?: number): number {
    if (this.values.length === 0) return 0;
    
    const n = count && count < this.values.length ? count : this.values.length;
    const valuesToProcess = this.values.slice(-n);
    
    return Math.max(...valuesToProcess);
  }
  
  /**
   * Calculate the signal-to-noise ratio
   */
  public getSignalToNoiseRatio(count?: number): number {
    const avg = this.getAverage(count);
    const stdDev = this.getStandardDeviation(count);
    
    if (stdDev === 0) return 0;
    return Math.abs(avg) / stdDev;
  }
}
