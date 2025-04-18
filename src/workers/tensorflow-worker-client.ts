/**
 * Cliente para comunicación con el worker de TensorFlow
 * Gestiona la comunicación, carga de modelos y predicciones
 */
import { TensorFlowConfig, DEFAULT_TENSORFLOW_CONFIG } from '../core/neural/tensorflow/TensorFlowConfig';

export class TensorFlowWorkerClient {
  private worker: Worker | null = null;
  private messageId: number = 0;
  private callbacks: Map<number, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private initialized: boolean = false;
  private initializing: boolean = false;
  private modelStatus: Map<string, 'loading' | 'ready' | 'error'> = new Map();
  private config: TensorFlowConfig = DEFAULT_TENSORFLOW_CONFIG;
  
  constructor(config: TensorFlowConfig = DEFAULT_TENSORFLOW_CONFIG) {
    this.config = config;
    // Solo inicializar si está habilitado
    if (config.enabled) {
      this.initialize();
    } else {
      console.log('TensorFlow está deshabilitado, no se inicializará el worker');
    }
  }
  
  /**
   * Inicializa el worker
   */
  public async initialize(): Promise<void> {
    // Si TensorFlow está deshabilitado, no inicializar
    if (!this.config.enabled) {
      console.log('TensorFlow está deshabilitado, no se inicializará el worker');
      return;
    }

    if (this.initialized || this.initializing) {
      if (this.initializing) {
        return new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (this.initialized) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }
      return;
    }
    
    this.initializing = true;
    
    try {
      // Crear worker
      this.worker = new Worker(new URL('./tensorflow-worker.ts', import.meta.url), { type: 'module' });
      
      // Configurar handler de mensajes
      this.worker.onmessage = this.handleMessage.bind(this);
      
      // Esperar inicialización de TensorFlow
      const initResult = await this.waitForInitialization();
      
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
   * Espera a que el worker se inicialice
   */
  private waitForInitialization(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout esperando inicialización de TensorFlow'));
      }, 15000);
      
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
  }
  
  /**
   * Maneja los mensajes recibidos del worker
   */
  private handleMessage(e: MessageEvent): void {
    const { id, type, error } = e.data;
    
    if (id !== undefined && this.callbacks.has(id)) {
      const { resolve, reject, timeout } = this.callbacks.get(id)!;
      clearTimeout(timeout);
      
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
  private async sendMessage(type: string, data?: any, timeoutMs: number = 30000): Promise<any> {
    if (!this.worker || !this.initialized) {
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
      }, timeoutMs);
      
      this.callbacks.set(id, {
        resolve,
        reject,
        timeout
      });
      
      this.worker!.postMessage({ id, type, data });
    });
  }
  
  /**
   * Establece la configuración del worker
   */
  public async setConfig(config: TensorFlowConfig): Promise<void> {
    this.config = config;
    await this.sendMessage('setConfig', { config });
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
      await this.sendMessage('loadModel', { modelType }, 60000);
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
    // Si TensorFlow está deshabilitado, devolver valores por defecto
    if (!this.config.enabled) {
      console.log('TensorFlow está deshabilitado, devolviendo valores por defecto');
      return this.getDefaultPrediction(modelType);
    }
    
    // Asegurar que está inicializado
    if (!this.initialized) {
      await this.initialize();
    }

    // Asegurar que el modelo está cargado
    if (this.modelStatus.get(modelType) !== 'ready') {
      await this.loadModel(modelType);
    }
    
    // Enviar mensaje para predecir
    return this.sendMessage('predict', { modelType, input });
  }
  
  /**
   * Genera valores de predicción por defecto para cuando TensorFlow está deshabilitado
   */
  private getDefaultPrediction(modelType: string): number[] {
    // Valores de predicción por defecto según el tipo de modelo
    switch (modelType) {
      case 'heartRate':
        return [75]; // BPM normal
      case 'spo2':
        return [98]; // SpO2 normal
      case 'bloodPressure':
        return [120, 80]; // Presión arterial normal (sistólica/diastólica)
      case 'glucose':
        return [85]; // Glucosa normal
      case 'arrhythmia':
        return [0]; // No arritmia
      default:
        return [0]; // Valor por defecto genérico
    }
  }

  /**
   * Comprueba si TensorFlow está habilitado
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Comprueba si TensorFlow está inicializado
   */
  public isInitialized(): boolean {
    return this.initialized;
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
   * Limpia la memoria del worker
   */
  public async cleanupMemory(): Promise<void> {
    await this.sendMessage('cleanupMemory');
  }
  
  /**
   * Obtiene información de memoria
   */
  public async getMemoryInfo(): Promise<any> {
    return this.sendMessage('getMemoryInfo');
  }
  
  /**
   * Obtiene el estado de un modelo
   */
  public getModelStatus(modelType: string): 'loading' | 'ready' | 'error' | 'not_loaded' {
    return this.modelStatus.get(modelType) || 'not_loaded';
  }
  
  /**
   * Obtiene la configuración actual
   */
  public getConfig(): TensorFlowConfig {
    return this.config;
  }
  
  /**
   * Termina el worker y libera recursos
   */
  public terminateWorker(): void {
    this.callbacks.forEach(({ timeout }) => clearTimeout(timeout));
    
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

  /**
   * Actualiza la configuración del worker
   */
  public updateConfig(newConfig: Partial<TensorFlowConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // Si se cambió el estado de habilitación
    if (newConfig.enabled !== undefined) {
      if (newConfig.enabled === false && this.worker !== null) {
        // Si se está deshabilitando, terminar el worker
        console.log('TensorFlow está siendo deshabilitado, terminando worker');
        this.terminateWorker();
        this.initialized = false;
        return Promise.resolve();
      } else if (newConfig.enabled === true && !this.initialized && !this.initializing) {
        // Si se está habilitando y no está inicializado, inicializar
        console.log('TensorFlow está siendo habilitado, inicializando worker');
        return this.initialize();
      }
    }
    
    // Si el worker está activo, enviar nueva config
    if (this.worker !== null && this.initialized) {
      return this.sendMessage('setConfig', { config: this.config });
    }
    
    return Promise.resolve();
  }
}
