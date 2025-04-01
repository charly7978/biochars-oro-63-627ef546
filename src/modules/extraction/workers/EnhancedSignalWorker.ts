
/**
 * Worker mejorado para procesamiento de señales con optimizaciones
 */
import { WorkerTaskConfig, WorkerProcessingResult } from '../types/processing';

// Tipos de mensajes para el worker
export enum WorkerMessageType {
  INITIALIZE = 'initialize',
  PROCESS_SIGNAL = 'process_signal',
  PROCESS_BATCH = 'process_batch',
  APPLY_FILTER = 'apply_filter',
  DETECT_PEAKS = 'detect_peaks',
  RESULT = 'result',
  ERROR = 'error'
}

// Interfaz para mensajes del worker
export interface WorkerMessage {
  type: WorkerMessageType;
  data?: any;
  requestId?: string;
}

/**
 * Clase EnhancedSignalWorker: Gestiona un worker para procesamiento optimizado
 */
export class EnhancedSignalWorker {
  private worker: Worker | null = null;
  private isInitialized: boolean = false;
  private pendingRequests: Map<string, { 
    resolve: (value: any) => void, 
    reject: (reason: any) => void,
    timeout: number | null
  }> = new Map();
  
  // Configuración por defecto
  private config: WorkerTaskConfig = {
    timeout: 5000,
    priority: 'normal',
    processingMode: 'async',
    useWasm: true,
    useML: false
  };
  
  /**
   * Constructor
   * @param workerUrl URL del script del worker
   * @param config Configuración opcional
   */
  constructor(private workerUrl: string, config?: Partial<WorkerTaskConfig>) {
    this.config = { ...this.config, ...config };
    this.setupWorker();
  }
  
  /**
   * Configura el worker
   */
  private setupWorker(): void {
    try {
      // Crear instancia del worker
      this.worker = new Worker(this.workerUrl, { type: 'module' });
      
      // Configurar manejador de mensajes
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      
      // Configurar manejador de errores
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      console.log('[EnhancedSignalWorker] Worker creado correctamente');
    } catch (error) {
      console.error('[EnhancedSignalWorker] Error creando worker:', error);
      this.worker = null;
    }
  }
  
  /**
   * Maneja mensajes recibidos del worker
   */
  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const message = event.data;
    
    if (!message || !message.type) {
      console.warn('[EnhancedSignalWorker] Mensaje recibido inválido:', message);
      return;
    }
    
