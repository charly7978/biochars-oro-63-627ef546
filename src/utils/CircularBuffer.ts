
export interface PPGDataPoint {
  time: number;
  value: number;
}

export class CircularBuffer<T extends PPGDataPoint> {
  private buffer: T[];
  private size: number;
  private head: number = 0;
  private tail: number = 0;
  private isFull: boolean = false;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Array<T>(size);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    
    if (this.isFull) {
      this.tail = (this.tail + 1) % this.size;
    }
    
    this.head = (this.head + 1) % this.size;
    this.isFull = this.head === this.tail;
  }

  getPoints(): T[] {
    if (this.isEmpty()) {
      return [];
    }

    const points: T[] = [];
    let current = this.tail;
    
    do {
      points.push(this.buffer[current]);
      current = (current + 1) % this.size;
    } while (current !== this.head);
    
    return points;
  }

  isEmpty(): boolean {
    return !this.isFull && this.head === this.tail;
  }

  isFilled(): boolean {
    return this.isFull;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.isFull = false;
    this.buffer = new Array<T>(this.size);
  }

  getSize(): number {
    if (this.isFull) return this.size;
    if (this.head >= this.tail) return this.head - this.tail;
    return this.size - (this.tail - this.head);
  }
}
