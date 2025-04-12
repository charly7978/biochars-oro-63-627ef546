import { DataPoint } from '@/core/types';

/** @deprecated Use DataPoint from '@/core/types' */
// export interface PPGDataPoint {
//   time: number;
//   value: number;
// }

// Usar DataPoint como tipo genérico por defecto
export class CircularBuffer<T extends DataPoint = DataPoint> {
  private buffer: T[];
  private capacity: number;
  private index: number; // Índice donde se insertará el próximo elemento
  private count: number; // Número actual de elementos en el buffer

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be positive.");
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.index = 0;
    this.count = 0;
  }

  /** Añade un item al buffer, sobreescribiendo el más antiguo si está lleno */
  public push(item: T): void {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** Obtiene un item por su índice relativo al más reciente (0 = más reciente, 1 = segundo más reciente, etc.) */
  public get(relativeIndex: number): T | undefined {
    if (relativeIndex < 0 || relativeIndex >= this.count) {
      return undefined; // Índice fuera de rango
    }
    // Calcula el índice real en el array circular
    const actualIndex = (this.index - 1 - relativeIndex + this.capacity) % this.capacity;
    return this.buffer[actualIndex];
  }

  /** Devuelve todos los puntos válidos en orden cronológico (del más antiguo al más reciente) */
  public getPoints(): T[] {
    const result: T[] = [];
    if (this.count === 0) {
      return result;
    }

    const startIndex = (this.index - this.count + this.capacity) % this.capacity;

    for (let i = 0; i < this.count; i++) {
        const currentIndex = (startIndex + i) % this.capacity;
        // Asegurarse de que el elemento no sea undefined (aunque no debería serlo si count es correcto)
        if (this.buffer[currentIndex] !== undefined) {
           result.push(this.buffer[currentIndex]);
        }
    }
    return result;
  }

  /** Limpia el buffer */
  public clear(): void {
    this.buffer = new Array(this.capacity); // Crea un nuevo array vacío
    this.index = 0;
    this.count = 0;
  }

  /** Devuelve el número actual de elementos en el buffer */
  public size(): number {
    return this.count;
  }

  /** Comprueba si el buffer está vacío */
  public isEmpty(): boolean {
    return this.count === 0;
  }

  /** Comprueba si el buffer está lleno */
  public isFull(): boolean {
      return this.count === this.capacity;
  }

  /** Devuelve la capacidad máxima del buffer */
  public getCapacity(): number {
      return this.capacity;
  }
}
