import { TensorFlowWorkerClient } from '../workers/tensorflow-worker-client';
import { detectOptimalConfig } from '../core/neural/tensorflow/TensorFlowConfig';
import { toast } from 'sonner';

/**
 * Servicio centralizado para acceder a funcionalidades de TensorFlow
 * Evita duplicación de instancias y optimiza recursos
 */
class TensorFlowService {
  private static instance: TensorFlowService;
  private workerClient: TensorFlowWorkerClient | null = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;
  private listeners: Map<string, Set<Function>> = new Map();
  private modelStatus: Map<string, boolean> = new Map();
  private initPromise: Promise<void> | null = null;
  private memoryMonitorInterval: number | null = null;
  private lastCleanupTime: number = 0;
  private readonly MEMORY_LIMIT_MB = 100; // Umbral de limpieza de memoria
  private readonly CLEANUP_INTERVAL_MS = 60000; // 1 minuto
  
  private constructor() {
    // Privado para patrón Singleton
    console.log('TensorFlowService: Instancia creada');
  }
  
  public static getInstance(): TensorFlowService {
    if (!TensorFlowService.instance) {
      TensorFlowService.instance = new TensorFlowService();
    }
    return TensorFlowService.instance;
  }
  
  /**
   * Inicializa el servicio TensorFlow con configuración optimizada
   */
  public async initialize(): Promise<void> {
    if (this.isReady) return;
    if (this.isInitializing) return this.initPromise;
    
    this.isInitializing = true;
    
    this.initPromise = new Promise<void>(async (resolve, reject) => {
      try {
        console.log('TensorFlowService: Inicializando servicio');
        
        // Detectar configuración óptima según dispositivo
        const optimalConfig = detectOptimalConfig();
        
        // Crear cliente de worker
        this.workerClient = new TensorFlowWorkerClient(optimalConfig);
        
        // Inicializar worker
        await this.workerClient.initialize();
        
        // Iniciar monitoreo de memoria
        this.startMemoryMonitoring();
        
        this.isReady = true;
        this.isInitializing = false;
        
        console.log('TensorFlowService: Inicialización completa');
        
        // Notificar a los escuchadores
        this.notifyListeners('init', { status: 'ready' });
        
        resolve();
      } catch (error) {
        console.error('TensorFlowService: Error en inicialización', error);
        this.isInitializing = false;
        reject(error);
      }
    });
    
    return this.initPromise;
  }
  
  /**
   * Carga un modelo específico
   */
  public async loadModel(modelType: string): Promise<void> {
    if (!this.isReady) {
      await this.initialize();
    }
    
    if (!this.workerClient) {
      throw new Error('TensorFlow Worker no inicializado');
    }
    
    try {
      console.log(`TensorFlowService: Cargando modelo ${modelType}`);
      await this.workerClient.loadModel(modelType);
      
      this.modelStatus.set(modelType, true);
      this.notifyListeners('modelLoaded', { modelType });
    } catch (error) {
      console.error(`TensorFlowService: Error cargando modelo ${modelType}`, error);
      this.modelStatus.set(modelType, false);
      throw error;
    }
  }
  
  /**
   * Realiza una predicción con el modelo especificado
   */
  public async predict(modelType: string, input: number[]): Promise<number[]> {
    if (!this.isReady) {
      await this.initialize();
    }
    
    if (!this.workerClient) {
      throw new Error('TensorFlow Worker no inicializado');
    }
    
    // Comprobar si el modelo está cargado
    if (!this.modelStatus.get(modelType)) {
      try {
        await this.loadModel(modelType);
      } catch (error) {
        console.error(`TensorFlowService: Error cargando modelo ${modelType} automáticamente`, error);
        throw new Error(`Modelo ${modelType} no disponible: ${error}`);
      }
    }
    
    try {
      const result = await this.workerClient.predict(modelType, input);
      return result;
    } catch (error) {
      console.error(`TensorFlowService: Error en predicción con modelo ${modelType}`, error);
      throw error;
    }
  }
  
  /**
   * Monitorea y gestiona la memoria automáticamente
   */
  private startMemoryMonitoring(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    
    this.memoryMonitorInterval = window.setInterval(async () => {
      if (!this.workerClient) return;
      
      try {
        const memoryInfo = await this.workerClient.getMemoryInfo();
        const memoryUsageMB = memoryInfo.numBytes / (1024 * 1024);
        
        // Si el uso de memoria supera el límite y ha pasado tiempo suficiente desde la última limpieza
        const now = Date.now();
        if (memoryUsageMB > this.MEMORY_LIMIT_MB && 
            now - this.lastCleanupTime > this.CLEANUP_INTERVAL_MS) {
          
          console.log(`TensorFlowService: Limpieza de memoria automática (${memoryUsageMB.toFixed(2)}MB)`);
          await this.workerClient.cleanupMemory();
          this.lastCleanupTime = now;
        }
      } catch (error) {
        console.error('TensorFlowService: Error monitoreando memoria', error);
      }
    }, 10000); // Comprobar cada 10 segundos
  }
  
  /**
   * Libera un modelo específico
   */
  public async disposeModel(modelType: string): Promise<boolean> {
    if (!this.workerClient) return false;
    
    try {
      const result = await this.workerClient.disposeModel(modelType);
      if (result) {
        this.modelStatus.set(modelType, false);
      }
      return result || false;
    } catch (error) {
      console.error(`TensorFlowService: Error liberando modelo ${modelType}`, error);
      return false;
    }
  }
  
  /**
   * Fuerza limpieza de memoria
   */
  public async cleanupMemory(): Promise<void> {
    if (!this.workerClient) return;
    
    try {
      await this.workerClient.cleanupMemory();
      this.lastCleanupTime = Date.now();
      console.log('TensorFlowService: Limpieza de memoria completada');
    } catch (error) {
      console.error('TensorFlowService: Error limpiando memoria', error);
      throw error;
    }
  }
  
  /**
   * Suscribe un escuchador a eventos específicos
   */
  public addEventListener(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)?.add(listener);
  }
  
  /**
   * Elimina un escuchador de eventos
   */
  public removeEventListener(event: string, listener: Function): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.delete(listener);
    }
  }
  
  /**
   * Notifica a todos los escuchadores de un evento
   */
  private notifyListeners(event: string, data: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`TensorFlowService: Error en listener para evento ${event}`, error);
        }
      });
    }
  }
  
  /**
   * Limpieza al cerrar la aplicación
   */
  public dispose(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }
    
    if (this.workerClient) {
      // Limpieza asincrona, no esperamos por ella
      this.workerClient.cleanupMemory().catch(error => {
        console.error('TensorFlowService: Error en limpieza final', error);
      });
      
      this.workerClient = null;
    }
    
    this.listeners.clear();
    this.modelStatus.clear();
    this.isReady = false;
    
    console.log('TensorFlowService: Recursos liberados');
  }
}

// Exportar como singleton
export default TensorFlowService.getInstance();
