
export interface PPGDataPoint {
  time: number;
  value: number;
  isArrhythmia: boolean;
}

export class CircularBuffer {
  private buffer: PPGDataPoint[];
  private maxSize: number;
  private _head: number;
  private _tail: number;
  private _size: number;

  constructor(size: number) {
    this.buffer = new Array(size);
    this.maxSize = size;
    this._head = 0;
    this._tail = 0;
    this._size = 0;
  }

  push(point: PPGDataPoint): void {
    this.buffer[this._tail] = point;
    this._tail = (this._tail + 1) % this.maxSize;
    
    if (this._size < this.maxSize) {
      this._size++;
    } else {
      // Buffer is full, move head
      this._head = (this._head + 1) % this.maxSize;
    }
  }

  getPoints(): PPGDataPoint[] {
    const result: PPGDataPoint[] = [];
    
    if (this._size === 0) return result;
    
    let current = this._head;
    for (let i = 0; i < this._size; i++) {
      result.push(this.buffer[current]);
      current = (current + 1) % this.maxSize;
    }
    
    return result;
  }

  clear(): void {
    this._head = 0;
    this._tail = 0;
    this._size = 0;
  }
  
  get size(): number {
    return this._size;
  }
}
