
/**
 * Implementación de un pool de buffers circulares para optimizar 
 * la gestión de memoria en el procesamiento de señales
 * 
 * Reutiliza arreglos para minimizar la presión sobre el garbage collector
 */

export class CircularBufferPool<T> {
  private readonly pools: Map<string, T[][]>;
  private readonly maxPoolSize: number;
  private readonly defaultBufferSize: number;
  private readonly createBuffer: (size: number) => T[];
  
  private stats = {
    bufferCreations: 0,
    bufferReuses: 0,
    poolMisses: 0,
    poolHits: 0
  };

  /**
   * Crea un nuevo pool de buffers
   * @param createBuffer Función para crear un nuevo buffer del tipo deseado
   * @param defaultBufferSize Tamaño por defecto para buffers
   * @param maxPoolSize Cantidad máxima de buffers por tamaño en el pool
   */
  constructor(
    createBuffer: (size: number) => T[],
    defaultBufferSize: number = 256,
    maxPoolSize: number = 10
  ) {
    this.pools = new Map<string, T[][]>();
    this.maxPoolSize = maxPoolSize;
    this.defaultBufferSize = defaultBufferSize;
    this.createBuffer = createBuffer;
    
    // Inicializar pools para tamaños comunes
    this.initializePool(defaultBufferSize, 5);
    this.initializePool(defaultBufferSize * 2, 3);
    this.initializePool(defaultBufferSize * 4, 2);
    
    console.log(`CircularBufferPool: Inicializado con buffers de tamaño ${defaultBufferSize}`);
  }

  /**
   * Inicializa un pool con buffers del tamaño especificado
   */
  private initializePool(size: number, count: number): void {
    const key = `buffer_${size}`;
    const buffers: T[][] = [];
    
    for (let i = 0; i < count; i++) {
      buffers.push(this.createBuffer(size));
      this.stats.bufferCreations++;
    }
    
    this.pools.set(key, buffers);
  }

  /**
   * Obtiene un buffer circular del tamaño especificado
   * Reutiliza uno existente o crea uno nuevo según sea necesario
   */
  public getBuffer(size: number = this.defaultBufferSize): T[] {
    const key = `buffer_${size}`;
    
    // Verificar si existe un pool para este tamaño
    if (!this.pools.has(key)) {
      this.pools.set(key, []);
      this.stats.poolMisses++;
    } else {
      this.stats.poolHits++;
    }
    
    const pool = this.pools.get(key)!;
    
    // Reutilizar un buffer existente si está disponible
    if (pool.length > 0) {
      const buffer = pool.pop()!;
      this.stats.bufferReuses++;
      return buffer;
    }
    
    // Crear un nuevo buffer si no hay disponibles
    this.stats.bufferCreations++;
    return this.createBuffer(size);
  }

  /**
   * Devuelve un buffer al pool para su reutilización
   */
  public releaseBuffer(buffer: T[]): void {
    const key = `buffer_${buffer.length}`;
    
    // Verificar si existe un pool para este tamaño
    if (!this.pools.has(key)) {
      this.pools.set(key, []);
    }
    
    const pool = this.pools.get(key)!;
    
    // Solo reutilizar si no excedemos el tamaño máximo del pool
    if (pool.length < this.maxPoolSize) {
      // Limpiar el buffer para evitar referencias innecesarias
      if (buffer.length > 0 && buffer[0] !== null && buffer[0] !== undefined) {
        try {
          // Intentar limpiar el buffer (depende del tipo)
          if (typeof buffer.fill === 'function') {
            (buffer as unknown as { fill: (value: any) => void }).fill(null);
          } else {
            for (let i = 0; i < buffer.length; i++) {
              buffer[i] = null as unknown as T;
            }
          }
        } catch (e) {
          // Ignorar errores al limpiar - pueden ocurrir con tipos complejos
        }
      }
      
      pool.push(buffer);
    }
  }

  /**
   * Obtiene estadísticas sobre el uso del pool
   */
  public getStats(): {
    bufferCreations: number;
    bufferReuses: number;
    poolMisses: number;
    poolHits: number;
    poolSizes: Record<string, number>;
    memoryUsageEstimate: number;
  } {
    const poolSizes: Record<string, number> = {};
    let totalBuffers = 0;
    let memoryUsageEstimate = 0;
    
    // Calcular estadísticas de cada pool
    for (const [key, pool] of this.pools.entries()) {
      poolSizes[key] = pool.length;
      totalBuffers += pool.length;
      
      // Estimar uso de memoria (aproximado)
      const bufferSize = parseInt(key.split('_')[1], 10);
      memoryUsageEstimate += pool.length * bufferSize * 8; // 8 bytes por número
    }
    
    return {
      ...this.stats,
      poolSizes,
      memoryUsageEstimate
    };
  }

  /**
   * Limpia todos los pools de buffers
   */
  public clear(): void {
    for (const [key, pool] of this.pools.entries()) {
      pool.length = 0;
    }
    
    // Forzar limpieza de memoria no utilizada
    if (typeof global !== 'undefined' && global.gc) {
      try {
        global.gc();
      } catch (e) {
        // Ignorar errores - gc puede no estar disponible
      }
    }
  }
}

// Crear instancia global para tipos comunes
export const floatBufferPool = new CircularBufferPool<number>(
  (size) => new Array(size).fill(0),
  256,
  20
);

export const objectBufferPool = new CircularBufferPool<any>(
  (size) => new Array(size).fill(null),
  128,
  10
);
