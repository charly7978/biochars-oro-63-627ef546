
/**
 * Safe buffer implementation with additional error handling and validation
 */
import { SignalPoint, TimestampedPoint } from '../../../types/signal-processing';

export class SafeBuffer<T extends TimestampedPoint> {
  private buffer: T[] = [];
  private capacity: number;
  private autoTrim: boolean;
  private validationFn?: (item: T) => boolean;

  constructor(capacity: number, options?: { autoTrim?: boolean, validationFn?: (item: T) => boolean }) {
    this.capacity = capacity;
    this.autoTrim = options?.autoTrim || false;
    this.validationFn = options?.validationFn;
  }

  /**
   * Add an item to the buffer with validation
   */
  push(item: T): boolean {
    try {
      // Validate item if validation function is provided
      if (this.validationFn && !this.validationFn(item)) {
        console.warn('SafeBuffer: Item validation failed', item);
        return false;
      }

      this.buffer.push(item);
      
      // Auto-trim if enabled
      if (this.autoTrim && this.buffer.length > this.capacity) {
        this.buffer.shift();
      }
      
      return true;
    } catch (error) {
      console.error('SafeBuffer: Error adding item', error);
      return false;
    }
  }

  /**
   * Get all items in the buffer
   */
  getAll(): T[] {
    return [...this.buffer];
  }
  
  /**
   * Get the buffer size
   */
  size(): number {
    return this.buffer.length;
  }
  
  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
  }
  
  /**
   * Get the last N items
   */
  getLast(n: number = 1): T[] {
    if (n <= 0 || this.buffer.length === 0) {
      return [];
    }
    
    const count = Math.min(n, this.buffer.length);
    return this.buffer.slice(this.buffer.length - count);
  }
  
  /**
   * Get items within a time range
   */
  getTimeRange(startTime: number, endTime: number): T[] {
    try {
      return this.buffer.filter(item => 
        item.timestamp >= startTime && item.timestamp <= endTime
      );
    } catch (error) {
      console.error('SafeBuffer: Error getting time range', error);
      return [];
    }
  }
}
