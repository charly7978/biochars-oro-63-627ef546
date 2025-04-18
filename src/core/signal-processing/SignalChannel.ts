
/**
 * Represents a specialized channel for processing a specific vital sign
 * ONLY uses real data, no simulations
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
    
    // Initialize default metadata based on channel type
    this.initializeDefaultMetadata();
  }
  
  /**
   * Initialize default metadata values based on channel type
   * Uses zeros and null values - no simulated data
   */
  private initializeDefaultMetadata(): void {
    // Common defaults - all zeros/nulls
    this.metadata.set('quality', 0);
    
    // Channel-specific metadata initialization with zeros
    switch (this.name) {
      case 'heartbeat':
        this.metadata.set('heartRate', 0);
        this.metadata.set('rrIntervals', []);
        this.metadata.set('lastPeakTime', null);
        break;
      case 'spo2':
        this.metadata.set('spo2', 0);
        this.metadata.set('redRatio', 0);
        this.metadata.set('irRatio', 0);
        break;
      case 'bloodPressure':
        this.metadata.set('systolic', 0);
        this.metadata.set('diastolic', 0);
        break;
      case 'arrhythmia':
        this.metadata.set('status', '--');
        this.metadata.set('count', 0);
        break;
      case 'glucose':
        this.metadata.set('glucose', 0);
        this.metadata.set('confidence', 0);
        break;
      case 'lipids':
        this.metadata.set('totalCholesterol', 0);
        this.metadata.set('triglycerides', 0);
        this.metadata.set('confidence', 0);
        break;
      case 'hemoglobin':
        this.metadata.set('value', 0);
        break;
      case 'hydration':
        this.metadata.set('value', 0);
        break;
    }
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
   * Reset the channel
   */
  public reset(): void {
    this.values = [];
    this.metadata.clear();
    this.lastProcessTime = 0;
    
    // Reinitialize default metadata to zeros
    this.initializeDefaultMetadata();
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
}
