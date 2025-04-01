
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Buffer circular optimizado para procesamiento de señales PPG
 * Mejora el rendimiento y reduce la presión sobre el recolector de basura
 */

import { CircularBuffer } from '../../../utils/CircularBuffer';
import { PPGDataPoint, TimestampedPPGData } from '../../../types/signal';

/**
 * Buffer circular optimizado para datos PPG
 * Implementa un buffer de tamaño fijo preasignado en memoria
 */
export class OptimizedPPGBuffer<T extends TimestampedPPGData = TimestampedPPGData> {
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
  public static fromCircularBuffer<U extends TimestampedPPGData>(circularBuffer: CircularBuffer<U>): OptimizedPPGBuffer<U> {
    const points = circularBuffer.getPoints();
    const optimizedBuffer = new OptimizedPPGBuffer<U>(Math.max(points.length, 10));
    
    // Transferir los datos al nuevo buffer
    points.forEach(point => {
      // Ensure point has time property if needed for backward compatibility
      const enhancedPoint = {...point};
      if (!('time' in enhancedPoint) && 'timestamp' in enhancedPoint) {
        enhancedPoint.time = enhancedPoint.timestamp;
      }
      optimizedBuffer.push(enhancedPoint as U);
    });
    
    return optimizedBuffer;
  }
}

/**
 * Adaptador para compatibilidad con CircularBuffer existente
 * Permite una transición gradual al nuevo buffer optimizado
 */
export class CircularBufferAdapter<T extends TimestampedPPGData = TimestampedPPGData> extends CircularBuffer<T> {
  private optimizedBuffer: OptimizedPPGBuffer<T>;
  
  constructor(capacity: number) {
    super(capacity);
    this.optimizedBuffer = new OptimizedPPGBuffer<T>(capacity);
  }
  
  public override push(item: T): void {
    // Ensure item has time property if not present
    const enhancedItem = {...item};
    if (!('time' in enhancedItem) && 'timestamp' in enhancedItem) {
      enhancedItem.time = enhancedItem.timestamp;
    }
    
    super.push(enhancedItem as T);
    this.optimizedBuffer.push(enhancedItem as T);
  }
  
  public override get(index: number): T | undefined {
    return this.optimizedBuffer.get(index) || undefined;
  }
  
  public override getPoints(): T[] {
    return this.optimizedBuffer.getPoints();
  }
  
  public override clear(): void {
    super.clear();
    this.optimizedBuffer.clear();
  }
  
  public override size(): number {
    return this.optimizedBuffer.size();
  }
  
  public override isEmpty(): boolean {
    return this.optimizedBuffer.isEmpty();
  }
  
  /**
   * Obtiene el buffer optimizado interno
   */
  public getOptimizedBuffer(): OptimizedPPGBuffer<T> {
    return this.optimizedBuffer;
  }
}
