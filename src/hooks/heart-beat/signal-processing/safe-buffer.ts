// Fix for the safe-buffer.ts file
// Define the proper types for the buffer entries
interface BufferEntry {
  timestamp: number;
  value: number;
  time?: number; // Optional for backward compatibility
}

export class SafeBuffer {
  private buffer: BufferEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  // Rest of the implementation
  push(entry: BufferEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getEntries(): BufferEntry[] {
    return [...this.buffer];
  }

  // Add proper typing for timestamp access
  getLatestTimestamp(): number {
    if (this.buffer.length > 0) {
      return this.buffer[this.buffer.length - 1].timestamp;
    }
    return 0;
  }

  // Rest of the methods with proper typing
  clear(): void {
    this.buffer = [];
  }

  getSize(): number {
    return this.buffer.length;
  }

  getMaxSize(): number {
    return this.maxSize;
  }

  setMaxSize(size: number): void {
    this.maxSize = size;
    // Trim buffer if needed
    while (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getLatestEntry(): BufferEntry | null {
    if (this.buffer.length > 0) {
      return this.buffer[this.buffer.length - 1];
    }
    return null;
  }

  getEntryAt(index: number): BufferEntry | null {
    if (index >= 0 && index < this.buffer.length) {
      return this.buffer[index];
    }
    return null;
  }

  getAverageValue(): number {
    if (this.buffer.length === 0) return 0;
    const sum = this.buffer.reduce((acc, entry) => acc + entry.value, 0);
    return sum / this.buffer.length;
  }

  getMinValue(): number {
    if (this.buffer.length === 0) return 0;
    return Math.min(...this.buffer.map(entry => entry.value));
  }

  getMaxValue(): number {
    if (this.buffer.length === 0) return 0;
    return Math.max(...this.buffer.map(entry => entry.value));
  }

  getValueRange(): number {
    if (this.buffer.length === 0) return 0;
    return this.getMaxValue() - this.getMinValue();
  }

  getStandardDeviation(): number {
    if (this.buffer.length <= 1) return 0;
    
    const mean = this.getAverageValue();
    const squaredDiffs = this.buffer.map(entry => 
      Math.pow(entry.value - mean, 2)
    );
    
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / this.buffer.length;
    return Math.sqrt(variance);
  }
}
