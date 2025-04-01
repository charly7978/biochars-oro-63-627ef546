
/**
 * Worker mejorado para procesamiento de señales en segundo plano
 */
import { WorkerProcessingResult } from '../types/processing';

// Identificadores de operaciones
enum WorkerOperation {
  INITIALIZE = 'initialize',
  PROCESS_SIGNAL = 'process_signal',
  PROCESS_BATCH = 'process_batch',
  APPLY_FILTER = 'apply_filter',
  DETECT_PEAKS = 'detect_peaks',
  CALCULATE_STATS = 'calculate_stats',
  TERMINATE = 'terminate'
}

// Interfaces para mensajes
interface WorkerMessage {
  id: string;
  operation: WorkerOperation;
  data?: any;
  options?: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Clase para gestionar worker de procesamiento mejorado
 */
export class EnhancedSignalWorker {
  private worker: Worker | null = null;
  private isInitialized: boolean = false;
  private operationPromises: Map<string, { 
    resolve: (value: any) => void, 
    reject: (reason: any) => void,
    timeout: NodeJS.Timeout 
  }> = new Map();
  private operationCounter: number = 0;
  private workerUrl: string;
  private options: WorkerOptions;
  
  constructor(workerUrl: string, options: WorkerOptions = {}) {
    this.workerUrl = workerUrl;
    this.options = {
      timeout: 5000,
      useWasm: true,
      ...options
    };
  }
  
  /**
   * Inicializa el worker
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      // Crear el worker
      this.worker = new Worker(this.workerUrl);
      
      // Configurar evento de mensaje
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      
      // Configurar evento de error
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      // Enviar mensaje de inicialización
      const initResult = await this.sendMessage(WorkerOperation.INITIALIZE, {
        useWasm: this.options.useWasm,
        config: this.options
      });
      
      this.isInitialized = initResult.success;
      return this.isInitialized;
    } catch (error) {
      console.error('EnhancedSignalWorker: Error inicializando worker', error);
      this.isInitialized = false;
      return false;
    }
  }
  
  /**
   * Procesa un único valor de señal
   */
  public async processSignal(value: number): Promise<WorkerProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const result = await this.sendMessage(WorkerOperation.PROCESS_SIGNAL, { value });
    
    return {
      success: result.success,
      error: result.error,
      data: result.data || {}
    };
  }
  
  /**
   * Procesa un lote de valores
   */
  public async processBatch(values: number[]): Promise<WorkerProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const result = await this.sendMessage(WorkerOperation.PROCESS_BATCH, { values });
    
    return {
      success: result.success,
      error: result.error,
      data: result.data || {}
    };
  }
  
  /**
   * Aplica un filtro a un array de valores
   */
  public async applyFilter(values: number[], filterType: string = 'kalman'): Promise<WorkerProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const result = await this.sendMessage(WorkerOperation.APPLY_FILTER, { 
      values, 
      filterType 
    });
    
    return {
      success: result.success,
      error: result.error,
      data: result.data || {}
    };
  }
  
  /**
   * Detecta picos en un array de valores
   */
  public async detectPeaks(values: number[], options: { 
    minDistance?: number, 
    threshold?: number 
  } = {}): Promise<WorkerProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const result = await this.sendMessage(WorkerOperation.DETECT_PEAKS, { 
      values, 
      minDistance: options.minDistance || 5,
      threshold: options.threshold || 0.5
    });
    
    return {
      success: result.success,
      error: result.error,
      data: result.data || {}
    };
  }
  
  /**
   * Calcula estadísticas para un array de valores
   */
  public async calculateStats(values: number[]): Promise<WorkerProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const result = await this.sendMessage(WorkerOperation.CALCULATE_STATS, { values });
    
    return {
      success: result.success,
      error: result.error,
      data: result.data || {}
    };
  }
  
  /**
   * Libera recursos del worker
   */
  public dispose(): void {
    if (this.worker) {
      // Cancelar todas las operaciones pendientes
      this.operationPromises.forEach((promise, id) => {
        clearTimeout(promise.timeout);
        promise.reject(new Error('Worker disposed'));
        this.operationPromises.delete(id);
      });
      
      // Terminar worker
      this.worker.terminate();
      this.worker = null;
    }
    
    this.isInitialized = false;
  }
  
  /**
   * Envía un mensaje al worker y espera respuesta
   */
  private sendMessage(operation: WorkerOperation, data?: any): Promise<WorkerResponse> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker no inicializado'));
    }
    
    return new Promise((resolve, reject) => {
      // Generar ID único para esta operación
      const id = `op_${Date.now()}_${this.operationCounter++}`;
      
      // Crear timeout para esta operación
      const timeout = setTimeout(() => {
        if (this.operationPromises.has(id)) {
          this.operationPromises.delete(id);
          reject(new Error(`Timeout en operación ${operation}`));
        }
      }, this.options.timeout);
      
      // Guardar promesa para resolverla cuando llegue la respuesta
      this.operationPromises.set(id, { resolve, reject, timeout });
      
      // Enviar mensaje al worker
      const message: WorkerMessage = {
        id,
        operation,
        data
      };
      
      this.worker.postMessage(message);
    });
  }
  
  /**
   * Maneja mensajes recibidos del worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const response = event.data as WorkerResponse;
    const { id, success, data, error } = response;
    
    // Buscar promesa asociada a este ID
    const promiseData = this.operationPromises.get(id);
    if (promiseData) {
      const { resolve, reject, timeout } = promiseData;
      
      // Cancelar timeout
      clearTimeout(timeout);
      
      // Resolver o rechazar promesa
      if (success) {
        resolve({ success, data });
      } else {
        reject(new Error(error || 'Error desconocido en worker'));
      }
      
      // Eliminar promesa
      this.operationPromises.delete(id);
    }
  }
  
  /**
   * Maneja errores del worker
   */
  private handleWorkerError(event: ErrorEvent): void {
    console.error('EnhancedSignalWorker: Error en worker', event);
    
    // Rechazar todas las promesas pendientes
    this.operationPromises.forEach((promise, id) => {
      clearTimeout(promise.timeout);
      promise.reject(new Error(`Error en worker: ${event.message}`));
      this.operationPromises.delete(id);
    });
  }
}

/**
 * Opciones para worker de señal
 */
export interface WorkerOptions {
  timeout?: number;       // Timeout en ms para operaciones
  useWasm?: boolean;      // Usar aceleración WASM
  batchSize?: number;     // Tamaño de lotes para procesamiento
  workerPoolSize?: number; // Número de workers en pool
}

/**
 * Crea un worker para procesamiento de señal
 */
export function createEnhancedSignalWorker(
  workerUrl: string,
  options?: WorkerOptions
): EnhancedSignalWorker {
  return new EnhancedSignalWorker(workerUrl, options);
}
