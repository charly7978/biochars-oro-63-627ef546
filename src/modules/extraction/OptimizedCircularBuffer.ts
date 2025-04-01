
/**
 * Buffer circular optimizado para procesamiento de señales PPG
 * Mejora el rendimiento y reduce la presión sobre el recolector de basura
 */

import { PPGDataPoint, TimestampedPPGData } from '../../types/signal';

/**
 * Buffer circular optimizado para datos PPG
 * Implementa un buffer de tamaño fijo preasignado en memoria
 */
export class OptimizedCircularBuffer<T extends TimestampedPPGData = TimestampedPPGData> {
  private buffer: Array<T | null>;
  private head: number = 0;
  private tail: number = 0;
  private _size: number = 0;
  private readonly capacity: number;
  
  /**
   * Constructor del buffer optimizado
   * @param capacity Capacidad máxima del buffer
   */
  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('La capacidad del buffer debe ser mayor que cero');
    }
    
    // Preasignar el array completo
    this.buffer = new Array<T | null>(capacity).fill(null);
    this.capacity = capacity;
  }
  
  /**
   * Añade un dato al buffer
   * Si el buffer está lleno, sobrescribe el dato más antiguo
   */
  public push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    
    if (this._size === this.capacity) {
      this.tail = (this.tail + 1) % this.capacity;
    } else {
      this._size++;
    }
  }
  
  /**
   * Obtiene un elemento en una posición específica
   * @param index Índice relativo al elemento más antiguo (0 es el más antiguo)
   */
  public get(index: number): T | null {
    if (index < 0 || index >= this._size) {
      return null;
    }
    
    const actualIndex = (this.tail + index) % this.capacity;
    return this.buffer[actualIndex];
  }
  
  /**
   * Obtiene todos los elementos válidos del buffer como un array
   */
  public getPoints(): T[] {
    const result: T[] = [];
    let current = this.tail;
    
    for (let i = 0; i < this._size; i++) {
      const item = this.buffer[current];
      if (item !== null) {
        result.push(item);
      }
      current = (current + 1) % this.capacity;
    }
    
    return result;
  }
  
  /**
   * Limpia el buffer
   */
  public clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
    this._size = 0;
  }
  
  /**
   * Retorna el número de elementos en el buffer
   */
  public size(): number {
    return this._size;
  }
  
  /**
   * Comprueba si el buffer está vacío
   */
  public isEmpty(): boolean {
    return this._size === 0;
  }
  
  /**
   * Comprueba si el buffer está lleno
   */
  public isFull(): boolean {
    return this._size === this.capacity;
  }
  
  /**
   * Obtiene la capacidad del buffer
   */
  public getCapacity(): number {
    return this.capacity;
  }
  
  /**
   * Obtiene los valores de los datos en el buffer como un array
   */
  public getValues(): number[] {
    return this.getPoints().map(point => point.value);
  }
  
  /**
   * Obtiene los últimos N elementos del buffer
   */
  public getLastN(n: number): T[] {
    const count = Math.min(n, this._size);
    const result: T[] = [];
    
    for (let i = 0; i < count; i++) {
      const index = (this.head - 1 - i + this.capacity) % this.capacity;
      const item = this.buffer[index];
      if (item !== null) {
        result.unshift(item); // Añadir al principio para mantener el orden
      }
    }
    
    return result;
  }
  
  /**
   * Crea un buffer optimizado a partir de un buffer circular estándar
   * @param circularBuffer Buffer circular estándar
   */
  public static fromCircularBuffer<U extends TimestampedPPGData>(circularBuffer: any): OptimizedCircularBuffer<U> {
    const points = circularBuffer.getPoints ? circularBuffer.getPoints() : [];
    const optimizedBuffer = new OptimizedCircularBuffer<U>(Math.max(points.length, 10));
    
    // Transferir los datos al nuevo buffer
    points.forEach((point: U) => {
      // Ensure point has time property if needed
      const enhancedPoint = {...point} as U & { time: number; timestamp: number };
      if (!('time' in enhancedPoint) && 'timestamp' in enhancedPoint) {
        enhancedPoint.time = enhancedPoint.timestamp;
      }
      optimizedBuffer.push(enhancedPoint as U);
    });
    
    return optimizedBuffer;
  }
  
  /**
   * Transfiere los datos del buffer a un ArrayBuffer para transferencia eficiente
   * Implementa el patrón Transferable Objects para mejorar rendimiento
   */
  public toTransferable(): { buffer: ArrayBuffer, metadata: { head: number, tail: number, size: number, capacity: number } } {
    const points = this.getPoints();
    
    // Crear un buffer tipado para la transferencia
    const bufferSize = points.length * 2; // 2 valores por punto (timestamp y value)
    const buffer = new ArrayBuffer(bufferSize * Float64Array.BYTES_PER_ELEMENT);
    const view = new Float64Array(buffer);
    
    // Llenar el buffer con los datos
    points.forEach((point, i) => {
      view[i * 2] = point.timestamp;
      view[i * 2 + 1] = point.value;
    });
    
    // Devolver el buffer y metadata para reconstrucción
    return {
      buffer,
      metadata: {
        head: this.head,
        tail: this.tail,
        size: this._size,
        capacity: this.capacity
      }
    };
  }
  
  /**
   * Crea un buffer a partir de un ArrayBuffer transferido
   */
  public static fromTransferable<T extends TimestampedPPGData>(
    buffer: ArrayBuffer, 
    metadata: { head: number, tail: number, size: number, capacity: number }
  ): OptimizedCircularBuffer<T> {
    const view = new Float64Array(buffer);
    const result = new OptimizedCircularBuffer<T>(metadata.capacity);
    
    // Reconstruir el estado
    result.head = metadata.head;
    result.tail = metadata.tail;
    result._size = metadata.size;
    
    // Llenar el buffer con los datos del ArrayBuffer
    for (let i = 0; i < view.length / 2; i++) {
      const point = {
        timestamp: view[i * 2],
        value: view[i * 2 + 1],
        time: view[i * 2] // Add time property to satisfy PPGDataPoint constraint
      } as T;
      
      const index = (result.tail + i) % result.capacity;
      result.buffer[index] = point;
    }
    
    return result;
  }
}
