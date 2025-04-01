
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Buffer circular optimizado para el módulo de extracción
 * Reduce la presión sobre el recolector de basura y mejora el rendimiento en tiempo real
 */

/**
 * Interfaz para elementos con timestamp
 */
export interface TimestampedData {
  timestamp: number;
  [key: string]: any;
}

/**
 * Buffer circular optimizado para datos de señal
 * Preasigna la memoria y evita creaciones/destrucciones continuas de arrays
 */
export class OptimizedCircularBuffer<T extends TimestampedData = TimestampedData> {
  private buffer: Array<T | null>;
  private head: number = 0;
  private tail: number = 0;
  private _size: number = 0;
  private readonly capacity: number;
  
  /**
   * Constructor del buffer circular
   * @param capacity Tamaño máximo del buffer
   */
  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('La capacidad del buffer debe ser mayor que cero');
    }
    
    // Preasignar el array completo con valores null
    this.buffer = new Array<T | null>(capacity).fill(null);
    this.capacity = capacity;
  }
  
  /**
   * Añade un elemento al buffer
   * Sobrescribe el elemento más antiguo si el buffer está lleno
   */
  public push(item: T): void {
    // Almacenar el elemento en la posición actual del head
    this.buffer[this.head] = item;
    
    // Actualizar el head
    this.head = (this.head + 1) % this.capacity;
    
    // Si el buffer está lleno, mover también el tail
    if (this._size === this.capacity) {
      this.tail = (this.tail + 1) % this.capacity;
    } else {
      // Incrementar el tamaño si aún no está lleno
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
  public getItems(): T[] {
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
   * Ejecuta una función para cada elemento del buffer
   */
  public forEach(callback: (item: T, index: number) => void): void {
    let current = this.tail;
    
    for (let i = 0; i < this._size; i++) {
      const item = this.buffer[current];
      if (item !== null) {
        callback(item, i);
      }
      current = (current + 1) % this.capacity;
    }
  }
  
  /**
   * Transforma el buffer a un nuevo array aplicando una función
   */
  public map<U>(callback: (item: T, index: number) => U): U[] {
    const result: U[] = [];
    this.forEach((item, index) => {
      result.push(callback(item, index));
    });
    return result;
  }
  
  /**
   * Filtra los elementos del buffer según un predicado
   */
  public filter(predicate: (item: T, index: number) => boolean): T[] {
    const result: T[] = [];
    this.forEach((item, index) => {
      if (predicate(item, index)) {
        result.push(item);
      }
    });
    return result;
  }
}
