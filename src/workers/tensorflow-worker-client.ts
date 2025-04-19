
/**
 * Cliente para comunicación con el worker de TensorFlow
 */

import { TensorFlowConfig } from '@/core/neural/tensorflow/TensorFlowConfig';

interface WorkerResponse {
  type: string;
  data?: any;
  error?: string;
}

export class TensorFlowWorkerClient {
  private worker: Worker | null = null;
  private requestMap: Map<string, { 
    resolve: (value: any) => void, 
    reject: (reason: any) => void 
  }> = new Map();
  private config: TensorFlowConfig;
  
  constructor(config: TensorFlowConfig = { backend: 'webgl' }) {
    this.config = config;
    this.initWorker();
  }
  
  private initWorker() {
    try {
      // Crear un nuevo worker
      this.worker = new Worker(new URL('./tensorflow-worker.ts', import.meta.url), { type: 'module' });
      
      // Configurar listener para mensajes
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      
      // Configurar listener para errores
      this.worker.onerror = (error) => {
        console.error('Error en TensorFlow Worker:', error);
        this.requestMap.forEach(({ reject }) => {
          reject(error);
        });
        this.requestMap.clear();
      };
      
      // Inicializar TensorFlow en el worker
      this.sendMessage('init', this.config);
    } catch (error) {
      console.error('Error creando TensorFlow Worker:', error);
    }
  }
  
  private handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
    const { type, data, error } = event.data;
    
    // Para mensajes de "ready", no hay promesa a resolver
    if (type === 'ready') {
      console.log('TensorFlow Worker listo');
      return;
    }
    
    // Extraer el tipo original de la solicitud
    const originalType = type.replace('_response', '').replace('_error', '');
    const requestId = originalType;
    
    // Buscar la promesa pendiente
    const pendingRequest = this.requestMap.get(requestId);
    if (!pendingRequest) {
      // Si no hay promesa pendiente, podría ser un mensaje no solicitado o un error
      if (error) {
        console.error(`Error en TensorFlow Worker (${originalType}):`, error);
      }
      return;
    }
    
    // Eliminar la promesa del mapa
    this.requestMap.delete(requestId);
    
    // Resolver o rechazar la promesa
    if (type.endsWith('_error')) {
      pendingRequest.reject(new Error(error || 'Error desconocido'));
    } else {
      pendingRequest.resolve(data);
    }
  }
  
  private async sendMessage(type: string, data: any = {}): Promise<any> {
    if (!this.worker) {
      this.initWorker();
      if (!this.worker) {
        throw new Error('No se pudo inicializar el TensorFlow Worker');
      }
    }
    
    return new Promise((resolve, reject) => {
      // Guardar la promesa en el mapa
      this.requestMap.set(type, { resolve, reject });
      
      // Enviar mensaje al worker
      this.worker!.postMessage({ type, data });
      
      // Configurar timeout para evitar bloqueo indefinido
      setTimeout(() => {
        if (this.requestMap.has(type)) {
          this.requestMap.delete(type);
          reject(new Error(`Timeout esperando respuesta para ${type}`));
        }
      }, 30000); // 30 segundos de timeout
    });
  }
  
  /**
   * Inicializa TensorFlow en el worker
   */
  public async initialize(config?: Partial<TensorFlowConfig>): Promise<{ backend: string }> {
    this.config = { ...this.config, ...config };
    return this.sendMessage('init', this.config);
  }
  
  /**
   * Carga un modelo de TensorFlow
   */
  public async loadModel(modelType: string): Promise<void> {
    return this.sendMessage('load', { modelType });
  }
  
  /**
   * Realiza una predicción con un modelo
   */
  public async predict(modelType: string, input: number[]): Promise<number[]> {
    const response = await this.sendMessage('predict', { modelType, input });
    return response.prediction;
  }
  
  /**
   * Libera un modelo de memoria
   */
  public async disposeModel(modelType: string): Promise<void> {
    return this.sendMessage('dispose', { modelType });
  }
  
  /**
   * Obtiene información de memoria de TensorFlow
   */
  public async getMemoryInfo(): Promise<any> {
    const response = await this.sendMessage('memory');
    return response.memoryInfo;
  }
  
  /**
   * Limpia la memoria de TensorFlow
   */
  public async cleanupMemory(): Promise<void> {
    return this.sendMessage('cleanup');
  }
  
  /**
   * Cierra el worker
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.requestMap.clear();
    }
  }
}
