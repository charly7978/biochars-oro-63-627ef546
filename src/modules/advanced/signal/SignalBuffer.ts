
/**
 * Manages the buffer of PPG signal values with configurable size
 */
export class SignalBuffer {
  private ppgValues: number[] = [];
  private readonly bufferSize: number;
  
  constructor(bufferSize: number = 300) {
    this.bufferSize = bufferSize;
  }
  
  /**
   * Adds a new value to the buffer, maintaining size constraints
   */
  public addValue(value: number): void {
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.bufferSize) {
      this.ppgValues.shift();
    }
  }
  
  /**
   * Gets all values in the buffer
   */
  public getValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Checks if the buffer has enough data for analysis
   */
  public hasEnoughData(minSamples: number = 60): boolean {
    return this.ppgValues.length >= minSamples;
  }
  
  /**
   * Clears the buffer
   */
  public clear(): void {
    this.ppgValues = [];
  }
  
  /**
   * Gets the current length of the buffer
   */
  public length(): number {
    return this.ppgValues.length;
  }
}
