
/**
 * Optimized circular buffer implementation for efficient storage of time-series data
 */

export interface BufferItem {
  time: number;
  [key: string]: any;
}

export class OptimizedCircularBuffer<T extends BufferItem> {
  private buffer: T[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }

  /**
   * Push a new item to the buffer
   */
  public push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  /**
   * Get all items in chronological order
   */
  public getItems(): T[] {
    const result: T[] = [];
    
    if (this.size === 0) {
      return result;
    }
    
    let index = this.tail;
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[index]);
      index = (index + 1) % this.capacity;
    }
    
    return result;
  }

  /**
   * Get recent items from the last n milliseconds
   */
  public getRecentItems(timeWindowMs: number): T[] {
    const now = Date.now();
    return this.getItems().filter(item => (now - item.time) <= timeWindowMs);
  }

  /**
   * Clear the buffer
   */
  public clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  /**
   * Get the current size of the buffer
   */
  public getSize(): number {
    return this.size;
  }

  /**
   * Get the capacity of the buffer
   */
  public getCapacity(): number {
    return this.capacity;
  }
}
