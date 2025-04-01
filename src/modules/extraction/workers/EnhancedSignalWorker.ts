
/**
 * Worker mejorado para procesamiento de señales
 * Implementa optimizaciones avanzadas para procesamiento eficiente
 */
import { WorkerProcessingResult, WorkerTaskConfig } from '../types/processing';

// Interfaz para tareas del worker
export interface WorkerTask<T = any> {
  resolve: (value: WorkerProcessingResult<T> | PromiseLike<WorkerProcessingResult<T>>) => void;
  reject: (reason?: any) => void;
  startTime: number;
  config: WorkerTaskConfig;
  timeoutId?: number; // Propiedad opcional
}

// Tipos de mensajes del worker
export enum WorkerMessageType {
  INITIALIZE = 'initialize',
  PROCESS_SIGNAL = 'process_signal',
  PROCESS_BATCH = 'process_batch',
  APPLY_FILTER = 'apply_filter',
  DETECT_PEAKS = 'detect_peaks',
  OPTIMIZE_MEMORY = 'optimize_memory',
  RESULT = 'result',
  ERROR = 'error',
  PROGRESS = 'progress'
}

// Estructura de mensajes del worker
export interface WorkerMessage {
  type: WorkerMessageType;
  data: any;
  requestId?: string;
}

/**
 * Clase para gestionar un worker de procesamiento de señales mejorado
 */
export class EnhancedSignalWorker {
  private worker: Worker | null = null;
  private isInitialized: boolean = false;
  private pendingTasks: Map<string, WorkerTask> = new Map();
  private taskQueue: string[] = [];
  private processingTask: boolean = false;
  private workerUrl: string;
  private autoTerminate: boolean;
  private lastTaskTime: number = 0;
  
  /**
   * Constructor del worker mejorado
   */
  constructor(workerUrl: string, autoTerminate: boolean = true) {
    this.workerUrl = workerUrl;
    this.autoTerminate = autoTerminate;
  }
  
  /**
   * Inicializa el worker
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      console.log("[EnhancedSignalWorker] Iniciando worker:", this.workerUrl);
      this.worker = new Worker(this.workerUrl, { type: 'module' });
      
      // Configurar manejadores de eventos
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      // Inicializar el worker
      const result = await this.sendMessage<{ success: boolean }>(
        WorkerMessageType.INITIALIZE, 
        {}
      );
      
      this.isInitialized = result.success;
      console.log(`[EnhancedSignalWorker] Inicialización ${this.isInitialized ? 'exitosa' : 'fallida'}`);
      
      return this.isInitialized;
    } catch (error) {
      console.error("[EnhancedSignalWorker] Error inicializando worker:", error);
      this.isInitialized = false;
      return false;
    }
  }
  
  /**
   * Envía un mensaje al worker y espera respuesta
   */
  async sendMessage<T>(type: WorkerMessageType, data: any, config: WorkerTaskConfig = {}): Promise<WorkerProcessingResult<T>> {
    if (!this.worker && !await this.initialize()) {
      throw new Error("Worker no inicializado correctamente");
    }
    
    // Generar ID único para la solicitud
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    return new Promise<WorkerProcessingResult<T>>((resolve, reject) => {
      // Crear tarea
      const task: WorkerTask<T> = {
        resolve,
        reject,
        startTime: Date.now(),
        config
      };
      
      // Configurar timeout si se especificó
      if (config.timeout) {
        task.timeoutId = window.setTimeout(() => {
          this.handleTaskTimeout(requestId);
        }, config.timeout);
      }
      
      // Encolar tarea
      this.pendingTasks.set(requestId, task);
      this.taskQueue.push(requestId);
      
      // Enviar mensaje al worker
      this.worker!.postMessage({
        type,
        data,
        requestId
      });
      
      // Procesar siguiente tarea en cola si es necesario
      this.processNextTask();
      
      // Actualizar tiempo de la última tarea
      this.lastTaskTime = Date.now();
    });
  }
  
  /**
   * Maneja el timeout de una tarea
   */
  private handleTaskTimeout(requestId: string): void {
    const task = this.pendingTasks.get(requestId);
    if (!task) return;
    
    console.warn(`[EnhancedSignalWorker] Tarea ${requestId} superó el tiempo máximo`);
    
    // Eliminar la tarea
    this.pendingTasks.delete(requestId);
    this.taskQueue = this.taskQueue.filter(id => id !== requestId);
    
    // Rechazar promesa
    task.reject(new Error("Timeout - La tarea excedió el tiempo máximo permitido"));
    
    // Intentar procesar siguiente tarea
    this.processNextTask();
  }
  
