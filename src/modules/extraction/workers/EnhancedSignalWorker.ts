
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Controlador optimizado para Web Workers de procesamiento de señales
 * Mejora la comunicación y gestión eficiente de procesamiento asíncrono
 */
import { getOptimizationManager } from '../optimization/OptimizationManager';

export interface WorkerTaskConfig {
  useTransferables: boolean;
  priorityLevel: 'high' | 'normal' | 'low';
  timeoutMs: number;
}

export interface WorkerProcessingResult<T> {
  result: T;
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface WorkerMessage {
  type: string;
  id: string;
  data?: any;
  transferables?: ArrayBuffer[];
  config?: Partial<WorkerTaskConfig>;
  timestamp?: number;
}

export class EnhancedSignalWorker {
  private worker: Worker | null = null;
  private pendingTasks: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    startTime: number;
    config: WorkerTaskConfig;
    timeoutId?: number;
  }> = new Map();
  private isInitialized: boolean = false;
  private workerUrl: string;
  private connectionAttempts: number = 0;
  private readonly MAX_CONNECTION_ATTEMPTS = 3;
  private processingQueue: {id: string, message: WorkerMessage}[] = [];
  private isProcessing: boolean = false;
  
  private readonly DEFAULT_CONFIG: WorkerTaskConfig = {
    useTransferables: true,
    priorityLevel: 'normal',
    timeoutMs: 5000
  };
  
  constructor(workerUrl: string = '/assets/signal.worker.js') {
    this.workerUrl = workerUrl;
  }
  
  /**
   * Inicializa el worker y establece los listeners de mensajes
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized && this.worker) return true;
    
    try {
      console.log("[EnhancedSignalWorker] Inicializando worker:", this.workerUrl);
      
      // Verificar si los workers están disponibles
      if (typeof Worker === 'undefined') {
        console.warn("[EnhancedSignalWorker] Web Workers no soportados en este navegador");
        return false;
      }
      
      // Crear instancia del worker
      this.worker = new Worker(this.workerUrl);
      
      // Configurar listeners
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      // Enviar mensaje de inicialización
      const initResult = await this.sendMessage({
        type: 'initialize',
        id: 'init-' + Date.now()
      });
      
      this.isInitialized = initResult.success;
      
      if (this.isInitialized) {
        console.log("[EnhancedSignalWorker] Worker inicializado correctamente");
        this.connectionAttempts = 0;
        
        // Procesar cola pendiente si existe
        if (this.processingQueue.length > 0) {
          console.log(`[EnhancedSignalWorker] Procesando ${this.processingQueue.length} tareas pendientes`);
          this.processNextInQueue();
        }
      } else {
        console.error("[EnhancedSignalWorker] Error inicializando worker:", initResult.error);
      }
      
      return this.isInitialized;
    } catch (error) {
      console.error("[EnhancedSignalWorker] Error fatal inicializando worker:", error);
      
      // Incrementar contador de intentos
      this.connectionAttempts++;
      
      // Reintentar si no superamos el máximo
      if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
        console.log(`[EnhancedSignalWorker] Reintentando conexión (${this.connectionAttempts}/${this.MAX_CONNECTION_ATTEMPTS})...`);
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(this.initialize());
          }, 1000 * this.connectionAttempts); // Backoff exponencial
        });
      }
      
      return false;
    }
  }
  
  /**
   * Maneja los mensajes recibidos del worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const response = event.data;
    
    if (!response || !response.id) {
      console.warn("[EnhancedSignalWorker] Mensaje sin ID recibido:", response);
      return;
    }
    
    // Buscar tarea pendiente
    const pendingTask = this.pendingTasks.get(response.id);
    
    if (!pendingTask) {
      // Es posible que sea un mensaje de broadcast o notificación
      if (response.type === 'notification' || response.type === 'broadcast') {
        console.log("[EnhancedSignalWorker] Notificación recibida:", response);
      } else {
        console.warn("[EnhancedSignalWorker] Respuesta recibida para tarea desconocida:", response.id);
      }
      return;
    }
    
    // Calcular tiempo de procesamiento
    const processingTime = Date.now() - pendingTask.startTime;
    
    // Limpiar timeout si existe
    if (pendingTask.timeoutId) {
      clearTimeout(pendingTask.timeoutId);
    }
    
    // Remover de pendientes
    this.pendingTasks.delete(response.id);
    
    // Resolver promesa
    if (response.type === 'error') {
      pendingTask.reject({
        error: response.error,
        processingTime
      });
    } else {
      pendingTask.resolve({
        ...response.result,
        processingTime,
        success: true
      });
    }
    
    // Actualizar estadísticas
    getOptimizationManager().updateStats({
      processingTime
    });
    
    // Procesar siguiente elemento en cola
    this.processNextInQueue();
  }
  
  /**
   * Maneja errores del worker
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error("[EnhancedSignalWorker] Error en worker:", error);
    
    // Rechazar todas las tareas pendientes
    for (const [id, task] of this.pendingTasks.entries()) {
      task.reject({
        error: "Error en worker: " + (error.message || "Desconocido"),
        success: false
      });
      
      // Limpiar timeouts
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      
      this.pendingTasks.delete(id);
    }
  }
  
  /**
   * Envía un mensaje al worker y retorna una promesa con la respuesta
   */
  public async sendMessage<T>(
    message: WorkerMessage, 
    config?: Partial<WorkerTaskConfig>
  ): Promise<WorkerProcessingResult<T>> {
    // Si no está inicializado, intentar inicializar
    if (!this.isInitialized || !this.worker) {
      const initialized = await this.initialize();
      
      if (!initialized) {
        return {
          result: null as any,
          processingTime: 0,
          success: false,
          error: "Worker no inicializado"
        };
      }
    }
    
    // Configuración de tarea
    const taskConfig: WorkerTaskConfig = {
      ...this.DEFAULT_CONFIG,
      ...config
    };
    
    // Añadir timestamp si no existe
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }
    
