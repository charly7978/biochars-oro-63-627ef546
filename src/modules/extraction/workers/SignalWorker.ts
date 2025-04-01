
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Web Worker para procesamiento de señal en segundo plano
 * Permite procesamiento sin bloquear el hilo principal
 */

/**
 * Tipos de mensajes para el Worker
 */
export enum WorkerMessageType {
  INITIALIZE = 'initialize',
  PROCESS_SIGNAL = 'process_signal',
  PROCESS_BATCH = 'process_batch',
  APPLY_FILTER = 'apply_filter',
  DETECT_PEAKS = 'detect_peaks',
  RESULT = 'result',
  ERROR = 'error'
}

/**
 * Estructura de mensaje para comunicación con el Worker
 */
export interface WorkerMessage {
  type: WorkerMessageType;
  data: any;
  requestId?: string;
}

/**
 * Clase para gestionar la comunicación con el Web Worker
 */
export class SignalWorkerManager {
  private worker: Worker | null = null;
  private isInitialized: boolean = false;
  private pendingRequests: Map<string, { 
    resolve: (value: any) => void, 
    reject: (reason: any) => void 
  }> = new Map();
  private isSupported: boolean = typeof Worker !== 'undefined';
  
  constructor() {
    console.log("SignalWorkerManager: Inicializando, soporte de Workers:", this.isSupported);
  }
  
  /**
   * Inicializa el Web Worker
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    // Verificar soporte de Web Workers
    if (!this.isSupported) {
      console.warn("SignalWorkerManager: Web Workers no soportados en este navegador");
      return false;
    }
    
    try {
      // Crear worker real
      // Usamos URL.createObjectURL para evitar problemas de CORS
      const blob = new Blob([
        `importScripts('${window.location.origin}/assets/signal.worker.js');`
      ], { type: 'application/javascript' });
      
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);
      
      console.log("SignalWorkerManager: Worker real inicializado");
      this.setupMessageHandling();
      
      // Inicializar worker
      const initialized = await this.sendMessage(
        WorkerMessageType.INITIALIZE, 
        {}
      );
      
      this.isInitialized = initialized.success;
      return this.isInitialized;
    } catch (error) {
      console.error("SignalWorkerManager: Error inicializando Worker", error);
      return false;
    }
  }
  
  /**
   * Configura manejo de mensajes desde el Worker
   */
  private setupMessageHandling(): void {
    if (!this.worker) return;
    
    // Escuchar mensajes del worker
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = this.handleWorkerError.bind(this);
  }
  
  /**
   * Maneja mensajes recibidos del worker
   */
  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const message = event.data;
    const { type, data, requestId } = message;
    
    if (!requestId) {
      console.warn("SignalWorkerManager: Mensaje sin ID de solicitud", message);
      return;
    }
    
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      console.warn("SignalWorkerManager: Solicitud no encontrada para ID", requestId);
      return;
    }
    
    const { resolve, reject } = request;
    
    if (type === WorkerMessageType.ERROR) {
      reject(new Error(data.error || 'Error desconocido en worker'));
    } else {
      resolve(data);
    }
    
    this.pendingRequests.delete(requestId);
  }
  
  /**
   * Maneja errores del worker
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error("SignalWorkerManager: Error en worker", error);
    
    // Rechazar todas las solicitudes pendientes
    for (const [requestId, { reject }] of this.pendingRequests.entries()) {
      reject(new Error(`Error en worker: ${error.message}`));
      this.pendingRequests.delete(requestId);
    }
  }
  
  /**
   * Envía un mensaje al worker y espera respuesta
   */
  private async sendMessage(type: WorkerMessageType, data: any): Promise<any> {
    if (!this.worker) {
      throw new Error("Worker no inicializado");
    }
    
    const requestId = this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      // Guardar callbacks para cuando llegue la respuesta
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Enviar mensaje al worker
      this.worker!.postMessage({
        type,
        data,
        requestId
      });
      
      // Timeout para evitar bloqueos
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Timeout esperando respuesta para mensaje tipo ${type}`));
        }
      }, 5000);
    });
  }
  
  /**
   * Procesa un valor de señal en el Worker
   */
  public async processSignal(value: number): Promise<number> {
    if (!this.isInitialized) {
      if (!await this.initialize()) {
        throw new Error("No se pudo inicializar el worker");
      }
    }
    
    try {
      const result = await this.sendMessage(
        WorkerMessageType.PROCESS_SIGNAL, 
        { value }
      );
      
      return result.processed;
    } catch (error) {
      console.error("SignalWorkerManager: Error procesando señal", error);
      throw error;
    }
  }
  
  /**
   * Procesa un lote de valores en el Worker
   */
  public async processBatch(values: number[]): Promise<number[]> {
    if (!this.isInitialized) {
      if (!await this.initialize()) {
        throw new Error("No se pudo inicializar el worker");
      }
    }
    
    try {
      const result = await this.sendMessage(
        WorkerMessageType.PROCESS_BATCH, 
        { values }
      );
      
      return result.processed;
    } catch (error) {
      console.error("SignalWorkerManager: Error procesando lote", error);
      throw error;
    }
  }
  
  /**
   * Aplica un filtro a los valores en el Worker
   */
  public async applyFilter(values: number[], filterType: string): Promise<number[]> {
    if (!this.isInitialized) {
      if (!await this.initialize()) {
        throw new Error("No se pudo inicializar el worker");
      }
    }
    
    try {
      const result = await this.sendMessage(
        WorkerMessageType.APPLY_FILTER,
        { values, filterType }
      );
      
      return result.filtered;
    } catch (error) {
      console.error(`SignalWorkerManager: Error aplicando filtro ${filterType}`, error);
      throw error;
    }
  }
  
  /**
   * Detecta picos en la señal usando el Worker
   */
  public async detectPeaks(values: number[]): Promise<number[]> {
    if (!this.isInitialized) {
      if (!await this.initialize()) {
        throw new Error("No se pudo inicializar el worker");
      }
    }
    
    try {
      const result = await this.sendMessage(
        WorkerMessageType.DETECT_PEAKS,
        { values }
      );
      
      return result.peaks;
    } catch (error) {
      console.error("SignalWorkerManager: Error detectando picos", error);
      throw error;
    }
  }
  
  /**
   * Genera un ID único para solicitudes
   */
  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  
  /**
   * Libera recursos del Worker
   */
  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.isInitialized = false;
    this.pendingRequests.clear();
  }
}

/**
 * Crea una instancia del gestor de Worker
 */
export const createSignalWorker = (): SignalWorkerManager => {
  return new SignalWorkerManager();
};
