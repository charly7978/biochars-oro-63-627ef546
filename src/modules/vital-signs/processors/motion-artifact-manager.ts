
import { ArtifactDetector } from '../motion/artifact-detector';
import { RecoveryHandler } from '../motion/recovery-handler';
import { MotionArtifactConfig, ArtifactAnalysisResult, AccelerometerData } from '../motion/types';

/**
 * Gestor avanzado de artefactos de movimiento
 * Implementa múltiples técnicas para detección y corrección
 */
export class MotionArtifactManager {
  private readonly detector: ArtifactDetector;
  private readonly recoveryHandler: RecoveryHandler;
  private readonly config: MotionArtifactConfig;
  
  private readonly DEFAULT_CONFIG: MotionArtifactConfig = {
    windowSize: 10,
    threshold: 3.5,
    recoveryTime: 1500,
    adaptiveThreshold: true
  };
  
  /**
   * Constructor del gestor de artefactos
   * @param config Configuración opcional
   */
  constructor(config?: Partial<MotionArtifactConfig>) {
    this.config = {
      ...this.DEFAULT_CONFIG,
      ...config
    };
    
    this.detector = new ArtifactDetector(this.config.threshold, this.config.windowSize);
    this.recoveryHandler = new RecoveryHandler(this.config.recoveryTime);
  }
  
  /**
   * Procesa un nuevo valor y detecta/corrige artefactos
   * @param value Valor de señal PPG
   * @param timestamp Marca de tiempo actual
   * @param accelData Datos opcionales del acelerómetro
   * @returns Resultado del análisis
   */
  public processValue(
    value: number, 
    timestamp: number, 
    accelData?: AccelerometerData
  ): ArtifactAnalysisResult {
    // Almacenar valor original para referencia
    const originalValue = value;
    
    // Actualizar datos de acelerómetro si están disponibles
    if (accelData) {
      this.detector.updateAccelerometerData(accelData);
    }
    
    // Actualizar buffer de valores
    this.detector.updateValueBuffer(value);
    
    // Actualización adaptativa del umbral si está habilitado
    if (this.config.adaptiveThreshold) {
      this.detector.updateAdaptiveThreshold(this.config.threshold);
    }
    
    // Verificar si estamos en fase de recuperación
    if (this.recoveryHandler.isInRecovery()) {
      const recoveryResult = this.recoveryHandler.handleRecoveryPhase(value, timestamp);
      
      // Si ya no estamos en recuperación, continuar con procesamiento normal
      if (!this.recoveryHandler.isInRecovery()) {
        return this.processRegularValue(value, timestamp);
      }
      
      return {
        isArtifact: true,
        confidenceReduction: recoveryResult.confidenceReduction,
        correctedValue: recoveryResult.correctedValue,
        originalValue
      };
    }
    
    return this.processRegularValue(value, timestamp);
  }
  
  /**
   * Procesa un valor en condiciones normales (sin recuperación)
   */
  private processRegularValue(value: number, timestamp: number): ArtifactAnalysisResult {
    // Detección de artefactos
    const isArtifact = this.detector.detectArtifact(value, timestamp);
    
    if (isArtifact) {
      // Iniciar fase de recuperación
      this.recoveryHandler.startRecovery(timestamp);
      
      // Corrección del artefacto
      const correctedValue = this.detector.correctArtifact(value);
      
      return {
        isArtifact: true,
        confidenceReduction: 0.5, // Reducción significativa de confianza
        correctedValue,
        originalValue: value
      };
    }
    
    // Actualizar línea base gradualmente si no hay artefacto
    this.detector.updateBaseline(value);
    
    return {
      isArtifact: false,
      confidenceReduction: 0,
      originalValue: value
    };
  }
  
  /**
   * Reinicia el gestor de artefactos
   */
  public reset(): void {
    this.detector.reset();
    this.recoveryHandler.reset();
  }
  
  /**
   * Configura la sensibilidad del detector
   * @param sensitivity Valor entre 0 y 1
   */
  public setSensitivity(sensitivity: number): void {
    // Valor acotado entre 0 y 1
    const boundedSensitivity = Math.max(0, Math.min(1, sensitivity));
    
    // Ajustar umbral basado en sensibilidad
    // Mayor sensibilidad = umbral más bajo
    const thresholdRange = [2.0, 5.0]; // [min, max]
    const newThreshold = thresholdRange[1] - (thresholdRange[1] - thresholdRange[0]) * boundedSensitivity;
    
    // Actualizar configuración
    this.config.threshold = newThreshold;
    this.detector.setAdaptiveThresholdValue(newThreshold);
  }
}
