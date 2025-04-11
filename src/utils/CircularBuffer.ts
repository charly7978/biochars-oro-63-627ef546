
export interface PPGDataPoint {
  time: number;
  value: number;
}

export class CircularBuffer<T extends PPGDataPoint> {
  private buffer: T[];
  private maxSize: number;

  constructor(maxSize: number) {
    this.buffer = [];
    this.maxSize = maxSize;
  }

  push(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  clear(): void {
    this.buffer = [];
  }

  getPoints(): T[] {
    return [...this.buffer];
  }

  get(index: number): T | undefined {
    return this.buffer[index];
  }

  getLast(): T | undefined {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : undefined;
  }

  size(): number {
    return this.buffer.length;
  }
}
