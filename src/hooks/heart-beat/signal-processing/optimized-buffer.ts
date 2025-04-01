
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Buffer circular optimizado para datos de PPG
 */

/**
 * Buffer circular optimizado para datos de PPG
 * Permite almacenar datos de forma eficiente con operaciones O(1)
 */
export class OptimizedPPGBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  /**
   * Crea un nuevo buffer circular
   */
  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
    this.buffer = new Array<T>(this.capacity);
  }

  /**
   * Añade un elemento al buffer
   */
  public push(item: T): void {
    this.buffer[this.tail] = item;
    
    if (this.count === this.capacity) {
      // Buffer lleno, avanzar head
      this.head = (this.head + 1) % this.capacity;
    } else {
      // Buffer no lleno, incrementar contador
      this.count++;
    }
    
    // Avanzar tail
    this.tail = (this.tail + 1) % this.capacity;
  }

  /**
   * Obtiene el tamaño actual del buffer
   */
  public size(): number {
    return this.count;
  }

  /**
   * Obtiene el elemento en la posición index
   */
  public get(index: number): T {
    if (index < 0 || index >= this.count) {
      throw new Error(`Index ${index} out of bounds [0..${this.count - 1}]`);
    }
    
    const actualIndex = (this.head + index) % this.capacity;
    return this.buffer[actualIndex];
  }

  /**
   * Obtiene los últimos n elementos
   */
  public getLastN(n: number): T[] {
    const count = Math.min(n, this.count);
    const result: T[] = [];
    
    for (let i = this.count - count; i < this.count; i++) {
      result.push(this.get(i));
    }
    
    return result;
  }

  /**
   * Obtiene todos los valores actuales
   */
  public getValues(): number[] {
    if (this.count === 0) return [];
    
    // Extraer valores asumiendo que T tiene una propiedad value
    const result: number[] = [];
    
    for (let i = 0; i < this.count; i++) {
      const item = this.get(i) as any;
      result.push(item.value);
    }
    
    return result;
  }

  /**
   * Limpia el buffer
   */
  public clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.buffer = new Array<T>(this.capacity);
  }
}
