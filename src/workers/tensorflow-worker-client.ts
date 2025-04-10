
/**
 * Cliente para comunicación con el worker de TensorFlow
 * Gestiona la comunicación, carga de modelos y predicciones
 */
export class TensorFlowWorkerClient {
  private worker: Worker | null = null;
  private messageId: number = 0;
  private callbacks: Map<number, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = new Map();
  private initialized: boolean = false;
  private initializing: boolean = false;
  private modelStatus: Map<string, 'loading' | 'ready' | 'error'> = new Map();
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Inicializa el worker
   */
  public async initialize(): Promise<void> {
    if (this.initialized || this.initializing) return;
    
    this.initializing = true;
    
    try {
      // Crear worker
      this.worker = new Worker(new URL('./tensorflow-worker.ts', import.meta.url), { type: 'module' });
      
      // Configurar handler de mensajes
      this.worker.onmessage = this.handleMessage.bind(this);
      
      // Esperar inicialización de TensorFlow
      const initResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout esperando inicialización de TensorFlow'));
        }, 10000);
        
        const messageHandler = (e: MessageEvent) => {
          if (e.data.type === 'init') {
            if (e.data.status === 'ready') {
              this.worker?.removeEventListener('message', messageHandler);
              clearTimeout(timeout);
              resolve(e.data);
            } else if (e.data.status === 'error') {
              this.worker?.removeEventListener('message', messageHandler);
              clearTimeout(timeout);
              reject(new Error(`Error iniciando TensorFlow: ${e.data.error}`));
            }
          }
        };
        
        this.worker?.addEventListener('message', messageHandler);
      });
      
      console.log('TensorFlow Worker inicializado:', initResult);
      this.initialized = true;
    } catch (error) {
      console.error('Error inicializando TensorFlow Worker:', error);
      this.terminateWorker();
      throw error;
    } finally {
      this.initializing = false;
    }
  }
  
  /**
   * Maneja los mensajes recibidos del worker
   */
  private handleMessage(e: MessageEvent): void {
    const { id, type, error } = e.data;
    
    if (id !== undefined && this.callbacks.has(id)) {
      const { resolve, reject } = this.callbacks.get(id)!;
      
      if (type === 'error') {
        reject(new Error(error));
      } else if (type === 'result') {
        resolve(e.data.result);
      } else if (type === 'modelLoaded') {
        this.modelStatus.set(e.data.modelType, 'ready');
        resolve(true);
      } else if (type === 'modelDisposed') {
        this.modelStatus.delete(e.data.modelType);
        resolve(true);
      } else {
        resolve(e.data);
      }
      
      this.callbacks.delete(id);
    }
  }
  
  /**
   * Envía un mensaje al worker y espera respuesta
   */
  private async sendMessage(type: string, data?: any): Promise<any> {
    if (!this.worker) {
      await this.initialize();
    }
    
    if (!this.worker) {
      throw new Error('Worker no disponible');
    }
    
    const id = this.messageId++;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`Timeout esperando respuesta para mensaje tipo: ${type}`));
        }
      }, 30000);
      
      this.callbacks.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (reason) => {
          clearTimeout(timeout);
          reject(reason);
        }
      });
      
      this.worker!.postMessage({ id, type, data });
    });
  }
  
  /**
   * Carga un modelo específico
   */
  public async loadModel(modelType: string): Promise<boolean> {
    // Si ya está cargado, devolver inmediatamente
    if (this.modelStatus.get(modelType) === 'ready') {
      return true;
    }
    
    // Si está cargando, esperar
    if (this.modelStatus.get(modelType) === 'loading') {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.modelStatus.get(modelType) === 'ready') {
            clearInterval(checkInterval);
            resolve(true);
          } else if (this.modelStatus.get(modelType) === 'error') {
            clearInterval(checkInterval);
            reject(new Error(`Error cargando modelo ${modelType}`));
          }
        }, 100);
        
        // Timeout después de 30 segundos
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error(`Timeout cargando modelo ${modelType}`));
        }, 30000);
      });
    }
    
    // Marcar como cargando
    this.modelStatus.set(modelType, 'loading');
    
    try {
      // Enviar mensaje para cargar modelo
      await this.sendMessage('loadModel', { modelType });
      return true;
    } catch (error) {
      this.modelStatus.set(modelType, 'error');
      throw error;
    }
  }
  
  /**
   * Realiza una predicción con un modelo específico
   */
  public async predict(modelType: string, input: number[]): Promise<number[]> {
    // Asegurar que el modelo está cargado
    if (this.modelStatus.get(modelType) !== 'ready') {
      await this.loadModel(modelType);
    }
    
    // Enviar mensaje para predecir
    return this.sendMessage('predict', { modelType, input });
  }
  
  /**
   * Libera un modelo específico
   */
  public async disposeModel(modelType: string): Promise<void> {
    if (this.modelStatus.get(modelType)) {
      await this.sendMessage('disposeModel', { modelType });
    }
  }
  
  /**
   * Obtiene el estado de un modelo
   */
  public getModelStatus(modelType: string): 'loading' | 'ready' | 'error' | 'not_loaded' {
    return this.modelStatus.get(modelType) || 'not_loaded';
  }
  
  /**
   * Termina el worker y libera recursos
   */
  public terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.callbacks.clear();
    this.modelStatus.clear();
    this.initialized = false;
    this.initializing = false;
  }
  
  /**
   * Libera recursos al destruir la instancia
   */
  public dispose(): void {
    this.terminateWorker();
  }
}
