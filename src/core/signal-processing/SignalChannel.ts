
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
    
    // Initialize default metadata based on channel type
    this.initializeDefaultMetadata();
  }
  
  /**
   * Initialize default metadata values based on channel type
   * This ensures we have reasonable defaults for each vital sign
   */
  private initializeDefaultMetadata(): void {
    // Common defaults
    this.metadata.set('quality', 0);
    
    // Channel-specific defaults
    switch (this.name) {
      case 'heartbeat':
        this.metadata.set('heartRate', 0);
        this.metadata.set('rrIntervals', []);
        break;
      case 'spo2':
        this.metadata.set('spo2', 0);
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
    
    // Update channel-specific metadata based on new value
    this.updateChannelMetadata(value);
  }
  
  /**
   * Update channel-specific metadata based on new values
   * This simulates the specialized processing for each vital sign
   */
  private updateChannelMetadata(value: number): void {
    const quality = this.metadata.get('quality') || 0;
    
    // Skip updates if quality is too low
    if (quality < 10 && this.values.length < 5) return;
    
    // Different processing logic for each channel type
    switch (this.name) {
      case 'spo2':
        this.updateSpo2Metadata();
        break;
      case 'bloodPressure':
        this.updateBloodPressureMetadata();
        break;
      case 'glucose':
        this.updateGlucoseMetadata();
        break;
      case 'lipids':
        this.updateLipidsMetadata();
        break;
      case 'hemoglobin':
        this.updateHemoglobinMetadata();
        break;
      case 'hydration':
        this.updateHydrationMetadata();
        break;
    }
  }
  
  /**
   * Update SpO2 metadata based on signal characteristics
   */
  private updateSpo2Metadata(): void {
    if (this.values.length < 5) return;
    
    // Simple SpO2 simulation based on signal characteristics
    const avg = this.getAverage(10);
    const stdDev = this.getStandardDeviation(10);
    
    // Calculate SpO2 from signal characteristics
    // Using reasonable SpO2 values that are based on signal quality
    const quality = this.metadata.get('quality') || 0;
    const baseSpO2 = 95; // Healthy baseline
    
    // Calculate SpO2 with small variations based on signal
    const spo2 = Math.min(99, Math.max(92, baseSpO2 + (avg * 5) - (stdDev * 10)));
    
    this.metadata.set('spo2', Math.round(spo2));
  }
  
  /**
   * Update blood pressure metadata
   */
  private updateBloodPressureMetadata(): void {
    if (this.values.length < 10) return;
    
    // Get heart rate from heartbeat channel if available
    const heartRate = this.metadata.get('heartRate') || 70;
    
    // Calculate blood pressure based on signal characteristics
    const avg = this.getAverage(10);
    const min = this.getMinimum(10);
    const max = this.getMaximum(10);
    const range = max - min;
    
    // Calculate systolic and diastolic pressures
    // Using reasonable defaults modified by signal characteristics
    const baseSystolic = 120;
    const baseDiastolic = 80;
    
    const systolic = baseSystolic + (heartRate - 70) * 0.5 + range * 50;
    const diastolic = baseDiastolic + (heartRate - 70) * 0.2 + min * 30;
    
    this.metadata.set('systolic', Math.round(systolic));
    this.metadata.set('diastolic', Math.round(diastolic));
  }
  
  /**
   * Update glucose metadata
   */
  private updateGlucoseMetadata(): void {
    if (this.values.length < 10) return;
    
    // Calculate glucose based on signal characteristics
    const avg = this.getAverage(10);
    const stdDev = this.getStandardDeviation(10);
    
    // Base glucose value with small variations
    const baseGlucose = 90;
    const glucose = baseGlucose + avg * 30 + stdDev * 10;
    
    this.metadata.set('glucose', Math.round(glucose));
    this.metadata.set('confidence', Math.min(1, this.values.length / 30));
  }
  
  /**
   * Update lipids metadata
   */
  private updateLipidsMetadata(): void {
    if (this.values.length < 10) return;
    
    // Calculate lipid values based on signal characteristics
    const avg = this.getAverage(15);
    const stdDev = this.getStandardDeviation(15);
    
    // Base values with variations
    const baseCholesterol = 180;
    const baseTriglycerides = 140;
    
    const cholesterol = baseCholesterol + avg * 50 + stdDev * 20;
    const triglycerides = baseTriglycerides + avg * 30 + stdDev * 40;
    
    this.metadata.set('totalCholesterol', Math.round(cholesterol));
    this.metadata.set('triglycerides', Math.round(triglycerides));
    this.metadata.set('confidence', Math.min(1, this.values.length / 30));
  }
  
  /**
   * Update hemoglobin metadata
   */
  private updateHemoglobinMetadata(): void {
    if (this.values.length < 8) return;
    
    // Calculate hemoglobin based on signal characteristics
    const avg = this.getAverage(8);
    const min = this.getMinimum(8);
    
    // Base value with variations
    const baseHemoglobin = 14;
    const hemoglobin = baseHemoglobin + (avg - 0.5) * 2 + min;
    
    this.metadata.set('value', hemoglobin);
  }
  
  /**
   * Update hydration metadata
   */
  private updateHydrationMetadata(): void {
    if (this.values.length < 8) return;
    
    // Calculate hydration based on signal characteristics
    const avg = this.getAverage(8);
    const max = this.getMaximum(8);
    
    // Base value with variations
    const baseHydration = 70;
    const hydration = baseHydration + (avg * 10) + (max * 5);
    
    this.metadata.set('value', Math.min(100, Math.round(hydration)));
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
    
    // Reinitialize default metadata
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
