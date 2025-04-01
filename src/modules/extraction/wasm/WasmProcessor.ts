
/**
 * Interfaz para procesador WASM optimizado
 */

export interface WasmProcessor {
  initialize(): Promise<boolean>;
  applyKalmanFilter(values: number[], q: number, r: number): number[];
  findPeaks(values: number[], minDistance: number, threshold: number): number[];
  calculateStats(values: number[]): {
    mean: number;
    variance: number;
    min: number;
    max: number;
  };
  processSIMD(values: number[], operation: number, param: number): number[];
}

// Instancia singleton
let wasmProcessorInstance: WasmProcessor | null = null;

/**
 * Obtiene instancia singleton del procesador WASM
 */
export function getWasmProcessor(): WasmProcessor {
  if (!wasmProcessorInstance) {
    wasmProcessorInstance = createWasmProcessor();
  }
  return wasmProcessorInstance;
}

/**
 * Crea un procesador WASM
 */
export function createWasmProcessor(): WasmProcessor {
  // Definir estado interno
  let wasmModule: WebAssembly.Module | null = null;
  let wasmInstance: WebAssembly.Instance | null = null;
  let isInitialized = false;
  let memory: WebAssembly.Memory | null = null;
  
  return {
    /**
     * Inicializa el procesador WASM
     */
    async initialize(): Promise<boolean> {
      if (isInitialized) return true;
      
      try {
        // Crear memoria compartida para WebAssembly
        memory = new WebAssembly.Memory({
          initial: 2,  // 2 páginas iniciales (128KB)
          maximum: 16, // Máximo 16 páginas (1MB)
          shared: true // Permite multithreading
        });
        
        // Intentar cargar desde URL primero
        try {
          const response = await fetch('/assets/signal-processor.wasm');
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            wasmModule = await WebAssembly.compile(buffer);
          }
        } catch (error) {
          console.warn('Error cargando WASM, usando fallback:', error);
        }
        
        // Si no se pudo cargar desde URL, usar versión embebida 
        if (!wasmModule) {
          // Cargar desde script con fallback
          if (typeof window !== 'undefined' && 'wasmInstance' in window) {
            // @ts-ignore
            wasmModule = await window.wasmInstance.fetchWasmModule();
          } else {
            throw new Error('No se pudo cargar el módulo WASM');
          }
        }
        
        // Instanciar módulo
        wasmInstance = await WebAssembly.instantiate(wasmModule, {
          env: {
            memory,
            performance_now: () => performance.now(),
            abort: (_msg: number, _file: number, line: number, column: number) => {
              console.error(`WASM abortado en línea ${line}:${column}`);
            }
          }
        });
        
        isInitialized = true;
        console.log('WasmProcessor: Inicializado correctamente');
        return true;
      } catch (error) {
        console.error('WasmProcessor: Error inicializando', error);
        isInitialized = false;
        return false;
      }
    },
    
    /**
     * Aplica filtro Kalman optimizado con WASM
     */
    applyKalmanFilter(values: number[], q: number, r: number): number[] {
      if (!isInitialized || !wasmInstance || !memory) {
        console.warn('WasmProcessor: No inicializado, devolviendo valores sin filtrar');
        return [...values];
      }
      
      try {
        const { exports } = wasmInstance;
        const filterSignal = exports.filterSignal as Function;
        
        // Copiar datos a memoria WASM
        const inputArray = new Float32Array(memory.buffer, 0, values.length);
        values.forEach((v, i) => inputArray[i] = v);
        
        // Llamar a función WASM
        const resultPtr = filterSignal(0, values.length, q, r);
        
        // Leer resultados
        const result = new Float32Array(memory.buffer, resultPtr, values.length);
        
        // Devolver copia para evitar problemas de memoria
        return Array.from(result);
      } catch (error) {
        console.error('WasmProcessor: Error en filtro Kalman', error);
        return [...values];
      }
    },
    
    /**
     * Encuentra picos en señal con optimización WASM
     */
    findPeaks(values: number[], minDistance: number, threshold: number): number[] {
      if (!isInitialized || !wasmInstance || !memory) {
        console.warn('WasmProcessor: No inicializado, detectando picos con JS');
        return [];
      }
      
      try {
        const { exports } = wasmInstance;
        const detectPeaks = exports.detectPeaks as Function;
        
        // Copiar datos a memoria WASM
        const inputArray = new Float32Array(memory.buffer, 0, values.length);
        values.forEach((v, i) => inputArray[i] = v);
        
        // Llamar a función WASM
        const resultPtr = detectPeaks(0, values.length, threshold, minDistance);
        
        // Leer número de picos
        const resultView = new Int32Array(memory.buffer, resultPtr, 1);
        const peakCount = resultView[0];
        
        // Leer posiciones de picos
        const peakPositions = new Int32Array(memory.buffer, resultPtr + 4, peakCount);
        
        // Devolver copia para evitar problemas de memoria
        return Array.from(peakPositions);
      } catch (error) {
        console.error('WasmProcessor: Error detectando picos', error);
        return [];
      }
    },
    
    /**
     * Calcula estadísticas con optimización WASM
     */
    calculateStats(values: number[]): { mean: number; variance: number; min: number; max: number; } {
      if (!isInitialized || !wasmInstance || !memory) {
        // Fallback en JS
        let sum = 0;
        let sum2 = 0;
        let min = values[0] || 0;
        let max = values[0] || 0;
        
        for (const v of values) {
          sum += v;
          sum2 += v * v;
          if (v < min) min = v;
          if (v > max) max = v;
        }
        
        const mean = values.length > 0 ? sum / values.length : 0;
        const variance = values.length > 0 ? (sum2 / values.length) - (mean * mean) : 0;
        
        return { mean, variance, min, max };
      }
      
      try {
        const { exports } = wasmInstance;
        const calculateStats = exports.calculateStats as Function;
        
        // Copiar datos a memoria WASM
        const inputArray = new Float32Array(memory.buffer, 0, values.length);
        values.forEach((v, i) => inputArray[i] = v);
        
        // Llamar a función WASM
        const resultPtr = calculateStats(0, values.length);
        
        // Leer estadísticas
        const stats = new Float32Array(memory.buffer, resultPtr, 4);
        
        return {
          mean: stats[0],
          variance: stats[1],
          min: stats[2],
          max: stats[3]
        };
      } catch (error) {
        console.error('WasmProcessor: Error calculando estadísticas', error);
        return { mean: 0, variance: 0, min: 0, max: 0 };
      }
    },
    
    /**
     * Procesa señal con operaciones SIMD
     */
    processSIMD(values: number[], operation: number, param: number): number[] {
      if (!isInitialized || !wasmInstance || !memory) {
        console.warn('WasmProcessor: No inicializado, procesando con JS');
        return [...values];
      }
      
      try {
        const { exports } = wasmInstance;
        const processSIMD = exports.processSIMD as Function;
        
        // Copiar datos a memoria WASM
        const inputArray = new Float32Array(memory.buffer, 0, values.length);
        values.forEach((v, i) => inputArray[i] = v);
        
        // Llamar a función WASM
        const resultPtr = processSIMD(0, values.length, operation, param);
        
        // Leer resultados
        const result = new Float32Array(memory.buffer, resultPtr, values.length);
        
        // Devolver copia para evitar problemas de memoria
        return Array.from(result);
      } catch (error) {
        console.error('WasmProcessor: Error en procesamiento SIMD', error);
        return [...values];
      }
    }
  };
}