    // Procesar mensaje según su tipo
    switch (message.type) {
      case WorkerMessageType.RESULT:
        this.resolveRequest(message.requestId!, message.data);
        break;
        
      case WorkerMessageType.ERROR:
        this.rejectRequest(message.requestId!, new Error(message.data?.error || 'Error desconocido'));
        break;
        
      default:
        console.warn('[EnhancedSignalWorker] Tipo de mensaje desconocido:', message.type);
    }
  }
  
  /**
   * Maneja errores del worker
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('[EnhancedSignalWorker] Error en worker:', error);
    
    // Rechazar todas las solicitudes pendientes
    this.pendingRequests.forEach((request, id) => {
      this.rejectRequest(id, new Error(`Error en worker: ${error.message}`));
    });
    
    // Reiniciar el worker
    this.restartWorker();
  }
  
  /**
   * Reinicia el worker
   */
  private restartWorker(): void {
    console.log('[EnhancedSignalWorker] Reiniciando worker...');
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.isInitialized = false;
    this.setupWorker();
  }
  
  /**
   * Envía un mensaje al worker
   */
  private sendMessage(type: WorkerMessageType, data?: any): Promise<any> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker no disponible'));
    }
    
    // Generar ID único para esta solicitud
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Crear promesa para esta solicitud
    const promise = new Promise<any>((resolve, reject) => {
      // Configurar timeout si es necesario
      let timeoutId: number | null = null;
      
      if (this.config.timeout && this.config.timeout > 0) {
        timeoutId = window.setTimeout(() => {
          this.rejectRequest(requestId, new Error(`Timeout de ${this.config.timeout}ms excedido`));
        }, this.config.timeout);
      }
      
      // Almacenar callbacks y timeout
      this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutId });
    });
    
    // Enviar mensaje al worker
    const message: WorkerMessage = { type, data, requestId };
    this.worker.postMessage(message);
    
    return promise;
  }
  
  /**
   * Resuelve una solicitud pendiente
   */
  private resolveRequest(requestId: string, data: any): void {
    const request = this.pendingRequests.get(requestId);
    
    if (request) {
      // Limpiar timeout si existe
      if (request.timeout !== null) {
        clearTimeout(request.timeout);
      }
      
      // Resolver promesa
      request.resolve(data);
      
      // Eliminar solicitud de pendientes
      this.pendingRequests.delete(requestId);
    }
  }
  
  /**
   * Rechaza una solicitud pendiente
   */
  private rejectRequest(requestId: string, reason: any): void {
    const request = this.pendingRequests.get(requestId);
    
    if (request) {
      // Limpiar timeout si existe
      if (request.timeout !== null) {
        clearTimeout(request.timeout);
      }
      
      // Rechazar promesa
      request.reject(reason);
      
      // Eliminar solicitud de pendientes
      this.pendingRequests.delete(requestId);
    }
  }
  
  /**
   * Inicializa el worker
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }
    
    try {
      // Enviar mensaje de inicialización
      const result = await this.sendMessage(WorkerMessageType.INITIALIZE, {
        useWasm: this.config.useWasm,
        useML: this.config.useML
      });
      
      this.isInitialized = result?.success === true;
      console.log(`[EnhancedSignalWorker] Inicialización ${this.isInitialized ? 'completada' : 'fallida'}`);
      
      return this.isInitialized;
    } catch (error) {
      console.error('[EnhancedSignalWorker] Error inicializando worker:', error);
      this.isInitialized = false;
      return false;
    }
  }
  
  /**
   * Procesa un valor de señal
   */
  async processSignal(value: number): Promise<WorkerProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = performance.now();
    
    try {
      const result = await this.sendMessage(WorkerMessageType.PROCESS_SIGNAL, { value });
      
      return {
        success: true,
        data: result?.processed !== undefined ? result : { processed: value },
        processingTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        data: { processed: value },
        processingTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Procesa un lote de valores de señal
   */
  async processBatch(values: number[]): Promise<WorkerProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = performance.now();
    
    try {
      const result = await this.sendMessage(WorkerMessageType.PROCESS_BATCH, { values });
      
      return {
        success: true,
        data: result || { processed: values },
        processingTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        data: { processed: values },
        processingTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Aplica un filtro a los valores
   */
  async applyFilter(values: number[], filterType: string): Promise<WorkerProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = performance.now();
    
    try {
      const result = await this.sendMessage(WorkerMessageType.APPLY_FILTER, { 
        values, 
        filterType 
      });
      
      return {
        success: true,
        data: result || { filtered: values },
        processingTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        data: { filtered: values },
        processingTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Detecta picos en la señal
   */
  async detectPeaks(values: number[], options?: { 
    minDistance?: number, 
    threshold?: number 
  }): Promise<WorkerProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = performance.now();
    
    try {
      const result = await this.sendMessage(WorkerMessageType.DETECT_PEAKS, { 
        values, 
        minDistance: options?.minDistance || 5,
        threshold: options?.threshold || 0.5
      });
      
      return {
        success: true,
        data: result || { peaks: [] },
        processingTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        data: { peaks: [] },
        processingTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Libera recursos
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    // Rechazar todas las solicitudes pendientes
    this.pendingRequests.forEach((request, id) => {
      this.rejectRequest(id, new Error('Worker terminado'));
    });
    
    this.isInitialized = false;
  }
}

/**
 * Crea una instancia de EnhancedSignalWorker
 */
export function createEnhancedSignalWorker(
  workerUrl: string,
  config?: Partial<WorkerTaskConfig>
): EnhancedSignalWorker {
  return new EnhancedSignalWorker(workerUrl, config);
}