  /**
   * Procesa la siguiente tarea en cola
   */
  private processNextTask(): void {
    if (this.processingTask || this.taskQueue.length === 0) return;
    
    this.processingTask = true;
    
    // Obtener siguiente tarea según prioridad
    const highPriorityTasks = this.taskQueue.filter(id => {
      const task = this.pendingTasks.get(id);
      return task?.config.priority === 'high';
    });
    
    const nextTaskId = highPriorityTasks.length > 0 
      ? highPriorityTasks[0]
      : this.taskQueue[0];
    
    // Marcar como procesando
    const nextTask = this.pendingTasks.get(nextTaskId);
    if (!nextTask) {
      this.processingTask = false;
      return;
    }
    
    // Continuar con el procesamiento (el worker ya tiene la tarea)
    
    // Al final esto se desmarcará en handleWorkerMessage
  }
  
  /**
   * Maneja los mensajes provenientes del worker
   */
  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const { type, data, requestId } = event.data;
    
    if (!requestId) {
      console.warn("[EnhancedSignalWorker] Mensaje recibido sin requestId:", type);
      return;
    }
    
    const task = this.pendingTasks.get(requestId);
    if (!task) {
      console.warn(`[EnhancedSignalWorker] Mensaje recibido para tarea no encontrada: ${requestId}`);
      return;
    }
    
    // Limpiar timeout si existe
    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
    }
    
    // Calcular tiempo de procesamiento
    const processingTime = Date.now() - task.startTime;
    
    switch (type) {
      case WorkerMessageType.RESULT:
        // Resolver promesa con resultado exitoso
        task.resolve({
          success: true,
          data: data,
          processingTime
        });
        break;
        
      case WorkerMessageType.ERROR:
        // Rechazar promesa con error
        task.reject(new Error(data.error || "Error desconocido en worker"));
        break;
        
      case WorkerMessageType.PROGRESS:
        // Los mensajes de progreso no resuelven la promesa, se ignoran aquí
        return;
        
      default:
        console.warn(`[EnhancedSignalWorker] Tipo de mensaje no reconocido: ${type}`);
        task.reject(new Error(`Tipo de mensaje no reconocido: ${type}`));
    }
    
    // Eliminar tarea completada
    this.pendingTasks.delete(requestId);
    this.taskQueue = this.taskQueue.filter(id => id !== requestId);
    
    // Marcar como no procesando
    this.processingTask = false;
    
    // Procesar siguiente tarea si existe
    this.processNextTask();
    
    // Comprobar si debemos terminar el worker por inactividad
    if (this.autoTerminate && this.pendingTasks.size === 0) {
      const inactiveTime = Date.now() - this.lastTaskTime;
      if (inactiveTime > 30000) { // 30 segundos de inactividad
        this.terminate();
      }
    }
  }
  
  /**
   * Maneja errores provenientes del worker
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error("[EnhancedSignalWorker] Error en worker:", error.message);
    
    // Rechazar todas las tareas pendientes
    this.pendingTasks.forEach((task, requestId) => {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      
      task.reject(new Error(`Error en worker: ${error.message}`));
      this.pendingTasks.delete(requestId);
    });
    
    // Vaciar cola
    this.taskQueue = [];
    this.processingTask = false;
    
    // Reintentar inicializar el worker
    this.isInitialized = false;
    this.worker = null;
    
    // No reiniciamos automáticamente para evitar ciclos infinitos
  }
  
  /**
   * Termina el worker
   */
  terminate(): void {
    if (!this.worker) return;
    
    console.log("[EnhancedSignalWorker] Terminando worker");
    
    // Rechazar tareas pendientes
    this.pendingTasks.forEach((task, requestId) => {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      
      task.reject(new Error("Worker terminado"));
      this.pendingTasks.delete(requestId);
    });
    
    this.taskQueue = [];
    this.processingTask = false;
    
    // Terminar worker
    this.worker.terminate();
    this.worker = null;
    this.isInitialized = false;
  }
  
  /**
   * Verifica si el worker está inicializado
   */
  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }
}

/**
 * Crea una instancia de EnhancedSignalWorker
 */
export function createEnhancedSignalWorker(workerUrl: string, autoTerminate: boolean = true): EnhancedSignalWorker {
  return new EnhancedSignalWorker(workerUrl, autoTerminate);
}
