
/**
 * Interfaz base para los puntos de datos utilizados en el buffer circular
 */
export interface PPGDataPoint {
  time: number;  // Timestamp in milliseconds
  value: number; // Signal value
}

/**
 * Buffer circular para almacenar datos de PPG con eficiencia
 * Mantiene un número fijo de elementos, eliminando los más antiguos
 * cuando se añaden nuevos elementos y se excede la capacidad
 */
export class CircularBuffer<T extends PPGDataPoint> {
  private buffer: T[];
  private capacity: number;
  private head: number = 0;
  private size: number = 0;

  /**
   * Construye un nuevo buffer circular
   * @param capacity El número máximo de elementos que puede contener el buffer
   */
  constructor(capacity: number) {
    this.buffer = new Array<T>(capacity);
    this.capacity = capacity;
  }

  /**
   * Añade un elemento al buffer, desplazando el más antiguo si es necesario
   * @param item El elemento a añadir
   */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  /**
   * Obtiene todos los elementos actualmente en el buffer, ordenados por tiempo
   * @returns Array con todos los elementos
   */
  getPoints(): T[] {
    const result: T[] = [];
    
    if (this.size === 0) return result;
    
    // Si el buffer ha dado la vuelta completa
    if (this.size === this.capacity) {
      for (let i = 0; i < this.capacity; i++) {
        result.push(this.buffer[(this.head + i) % this.capacity]);
      }
    } else {
      // Si el buffer no ha dado la vuelta completa
      for (let i = 0; i < this.size; i++) {
        result.push(this.buffer[i]);
      }
    }
    
    // Ordenar por tiempo para garantizar el orden cronológico
    return result.sort((a, b) => a.time - b.time);
  }

  /**
   * Limpia el buffer completamente
   */
  clear(): void {
    this.buffer = new Array<T>(this.capacity);
    this.head = 0;
    this.size = 0;
  }

  /**
   * Obtiene el número de elementos actualmente en el buffer
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Comprueba si el buffer está vacío
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Comprueba si el buffer está lleno
   */
  isFull(): boolean {
    return this.size === this.capacity;
  }
}
