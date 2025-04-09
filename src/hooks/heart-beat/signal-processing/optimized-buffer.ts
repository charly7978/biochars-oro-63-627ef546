
/**
 * Optimized buffer for signal processing with high performance requirements
 */
import { SignalPoint, TimestampedPoint } from '../../../types/signal-processing';

interface OptimizedBufferConfig {
  capacity: number;
  windowSize?: number;
  allowOverflow?: boolean;
}

export class OptimizedBuffer<T extends TimestampedPoint> {
  private buffer: T[] = [];
  private capacity: number;
  private windowSize: number;
  private allowOverflow: boolean;

  constructor(config: OptimizedBufferConfig) {
    this.capacity = config.capacity;
    this.windowSize = config.windowSize || this.capacity;
    this.allowOverflow = config.allowOverflow || false;
  }

  /**
   * Add a point to the buffer
   */
  push(point: T): boolean {
    if (this.buffer.length >= this.capacity) {
      if (this.allowOverflow) {
        this.buffer.shift();
      } else {
        return false;
      }
    }
    
    this.buffer.push(point);
    return true;
  }

  /**
   * Get all points in the buffer
   */
  getAll(): T[] {
    return [...this.buffer];
  }

  /**
   * Get points within the specified window
   */
  getWindow(windowSize: number = this.windowSize): T[] {
    if (windowSize >= this.buffer.length) {
      return [...this.buffer];
    }
    
    return this.buffer.slice(this.buffer.length - windowSize);
  }

  /**
   * Get points within a time range
   */
  getTimeRange(startTime: number, endTime: number): T[] {
    return this.buffer.filter(point => 
      point.timestamp >= startTime && point.timestamp <= endTime
    );
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.buffer.length >= this.capacity;
  }

  /**
   * Get the last point in the buffer
   */
  getLast(): T | null {
    if (this.buffer.length === 0) {
      return null;
    }
    
    return this.buffer[this.buffer.length - 1];
  }

  /**
   * Get the first point in the buffer
   */
  getFirst(): T | null {
    if (this.buffer.length === 0) {
      return null;
    }
    
    return this.buffer[0];
  }

  /**
   * Calculate the time span of the buffer
   */
  getTimeSpan(): { start: number, end: number, duration: number } | null {
    if (this.buffer.length < 2) {
      return null;
    }
    
    const start = this.buffer[0].timestamp;
    const end = this.buffer[this.buffer.length - 1].timestamp;
    
    return {
      start,
      end,
      duration: end - start
    };
  }

  /**
   * Get buffer at a specific index
   */
  at(index: number): T | null {
    if (index < 0 || index >= this.buffer.length) {
      return null;
    }
    
    return this.buffer[index];
  }

  /**
   * Map buffer values to a new array
   */
  map<U>(callback: (value: T, index: number, array: T[]) => U): U[] {
    return this.buffer.map(callback);
  }

  /**
   * Filter buffer values
   */
  filter(callback: (value: T, index: number, array: T[]) => boolean): T[] {
    return this.buffer.filter(callback);
  }

  /**
   * Find peaks in the signal
   */
  findPeaks(threshold: number = 0.5, field: keyof T = 'value' as keyof T): T[] {
    if (this.buffer.length < 3) {
      return [];
    }
    
    const peaks: T[] = [];
    
    for (let i = 1; i < this.buffer.length - 1; i++) {
      const prev = this.buffer[i - 1][field] as unknown as number;
      const current = this.buffer[i][field] as unknown as number;
      const next = this.buffer[i + 1][field] as unknown as number;
      
      if (current > prev && current > next && current > threshold) {
        peaks.push(this.buffer[i]);
      }
    }
    
    return peaks;
  }
}

// Specialization for SignalPoint
export class SignalBuffer extends OptimizedBuffer<SignalPoint> {
  /**
   * Calculate average value in the buffer
   */
  getAverage(): number {
    if (this.isEmpty()) {
      return 0;
    }
    
    const sum = this.getAll().reduce((acc, point) => acc + point.value, 0);
    return sum / this.size();
  }
  
  /**
   * Find peaks in the signal using value field
   */
  findSignalPeaks(threshold: number = 0.5): SignalPoint[] {
    return this.findPeaks(threshold, 'value');
  }
}
