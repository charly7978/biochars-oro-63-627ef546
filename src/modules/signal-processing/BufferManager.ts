
/**
 * Manages data buffers with consistent APIs for different processor modules
 */
export class BufferManager<T> {
  private buffer: T[];
  private readonly maxSize: number;
  
  constructor(maxSize: number, initialValues: T[] = []) {
    this.maxSize = maxSize;
    this.buffer = [...initialValues];
  }
  
  /**
   * Add a value to the buffer, maintaining max size
   */
  public add(value: T): void {
    this.buffer.push(value);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }
  
  /**
   * Add multiple values to the buffer, maintaining max size
   */
  public addMultiple(values: T[]): void {
    for (const value of values) {
      this.add(value);
    }
  }
  
  /**
   * Get the current buffer values
   */
  public getValues(): T[] {
    return [...this.buffer];
  }
  
  /**
   * Get the most recent value
   */
  public getLatest(): T | undefined {
    if (this.buffer.length === 0) return undefined;
    return this.buffer[this.buffer.length - 1];
  }
  
  /**
   * Get the average of numeric buffer values
   * (only works for numeric type T)
   */
  public getAverage(): number {
    if (this.buffer.length === 0) return 0;
    const sum = this.buffer.reduce((a, b) => a + (b as unknown as number), 0);
    return sum / this.buffer.length;
  }
  
  /**
   * Clear the buffer
   */
  public clear(): void {
    this.buffer = [];
  }
  
  /**
   * Get the current size of the buffer
   */
  public size(): number {
    return this.buffer.length;
  }
  
  /**
   * Check if the buffer is empty
   */
  public isEmpty(): boolean {
    return this.buffer.length === 0;
  }
  
  /**
   * Check if the buffer is full
   */
  public isFull(): boolean {
    return this.buffer.length >= this.maxSize;
  }
}
