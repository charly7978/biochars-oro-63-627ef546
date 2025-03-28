import { ProcessedSignal, ProcessingError, ISignalProcessor } from '../types/signal';
import { PPGSignalProcessor as CorePPGSignalProcessor } from './core/SignalProcessor';

/**
 * Este archivo se mantiene para compatibilidad con código existente.
 * Se recomienda usar directamente la implementación de core/SignalProcessor.ts
 */

/**
 * Implementación del filtro de Kalman para suavizar señales
 */
class KalmanFilter {
  private R: number = 0.01;  // Ruido de medición
  private Q: number = 0.1;   // Ruido de proceso
  private P: number = 1;     // Estimación de error
  private X: number = 0;     // Valor estimado
  private K: number = 0;     // Ganancia de Kalman

  filter(measurement: number): number {
    // Predicción
    this.P = this.P + this.Q;
    
    // Actualización
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }

  reset() {
    this.X = 0;
    this.P = 1;
  }
}

/**
 * Procesador de señales PPG (Fotopletismografía)
 * Implementa la interfaz ISignalProcessor
 * Wrapper para mantener compatibilidad con código existente
 */
export class PPGSignalProcessor implements ISignalProcessor {
  private coreProcessor: CorePPGSignalProcessor;
  private isProcessing: boolean = false;
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    // Inicializar el procesador core y redirigir eventos
    this.coreProcessor = new CorePPGSignalProcessor(
      onSignalReady,
      onError
    );
    console.log("PPGSignalProcessor: Wrapper creado para mantener compatibilidad");
  }

  /**
   * Inicializa el procesador
   */
  async initialize(): Promise<void> {
    return this.coreProcessor.initialize();
  }

  /**
   * Inicia el procesamiento de señales
   */
  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.coreProcessor.start();
  }

  /**
   * Detiene el procesamiento de señales
   */
  stop(): void {
    this.isProcessing = false;
    this.coreProcessor.stop();
  }

  /**
   * Calibra el procesador para mejores resultados
   */
  async calibrate(): Promise<boolean> {
    return this.coreProcessor.calibrate();
  }

  /**
   * Procesa un frame para extraer información PPG
   */
  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }
    this.coreProcessor.processFrame(imageData);
  }

  /**
   * Restablece configuración por defecto
   */
  resetToDefault(): void {
    // Esta función existe en esta clase pero no en la core
    // Mantener para compatibilidad con código existente
    this.initialize();
    console.log("PPGSignalProcessor: Configuración restaurada a valores por defecto");
  }
}
