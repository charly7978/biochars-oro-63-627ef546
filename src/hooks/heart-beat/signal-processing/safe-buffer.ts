
/**
 * Buffer seguro con validación de datos y manejo de errores
 * Encapsula el buffer optimizado con protecciones adicionales
 */
import { 
  OptimizedPPGBuffer, 
  CircularBufferAdapter 
} from './optimized-buffer';
import { 
  PPGDataPoint, 
  TimestampedPPGData, 
  SignalValidationResult 
} from '../../../types/signal';
import { 
  SignalValidator, 
  createSignalValidator 
} from '../../../modules/signal-processing/signal-validator';
import { 
  SignalProcessingErrorHandler, 
  getErrorHandler 
} from '../../../modules/signal-processing/error-handler';
import { 
  SignalProcessingDiagnostics, 
  getDiagnostics 
} from '../../../modules/signal-processing/diagnostics';

/**
 * SafeBuffer que añade validación y manejo de errores
 * Compatible con la interfaz original para facilitar integración
 */
export class SafePPGBuffer<T extends TimestampedPPGData = TimestampedPPGData> {
  private buffer: OptimizedPPGBuffer<T>;
  private validator: SignalValidator;
  private errorHandler: SignalProcessingErrorHandler;
  private diagnostics: SignalProcessingDiagnostics;
  private componentName: string;
  private lastValidPoint: T | null = null;

  constructor(capacity: number, componentName = 'SafePPGBuffer') {
    // Inicializar buffer optimizado
    this.buffer = new OptimizedPPGBuffer<T>(capacity);
    
    // Inicializar sistemas de validación y error
    this.validator = createSignalValidator();
    this.errorHandler = getErrorHandler();
    this.diagnostics = getDiagnostics();
    this.componentName = componentName;
    
    console.log(`SafePPGBuffer initialized with capacity ${capacity}`);
  }