    // Añadir config a mensaje
    message.config = {
      ...taskConfig
    };
    
    return new Promise((resolve, reject) => {
      // Verificar que el worker esté disponible
      if (!this.worker) {
        return reject({
          error: "Worker no disponible",
          success: false
        });
      }
      
      // Crear objeto de tarea
      const task = {
        resolve,
        reject,
        startTime: Date.now(),
        config: taskConfig
      };
      
      // Registrar tarea
      this.pendingTasks.set(message.id, task);
      
      // Configurar timeout
      if (taskConfig.timeoutMs > 0) {
        const timeoutId = window.setTimeout(() => {
          // Si aún existe la tarea, rechazarla por timeout
          if (this.pendingTasks.has(message.id)) {
            this.pendingTasks.delete(message.id);
            reject({
              error: `Timeout después de ${taskConfig.timeoutMs}ms`,
              success: false,
              processingTime: Date.now() - task.startTime
            });
          }
        }, taskConfig.timeoutMs);
        
        // Guardar referencia al timeout
        task.timeoutId = timeoutId;
      }
      
      // Añadir a cola según prioridad
      const queueItem = { id: message.id, message };
      
      if (taskConfig.priorityLevel === 'high') {
        this.processingQueue.unshift(queueItem);
      } else {
        this.processingQueue.push(queueItem);
      }
      
      // Procesar cola si no está procesando
      if (!this.isProcessing) {
        this.processNextInQueue();
      }
    });
  }
  
  /**
   * Procesa el siguiente elemento en la cola
   */
  private processNextInQueue(): void {
    if (this.processingQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    
    // Tomar siguiente elemento
    const nextItem = this.processingQueue.shift();
    
    if (!nextItem || !this.worker) {
      this.isProcessing = false;
      return;
    }
    
    try {
      // Enviar mensaje al worker
      const message = nextItem.message;
      
      // Verificar si se deben usar transferibles
      if (message.config?.useTransferables && message.transferables?.length) {
        this.worker.postMessage(message, message.transferables);
      } else {
        this.worker.postMessage(message);
      }
    } catch (error) {
      console.error("[EnhancedSignalWorker] Error enviando mensaje al worker:", error);
      
      // Rechazar tarea actual
      const pendingTask = this.pendingTasks.get(nextItem.id);
      if (pendingTask) {
        this.pendingTasks.delete(nextItem.id);
        pendingTask.reject({
          error: "Error enviando mensaje al worker: " + (error as Error).message,
          success: false
        });
        
        // Limpiar timeout
        if (pendingTask.timeoutId) {
          clearTimeout(pendingTask.timeoutId);
        }
      }
      
      // Continuar con siguiente elemento
      this.processNextInQueue();
    }
  }
  
  /**
   * Procesa un valor a través del worker con optimizaciones
   */
  public async processSignal(
    signal: number[], 
    options: {
      useML?: boolean;
      operation?: string;
      threshold?: number;
      filterType?: number;
    } = {}
  ): Promise<any> {
    const isWorkerOptimizationEnabled = getOptimizationManager().isFeatureEnabled('worker-optimization');
    
    // Generar ID único para esta tarea
    const taskId = 'signal-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    
    // Crear transferable si está habilitado
    let transferables: ArrayBuffer[] = [];
    let optimizedSignal: Float32Array | number[] = signal;
    
    if (isWorkerOptimizationEnabled) {
      // Usar ArrayBuffer transferable para mejor rendimiento
      optimizedSignal = new Float32Array(signal);
      transferables.push(optimizedSignal.buffer);
    }
    
    // Enviar mensaje al worker con optimizaciones
    return this.sendMessage({
      type: 'process',
      id: taskId,
      data: {
        signal: optimizedSignal,
        useML: options.useML ?? false,
        options: {
          operation: options.operation || 'filter',
          threshold: options.threshold || 0.5,
          filterType: options.filterType || 1
        }
      },
      transferables: isWorkerOptimizationEnabled ? transferables : undefined
    }, {
      useTransferables: isWorkerOptimizationEnabled,
      priorityLevel: options.useML ? 'high' : 'normal',
      timeoutMs: options.useML ? 2000 : 1000 // ML toma más tiempo
    });
  }
  
  /**
   * Termina el worker y libera recursos
   */
  public terminate(): void {
    if (this.worker) {
      // Enviar mensaje de terminación
      try {
        this.worker.postMessage({
          type: 'terminate',
          id: 'terminate-' + Date.now()
        });
      } catch (e) {
        // Ignorar errores al terminar
      }
      
      // Terminar worker
      this.worker.terminate();
      this.worker = null;
    }
    
    // Rechazar todas las tareas pendientes
    for (const [id, task] of this.pendingTasks.entries()) {
      task.reject({
        error: "Worker terminado",
        success: false
      });
      
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
    }
    
    // Limpiar estado
    this.pendingTasks.clear();
    this.processingQueue = [];
    this.isProcessing = false;
    this.isInitialized = false;
    
    console.log("[EnhancedSignalWorker] Worker terminado y recursos liberados");
  }
  
  /**
   * Verificar si el worker está inicializado
   */
  public isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }
}

/**
 * Crea una instancia del worker mejorado
 */
export const createEnhancedSignalWorker = (workerUrl?: string): EnhancedSignalWorker => {
  return new EnhancedSignalWorker(workerUrl);
};
