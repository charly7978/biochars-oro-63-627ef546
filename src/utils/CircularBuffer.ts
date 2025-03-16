
export interface PPGDataPoint {
  time: number;
  value: number;
}

export class CircularBuffer {
  private buffer: PPGDataPoint[];
  private capacity: number;
  private index: number;
  private isFull: boolean;

  constructor(capacity: number) {
    this.buffer = new Array<PPGDataPoint>(capacity);
    this.capacity = capacity;
    this.index = 0;
    this.isFull = false;
  }

  public push(item: PPGDataPoint): void {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.capacity;
    if (this.index === 0) {
      this.isFull = true;
    }
  }

  public get(index: number): PPGDataPoint | undefined {
    if (!this.isFull && index >= this.index) {
      return undefined;
    }
    
    const adjustedIndex = (this.index + index) % this.capacity;
    return this.buffer[adjustedIndex];
  }

  public getPoints(): PPGDataPoint[] {
    if (this.isFull) {
      return [
        ...this.buffer.slice(this.index),
        ...this.buffer.slice(0, this.index)
      ].filter(p => p !== undefined);
    }
    
    return this.buffer.slice(0, this.index).filter(p => p !== undefined);
  }

  public clear(): void {
    this.buffer = new Array<PPGDataPoint>(this.capacity);
    this.index = 0;
    this.isFull = false;
  }

  public size(): number {
    return this.isFull ? this.capacity : this.index;
  }

  public isEmpty(): boolean {
    return this.index === 0 && !this.isFull;
  }
}
