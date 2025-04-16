
export interface PPGDataPoint {
  time: number;
  value: number;
}

export class CircularBuffer<T extends PPGDataPoint> {
  private buffer: T[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }

  public push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  public getPoints(): T[] {
    const result: T[] = [];
    let current = this.tail;
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[current]);
      current = (current + 1) % this.capacity;
    }
    return result;
  }

  public clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  public getSize(): number {
    return this.size;
  }
}
