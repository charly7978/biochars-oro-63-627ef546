
/**
 * Configuraciones para la gestión de artefactos de movimiento
 */
export interface MotionArtifactConfig {
  windowSize: number;
  threshold: number;
  recoveryTime: number;
  adaptiveThreshold: boolean;
}

/**
 * Resultado del análisis de artefactos
 */
export interface ArtifactAnalysisResult {
  isArtifact: boolean;
  confidenceReduction: number;
  correctedValue?: number;
  originalValue: number;
}

/**
 * Datos del acelerómetro
 */
export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
}