  /**
   * Añadir un punto con validación
   */
  public push(item: T): void {
    try {
      // Asegurarse de que el punto tenga todas las propiedades necesarias
      const enhancedItem = { ...item } as T;
      
      // Garantizar que tanto time como timestamp existan
      if ('timestamp' in item && !('time' in item)) {
        (enhancedItem as unknown as { time: number }).time = item.timestamp;
      } else if ('time' in item && !('timestamp' in item)) {
        (enhancedItem as unknown as { timestamp: number }).timestamp = item.time;
      }
      
      // Validar el punto antes de añadirlo
      const validationStart = performance.now();
      const validationResult: SignalValidationResult = this.validator.validatePPGDataPoint(enhancedItem);
      const validationTimeMs = performance.now() - validationStart;
      
      // Registrar diagnóstico de validación
      this.diagnostics.recordDiagnosticInfo({
        processingStage: `${this.componentName}.validate`,
        validationPassed: validationResult.isValid,
        errorCode: validationResult.errorCode,
        errorMessage: validationResult.errorMessage,
        processingTimeMs: validationTimeMs
      });
      
      if (!validationResult.isValid) {
        // Manejar el error de validación
        const error = {
          code: validationResult.errorCode || 'VALIDATION_ERROR',
          message: validationResult.errorMessage || 'Data validation failed',
          timestamp: Date.now(),
          severity: 'medium' as const,
          recoverable: true,
          data: {
            item,
            validationResult
          }
        };
        
        const { shouldRetry, fallbackValue } = this.errorHandler.handleError(
          error, 
          this.componentName,
          this.lastValidPoint
        );
        
        if (shouldRetry) {
          // No hacer nada, dejar que el sistema siga operando
          return;
        } else if (fallbackValue) {
          // Usar el último valor válido
          this.buffer.push(fallbackValue);
          return;
        } else {
          // No añadir el punto inválido
          return;
        }
      }
      
      // Si pasa la validación, guardar como último valor válido
      this.lastValidPoint = enhancedItem;
      
      // Registrar como valor bueno para futuros fallbacks
      this.errorHandler.registerGoodValue(this.componentName, enhancedItem);
      
      // Añadir al buffer
      this.buffer.push(enhancedItem);
      
    } catch (error) {
      // Capturar errores inesperados
      console.error(`SafePPGBuffer: Unexpected error in push operation:`, error);
      
      // Registrar error en el sistema de diagnóstico
      this.diagnostics.recordDiagnosticInfo({
        processingStage: `${this.componentName}.push`,
        validationPassed: false,
        errorCode: 'UNEXPECTED_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Obtener un elemento con manejo de errores
   */
  public get(index: number): T | null {
    try {
      return this.buffer.get(index);
    } catch (error) {
      // Registrar error
      const processingError = {
        code: 'BUFFER_GET_ERROR',
        message: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        severity: 'low' as const,
        recoverable: true
      };
      
      this.errorHandler.handleError(processingError, this.componentName);
      return null;
    }
  }

  /**
   * Obtener todos los puntos con protección de errores
   */
  public getPoints(): T[] {
    try {
      return this.buffer.getPoints();
    } catch (error) {
      const processingError = {
        code: 'BUFFER_GET_POINTS_ERROR',
        message: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        severity: 'low' as const,
        recoverable: true
      };
      
      this.errorHandler.handleError(processingError, this.componentName);
      return [];
    }
  }

  /**
   * Limpiar el buffer
   */
  public clear(): void {
    try {
      this.buffer.clear();
      this.lastValidPoint = null;
    } catch (error) {
      console.error('Error clearing buffer:', error);
    }
  }

  /**
   * Tamaño actual del buffer
   */
  public size(): number {
    return this.buffer.size();
  }

  /**
   * Verificar si el buffer está vacío
   */
  public isEmpty(): boolean {
    return this.buffer.isEmpty();
  }

  /**
   * Verificar si el buffer está lleno
   */
  public isFull(): boolean {
    return this.buffer.isFull();
  }

  /**
   * Obtener la capacidad del buffer
   */
  public getCapacity(): number {
    return this.buffer.getCapacity();
  }

  /**
   * Obtener los valores del buffer
   */
  public getValues(): number[] {
    try {
      return this.buffer.getValues();
    } catch (error) {
      const processingError = {
        code: 'BUFFER_GET_VALUES_ERROR',
        message: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        severity: 'low' as const,
        recoverable: true
      };
      
      this.errorHandler.handleError(processingError, this.componentName);
      return [];
    }
  }

  /**
   * Obtener los últimos N elementos
   */
  public getLastN(n: number): T[] {
    try {
      return this.buffer.getLastN(n);
    } catch (error) {
      const processingError = {
        code: 'BUFFER_GET_LAST_N_ERROR',
        message: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        severity: 'low' as const,
        recoverable: true
      };
      
      this.errorHandler.handleError(processingError, this.componentName);
      return [];
    }
  }

  /**
   * Obtener el buffer interno optimizado
   */
  public getOptimizedBuffer(): OptimizedPPGBuffer<T> {
    return this.buffer;
  }
}

/**
 * Adaptador seguro compatible con CircularBuffer
 * Proporciona la misma interfaz con protecciones adicionales
 */
export class SafeCircularBufferAdapter<T extends TimestampedPPGData = TimestampedPPGData> extends CircularBufferAdapter<T> {
  private safeBuffer: SafePPGBuffer<T>;
  
  constructor(capacity: number, componentName = 'SafeCircularBufferAdapter') {
    super(capacity);
    this.safeBuffer = new SafePPGBuffer<T>(capacity, componentName);
  }
  
  public override push(item: T): void {
    super.push(item);
    this.safeBuffer.push(item);
  }
  
  /**
   * Obtener el buffer seguro
   */
  public getSafeBuffer(): SafePPGBuffer<T> {
    return this.safeBuffer;
  }
}

/**
 * Crear un buffer seguro a partir de un buffer circular
 */
export function createSafeBuffer<U extends TimestampedPPGData>(
  capacity: number, 
  componentName?: string
): SafePPGBuffer<U> {
  return new SafePPGBuffer<U>(capacity, componentName);
}

/**
 * Crear un adaptador de buffer seguro
 */
export function createSafeCircularBufferAdapter<U extends TimestampedPPGData>(
  capacity: number,
  componentName?: string
): SafeCircularBufferAdapter<U> {
  return new SafeCircularBufferAdapter<U>(capacity, componentName);
}
