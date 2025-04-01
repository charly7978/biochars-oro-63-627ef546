// Fix for the optimized-buffer.ts file
// Define the proper types for the buffer entries
interface BufferEntry {
  timestamp: number;
  value: number;
  time?: number; // Optional for backward compatibility
}

export class OptimizedBuffer {
  private buffer: BufferEntry[] = [];
  private maxSize: number;
  private lastAccessIndex: number = 0;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  // Rest of the implementation
  push(entry: BufferEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
      // Adjust last access index
      if (this.lastAccessIndex > 0) {
        this.lastAccessIndex--;
      }
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
    this.lastAccessIndex = 0;
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
      if (this.lastAccessIndex > 0) {
        this.lastAccessIndex--;
      }
    }
  }

  getEntryAt(index: number): BufferEntry | null {
    if (index >= 0 && index < this.buffer.length) {
      this.lastAccessIndex = index;
      return this.buffer[index];
    }
    return null;
  }

  getLatestEntry(): BufferEntry | null {
    if (this.buffer.length > 0) {
      this.lastAccessIndex = this.buffer.length - 1;
      return this.buffer[this.buffer.length - 1];
    }
    return null;
  }

  getLastAccessedEntry(): BufferEntry | null {
    if (this.lastAccessIndex >= 0 && this.lastAccessIndex < this.buffer.length) {
      return this.buffer[this.lastAccessIndex];
    }
    return null;
  }

  getValues(): number[] {
    return this.buffer.map(entry => entry.value);
  }

  getTimestamps(): number[] {
    return this.buffer.map(entry => entry.timestamp);
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

  getValueRange(): { min: number, max: number } {
    if (this.buffer.length === 0) return { min: 0, max: 0 };
    const values = this.buffer.map(entry => entry.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  getRecentValues(count: number): number[] {
    if (count <= 0 || this.buffer.length === 0) return [];
    const startIndex = Math.max(0, this.buffer.length - count);
    return this.buffer.slice(startIndex).map(entry => entry.value);
  }

  getRecentEntries(count: number): BufferEntry[] {
    if (count <= 0 || this.buffer.length === 0) return [];
    const startIndex = Math.max(0, this.buffer.length - count);
    return this.buffer.slice(startIndex);
  }

  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  isFull(): boolean {
    return this.buffer.length >= this.maxSize;
  }
}
