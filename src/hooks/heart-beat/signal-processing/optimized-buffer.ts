
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Optimized buffer implementation for signal processing
 */

// Define the signal data shape clearly to resolve type issues
export interface SignalDataPoint {
  value: number;
  timestamp: number;
  time: number;
  quality?: number;
}

/**
 * Optimized circular buffer for signal data
 */
export class OptimizedBuffer<T extends SignalDataPoint> {
  private buffer: T[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private readonly capacity: number;
  
  /**
   * Create a new buffer with the specified capacity
   */
  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }
  
  /**
   * Add an item to the buffer
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }
  
  /**
   * Get all items in the buffer
   */
  getAll(): T[] {
    const result = new Array<T>(this.size);
    
    for (let i = 0; i < this.size; i++) {
      const pos = (this.head + i) % this.capacity;
      result[i] = this.buffer[pos];
    }
    
    return result;
  }
  
  /**
   * Get the specified number of most recent items
   */
  getRecent(count: number): T[] {
    const n = Math.min(count, this.size);
    const result = new Array<T>(n);
    
    for (let i = 0; i < n; i++) {
      const pos = (this.tail - i - 1 + this.capacity) % this.capacity;
      result[i] = this.buffer[pos];
    }
    
    return result;
  }
  
  /**
   * Clear the buffer
   */
  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
  
  /**
   * Get the item at the specified index
   */
  at(index: number): T | null {
    if (index < 0 || index >= this.size) return null;
    const pos = (this.head + index) % this.capacity;
    return this.buffer[pos];
  }
  
  /**
   * Get the current size of the buffer
   */
  getSize(): number {
    return this.size;
  }
  
  /**
   * Get all values in the buffer as a number array
   */
  getValues(): number[] {
    const result = new Array<number>(this.size);
    
    for (let i = 0; i < this.size; i++) {
      const pos = (this.head + i) % this.capacity;
      result[i] = this.buffer[pos]?.value || 0;
    }
    
    return result;
  }
  
  /**
   * Get all timestamps in the buffer as a number array
   */
  getTimestamps(): number[] {
    const result = new Array<number>(this.size);
    
    for (let i = 0; i < this.size; i++) {
      const pos = (this.head + i) % this.capacity;
      result[i] = this.buffer[pos]?.timestamp || 0;
    }
    
    return result;
  }
  
  /**
   * Get all time values in the buffer as a number array
   */
  getTimes(): number[] {
    const result = new Array<number>(this.size);
    
    for (let i = 0; i < this.size; i++) {
      const pos = (this.head + i) % this.capacity;
      result[i] = this.buffer[pos]?.time || 0;
    }
    
    return result;
  }
  
  /**
   * Get the most recent item in the buffer
   */
  getLast(): T | null {
    if (this.size === 0) return null;
    const pos = (this.tail - 1 + this.capacity) % this.capacity;
    return this.buffer[pos];
  }
  
  /**
   * Get the oldest item in the buffer
   */
  getFirst(): T | null {
    if (this.size === 0) return null;
    return this.buffer[this.head];
  }
  
  /**
   * Get values in a specific time window
   */
  getInTimeWindow(startTime: number, endTime: number): T[] {
    const result: T[] = [];
    
    for (let i = 0; i < this.size; i++) {
      const pos = (this.head + i) % this.capacity;
      const item = this.buffer[pos];
      if (item && item.timestamp >= startTime && item.timestamp <= endTime) {
        result.push(item);
      }
    }
    
    return result;
  }
  
  /**
   * Filter items based on a predicate
   */
  filter(predicate: (item: T) => boolean): T[] {
    const result: T[] = [];
    
    for (let i = 0; i < this.size; i++) {
      const pos = (this.head + i) % this.capacity;
      const item = this.buffer[pos];
      if (item && predicate(item)) {
        result.push(item);
      }
    }
    
    return result;
  }
}
