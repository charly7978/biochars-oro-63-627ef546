/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Gestor de worker para procesamiento de señal
 * Maneja la comunicación con el worker y expone una API observable
 */

import { Observable, Subject, BehaviorSubject, operators } from '../observable/SignalObservable';
import { MessageBus, MessageType, createProcessedDataMessage, createDiagnosticsMessage } from '../messaging/MessageBus';
import { ProcessingPriority } from '../CombinedExtractor';

/**
 * Configuración del gestor del worker
 */
export interface WorkerManagerConfig {
  sampleRate?: number;
  bufferSize?: number;
  sensitivity?: number;
  amplificationFactor?: number;
  useAdvancedFiltering?: boolean;
  prioritizePeaks?: boolean;
  enableDiagnostics?: boolean;
}

/**
 * Resultado de procesamiento de señal del worker
 */
export interface WorkerProcessingResult {
  timestamp: number;
  rawValue: number;
  processedValue: number;
  indicators: {
    quality: number;
    fingerDetected: boolean;
    hasPeak: boolean;
  };
  priority: ProcessingPriority;
}

/**
 * Estados del gestor del worker
 */
export enum WorkerManagerState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  PROCESSING = 'processing',
  ERROR = 'error',
  TERMINATED = 'terminated'
}

/**
 * Gestor del worker de procesamiento de señal
 */
export class SignalProcessingWorkerManager {
  // Worker
  private worker: Worker | null = null;
  
  // Estado
  private stateSubject = new BehaviorSubject<WorkerManagerState>(WorkerManagerState.INITIALIZING);
  private readyPromise: Promise<boolean>;
  private readyResolver!: (value: boolean) => void;
  
  // Observables para flujo de datos
  private resultSubject = new Subject<WorkerProcessingResult>();
  private bufferResultSubject = new Subject<any>();
  private peakSubject = new Subject<any>();
  private errorSubject = new Subject<any>();
  private diagnosticsSubject = new Subject<any>();
  
  // Bus de mensajes
  private messageBus = MessageBus.getInstance();
  
  // Configuración
  private config: WorkerManagerConfig;
  
  // Estadísticas
  private stats = {
    messagesProcessed: 0,
    peaksDetected: 0,
    errorsOccurred: 0,
    processingTimeAvg: 0
  };
  
  /**
   * Constructor del gestor de worker
   */
  constructor(config: WorkerManagerConfig = {}) {
    this.config = {
      sampleRate: 30,
      bufferSize: 30,
      sensitivity: 0.5,
      amplificationFactor: 1.2,
      useAdvancedFiltering: true,
      prioritizePeaks: true,
      enableDiagnostics: true,
      ...config
    };
    
    // Inicializar promise de listo
    this.readyPromise = new Promise<boolean>(resolve => {
      this.readyResolver = resolve;
    });
    
    // Inicializar worker
    this.initWorker();
  }
  
