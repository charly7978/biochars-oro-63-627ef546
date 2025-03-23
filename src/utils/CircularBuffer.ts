
/**
 * Estructura de datos para un punto de datos PPG
 */
export interface PPGDataPoint {
  time: number;      // Marca de tiempo en milisegundos
  value: number;     // Valor de la señal PPG
  isArrhythmia: boolean; // Indica si este punto coincide con una arritmia detectada
}

/**
 * Buffer circular para almacenar y gestionar puntos de datos PPG
 * Mantiene un tamaño fijo y elimina los elementos más antiguos cuando se llena
 */
export class CircularBuffer {
  private buffer: PPGDataPoint[];
  private maxSize: number;

  /**
   * Crea un nuevo buffer circular
   * @param size Tamaño máximo del buffer
   */
  constructor(size: number) {
    this.buffer = [];
    this.maxSize = size;
  }

  /**
   * Agrega un nuevo punto al buffer
   * Si el buffer está lleno, elimina el punto más antiguo
   * @param point Punto de datos a agregar
   */
  push(point: PPGDataPoint): void {
    this.buffer.push(point);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  /**
   * Obtiene todos los puntos actuales en el buffer
   * @returns Copia de los puntos en el buffer
   */
  getPoints(): PPGDataPoint[] {
    return [...this.buffer];
  }

  /**
   * Vacía el buffer completamente
   */
  clear(): void {
    this.buffer = [];
  }
  
  /**
   * Obtiene el tamaño actual del buffer
   * @returns Número de elementos en el buffer
   */
  size(): number {
    return this.buffer.length;
  }
  
  /**
   * Obtiene el tamaño máximo del buffer
   * @returns Capacidad máxima del buffer
   */
  getMaxSize(): number {
    return this.maxSize;
  }
}
