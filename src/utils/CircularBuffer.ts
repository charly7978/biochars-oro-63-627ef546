
export interface PPGDataPoint {
  x: number;
  y: number;
  value: number;
  time: number;
}

export class CircularBuffer<T extends PPGDataPoint> {
  private buffer: T[];
  private capacity: number;

  constructor(capacity: number) {
    this.buffer = [];
    this.capacity = capacity;
  }

  add(item: T): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  getPoints(): T[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }

  getSize(): number {
    return this.buffer.length;
  }

  getCapacity(): number {
    return this.capacity;
  }
}