  /**
   * Inicializa el worker
   */
  private initWorker(): void {
    try {
      // Crear nuevo worker
      this.worker = new Worker(
        new URL('./signal-processing.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      // Configurar manejador de mensajes
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      
      // Manejar errores
      this.worker.onerror = (error) => {
        console.error('Error en worker de procesamiento:', error);
        this.errorSubject.next({
          type: 'worker_error',
          message: error.message || 'Error desconocido en worker',
          timestamp: Date.now()
        });
        this.stateSubject.next(WorkerManagerState.ERROR);
        this.stats.errorsOccurred++;
      };
      
      // Establecer estado
      this.stateSubject.next(WorkerManagerState.INITIALIZING);
      
      // Inicializar el worker cuando esté listo
      this.once('READY').then(() => {
        this.sendToWorker('INITIALIZE', this.config);
      });
      
    } catch (error) {
      console.error('Error al crear worker:', error);
      this.stateSubject.next(WorkerManagerState.ERROR);
      this.readyResolver(false);
    }
  }
  
  /**
   * Manejador de mensajes del worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const { type, payload, processingTime, error, priority } = event.data;
    
    // Enviar al bus de mensajes para otros componentes interesados
    this.broadcastToMessageBus(type, payload, priority);
    
    switch (type) {
      case 'READY':
        console.log('Worker de procesamiento listo con capacidades:', payload.capabilities);
        break;
        
      case 'INITIALIZED':
        console.log('Worker inicializado con configuración:', payload.config);
        this.stateSubject.next(WorkerManagerState.READY);
        this.readyResolver(true);
        break;
        
      case 'SIGNAL_PROCESSED':
        this.resultSubject.next(payload);
        this.updateStats(processingTime, payload.indicators.hasPeak);
        break;
        
      case 'BUFFER_PROCESSED':
        this.bufferResultSubject.next(payload);
        this.updateStats(processingTime);
        break;
        
      case 'PEAK_DETECTED':
        this.peakSubject.next(payload);
        this.stats.peaksDetected++;
        break;
        
      case 'DIAGNOSTICS_REPORT':
        this.diagnosticsSubject.next(payload);
        break;
        
      case 'ERROR':
        console.error('Error en worker:', error);
        this.errorSubject.next({
          type: 'processing_error',
          message: error,
          timestamp: Date.now()
        });
        this.stats.errorsOccurred++;
        break;
        
      default:
        console.log(`Mensaje de worker: ${type}`, payload);
    }
  }
  
  /**
   * Actualiza estadísticas de procesamiento
   */
  private updateStats(processingTime?: number, isPeak: boolean = false): void {
    this.stats.messagesProcessed++;
    
    if (isPeak) {
      this.stats.peaksDetected++;
    }
    
    if (processingTime) {
      // Calcular promedio móvil exponencial
      if (this.stats.messagesProcessed <= 1) {
        this.stats.processingTimeAvg = processingTime;
      } else {
        const alpha = 0.1;
        this.stats.processingTimeAvg = 
          (1 - alpha) * this.stats.processingTimeAvg + alpha * processingTime;
      }
    }
  }
  
  /**
   * Envía mensaje al bus central de mensajes
   */
  private broadcastToMessageBus(type: string, payload: any, priority?: string): void {
    switch(type) {
      case 'SIGNAL_PROCESSED':
        this.messageBus.publish(
          createProcessedDataMessage(
            {
              rawValue: payload.rawValue,
              filteredValue: payload.processedValue,
              quality: payload.indicators.quality,
              fingerDetected: payload.indicators.fingerDetected,
              hasPeak: payload.indicators.hasPeak
            },
            'worker-manager'
          )
        );
        break;
        
      case 'DIAGNOSTICS_REPORT':
        if (this.config.enableDiagnostics) {
          this.messageBus.publish(
            createDiagnosticsMessage(
              {
                ...payload,
                extractorType: 'worker',
                processingTime: this.stats.processingTimeAvg
              },
              'worker-manager'
            )
          );
        }
        break;
    }
  }
  
  /**
   * Envía mensaje al worker
   */
  private sendToWorker(type: string, payload: any, transferable?: ArrayBuffer[]): void {
    if (!this.worker) {
      console.error('Worker no inicializado');
      return;
    }
    
    const message = {
      type,
      payload,
      transferable
    };
    
    if (transferable) {
      this.worker.postMessage(message, transferable);
    } else {
      this.worker.postMessage(message);
    }
  }
  
  /**
   * Espera a que el worker esté listo
   */
  public async waitForReady(): Promise<boolean> {
    return this.readyPromise;
  }
  
  /**
   * Procesa un valor de señal
   */
  public async processValue(value: number): Promise<void> {
    // Asegurar que el worker está listo
    if (this.stateSubject.getValue() !== WorkerManagerState.READY && 
        this.stateSubject.getValue() !== WorkerManagerState.PROCESSING) {
      await this.waitForReady();
    }
    
    this.stateSubject.next(WorkerManagerState.PROCESSING);
    this.sendToWorker('PROCESS_SIGNAL', { value });
  }
  
  /**
   * Procesa un buffer de valores completo
   */
  public async processBuffer(values: number[]): Promise<void> {
    // Asegurar que el worker está listo
    if (this.stateSubject.getValue() !== WorkerManagerState.READY && 
        this.stateSubject.getValue() !== WorkerManagerState.PROCESSING) {
      await this.waitForReady();
    }
    
    // Crear buffer transferible para envío eficiente
    const buffer = new ArrayBuffer(values.length * Float32Array.BYTES_PER_ELEMENT);
    const view = new Float32Array(buffer);
    
    // Llenar buffer
    values.forEach((value, i) => {
      view[i] = value;
    });
    
    this.stateSubject.next(WorkerManagerState.PROCESSING);
    this.sendToWorker('PROCESS_BUFFER', { buffer }, [buffer]);
  }
  
  /**
   * Configura el worker
   */
  public async configure(config: WorkerManagerConfig): Promise<void> {
    this.config = {
      ...this.config,
      ...config
    };
    
    if (this.worker) {
      await this.waitForReady();
      this.sendToWorker('CONFIGURE', this.config);
    }
  }
  
  /**
   * Resetea el worker
   */
  public async reset(): Promise<void> {
    if (this.worker) {
      await this.waitForReady();
      this.sendToWorker('RESET', {});
      
      // Resetear estadísticas
      this.stats = {
        messagesProcessed: 0,
        peaksDetected: 0,
        errorsOccurred: 0,
        processingTimeAvg: 0
      };
    }
  }
  
  /**
   * Termina el worker
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.stateSubject.next(WorkerManagerState.TERMINATED);
    }
  }
  
  /**
   * Reinicia el worker
   */
  public async restart(): Promise<void> {
    this.terminate();
    this.initWorker();
    await this.waitForReady();
  }
  
  /**
   * Devuelve un observable para los resultados del procesamiento
   */
  public getResultObservable(): Observable<WorkerProcessingResult> {
    return this.resultSubject;
  }
  
  /**
   * Devuelve un observable para los resultados de buffer
   */
  public getBufferResultObservable(): Observable<any> {
    return this.bufferResultSubject;
  }
  
  /**
   * Devuelve un observable para los picos detectados
   */
  public getPeakObservable(): Observable<any> {
    return this.peakSubject;
  }
  
  /**
   * Devuelve un observable para errores
   */
  public getErrorObservable(): Observable<any> {
    return this.errorSubject;
  }
  
  /**
   * Devuelve un observable para diagnósticos
   */
  public getDiagnosticsObservable(): Observable<any> {
    return this.diagnosticsSubject;
  }
  
  /**
   * Devuelve un observable para el estado
   */
  public getStateObservable(): Observable<WorkerManagerState> {
    // Use the BehaviorSubject as an Observable
    return this.stateSubject;
  }
  
  /**
   * Espera a un mensaje específico solo una vez
   */
  private once(messageType: string): Promise<any> {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === messageType) {
          this.worker?.removeEventListener('message', handler);
          resolve(event.data.payload);
        }
      };
      
      this.worker?.addEventListener('message', handler);
    });
  }
  
  /**
   * Obtiene el estado actual
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }
}

/**
 * Crea una instancia del gestor de worker
 */
export function createWorkerManager(config?: WorkerManagerConfig): SignalProcessingWorkerManager {
  return new SignalProcessingWorkerManager(config);
}
