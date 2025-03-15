
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

export interface PPGDataPoint {
  time: number;
  value: number;
  isArrhythmia: boolean;
}

export class CircularBuffer {
  private buffer: PPGDataPoint[];
  private size: number;
  private head: number;
  private tail: number;
  private count: number;

  constructor(size: number) {
    this.buffer = new Array(size);
    this.size = size;
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  push(item: PPGDataPoint): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.size;
    
    if (this.count === this.size) {
      this.tail = (this.tail + 1) % this.size;
    } else {
      this.count++;
    }
  }

  pop(): PPGDataPoint | undefined {
    if (this.count === 0) {
      return undefined;
    }
    
    const item = this.buffer[this.tail];
    this.tail = (this.tail + 1) % this.size;
    this.count--;
    
    return item;
  }

  getPoints(): PPGDataPoint[] {
    const result: PPGDataPoint[] = [];
    
    if (this.count === 0) {
      return result;
    }
    
    let currentIndex = this.tail;
    for (let i = 0; i < this.count; i++) {
      result.push(this.buffer[currentIndex]);
      currentIndex = (currentIndex + 1) % this.size;
    }
    
    return result;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }
}
