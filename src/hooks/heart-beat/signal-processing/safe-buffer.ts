
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Thread-safe buffer implementation for signal processing
 */

// Define signal data shape clearly to fix type issues
export interface SafeSignalDataPoint {
  value: number;
  timestamp: number;
  time: number;
  quality?: number;
}

/**
 * Thread-safe circular buffer for signal data
 */
export class SafeBuffer<T extends SafeSignalDataPoint> {
  private buffer: T[];
  private capacity: number;
  private size: number = 0;
  private head: number = 0;
  private tail: number = 0;
  private mutex: boolean = false;
  
  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }
  
  /**
   * Acquire the mutex
   */
  private acquire(): boolean {
    if (this.mutex) return false;
    this.mutex = true;
    return true;
  }
  
  /**
   * Release the mutex
   */
  private release(): void {
    this.mutex = false;
  }
  
  /**
   * Safely add an item to the buffer
   */
  push(item: T): boolean {
    if (!this.acquire()) return false;
    
    try {
      this.buffer[this.tail] = item;
      this.tail = (this.tail + 1) % this.capacity;
      
      if (this.size < this.capacity) {
        this.size++;
      } else {
        this.head = (this.head + 1) % this.capacity;
      }
      
      return true;
    } finally {
      this.release();
    }
  }
  
  /**
   * Safely get all items from the buffer
   */
  getAll(): T[] {
    if (!this.acquire()) return [];
    
    try {
      const result = new Array<T>(this.size);
      
      for (let i = 0; i < this.size; i++) {
        const pos = (this.head + i) % this.capacity;
        result[i] = this.buffer[pos];
      }
      
      return result;
    } finally {
      this.release();
    }
  }
  
  /**
   * Safely clear the buffer
   */
  clear(): boolean {
    if (!this.acquire()) return false;
    
    try {
      this.head = 0;
      this.tail = 0;
      this.size = 0;
      return true;
    } finally {
      this.release();
    }
  }
  
  /**
   * Get the current size of the buffer
   */
  getSize(): number {
    // No need for mutex for just reading size
    return this.size;
  }
  
  /**
   * Get the most recent item safely
   */
  getLast(): T | null {
    if (!this.acquire()) return null;
    
    try {
      if (this.size === 0) return null;
      const pos = (this.tail - 1 + this.capacity) % this.capacity;
      return this.buffer[pos];
    } finally {
      this.release();
    }
  }
}
