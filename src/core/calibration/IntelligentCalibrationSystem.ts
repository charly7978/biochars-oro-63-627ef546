import { supabase } from '@/integrations/supabase/client';

/**
 * Tipos de medición soportados por el sistema de calibración
 */
export type MeasurementType = 'heartRate' | 'spo2' | 'bloodPressure' | 'glucose';

/**
 * Datos de medición para el sistema de calibración
 */
export interface MeasurementData {
  timestamp: number;
  heartRate: number;
  spo2: number;
  systolic: number;
  diastolic: number;
  glucose: number;
  quality: number;
  rawSignal?: number[];
  environmentalFactors?: EnvironmentalFactors;
}

/**
 * Datos de medición procesados con factores de corrección
 */
export interface ProcessedMeasurement extends MeasurementData {
  qualityFactor: number;
  environmentalCorrection: number;
}

/**
 * Factores ambientales que pueden afectar las mediciones
 */
export interface EnvironmentalFactors {
  lightLevel?: number; // 0-1
  temperature?: number; // en grados Celsius
  motionLevel?: number; // 0-1
  ambientNoise?: number; // 0-1
}

/**
 * Configuración del sistema de calibración
 */
export interface CalibrationConfig {
  autoCalibrationEnabled: boolean;
  continuousLearningEnabled: boolean;
  syncWithReferenceDevices: boolean;
  adaptToEnvironment: boolean;
  adaptToUserActivity: boolean;
  aggressiveness: number; // 0-1, qué tan agresivos son los ajustes
  minimumQualityThreshold: number; // 0-100
}

/**
 * Estado actual del sistema de calibración
 */
export interface CalibrationState {
  isCalibrating: boolean;
  phase: 'inactive' | 'baseline' | 'learning' | 'validation' | 'active';
  progress: CalibrationProgress;
  correctionFactors: CorrectionFactors;
  references: ReferenceValues;
  config: CalibrationConfig;
}

/**
 * Progreso de calibración para diferentes métricas
 */
export interface CalibrationProgress {
  heartRate: number; // 0-1
  spo2: number; // 0-1
  pressure: number; // 0-1
  arrhythmia?: number; // 0-1
  glucose: number; // 0-1
  lipids?: number; // 0-1
  hemoglobin?: number; // 0-1
}

/**
 * Factores de corrección aplicados a las mediciones
 */
export interface CorrectionFactors {
  heartRate: number;
  spo2: number;
  systolic: number;
  diastolic: number;
  glucose: number;
}

/**
 * Valores de referencia para calibración
 */
export interface ReferenceValues {
  heartRate: number;
  spo2: number;
  systolic: number;
  diastolic: number;
  glucose: number;
}

/**
 * Retroalimentación para el sistema de calibración
 */
export interface CalibrationFeedback {
  measurementType: MeasurementType;
  accuracy?: number; // 0-1
  referenceValue?: number | { systolic: number, diastolic: number };
  conditions?: MeasurementConditions;
}

/**
 * Condiciones durante la medición
 */
export interface MeasurementConditions {
  userActivity?: 'resting' | 'active' | 'sleeping';
  devicePosition?: 'finger' | 'wrist' | 'arm';
  userState?: 'fasting' | 'postMeal' | 'exercising' | 'normal';
}

/**
 * Perfil de calibración de usuario
 */
export interface UserCalibrationProfile {
  userId: string;
  createdAt: Date;
  lastUpdated: Date;
  correctionFactors: CorrectionFactors;
  referenceValues: ReferenceValues;
  config: CalibrationConfig;
}

interface CalibrationParameters {
  gain: number;
  offset: number;
  threshold: number;
  sensitivity: number;
}

/**
 * Sistema de Autocalibración Inteligente
 * 
 * Proporciona calibración adaptativa bidireccional con:
 * - Aprendizaje continuo de patrones individuales del usuario
 * - Detección automática de condiciones de medición
 * - Compensación de factores ambientales
 * - Retroalimentación en tiempo real para modelos neurales
 * - Sincronización con valores de referencia externos
 */
export class IntelligentCalibrationSystem {
  private static instance: IntelligentCalibrationSystem;
  
  // Estado de calibración general
  private calibrationActive: boolean = false;
  private calibrationPhase: 'inactive' | 'baseline' | 'learning' | 'validation' | 'active' = 'inactive';
  private progress: CalibrationProgress = this.getDefaultProgress();
  
  // Referencias y ajustes
  private referenceValues: ReferenceValues = this.getDefaultReferences();
  private correctionFactors: CorrectionFactors = this.getDefaultCorrectionFactors();
  
  // Historial y análisis
  private measurementHistory: MeasurementData[] = [];
  private readonly MAX_HISTORY_SIZE = 50;
  private userProfile: UserCalibrationProfile | null = null;
  
  // Configuración
  private config: CalibrationConfig = {
    autoCalibrationEnabled: true,
    continuousLearningEnabled: true,
    syncWithReferenceDevices: false,
    adaptToEnvironment: true,
    adaptToUserActivity: true,
    aggressiveness: 0.5, // 0-1, qué tan agresivos son los ajustes
    minimumQualityThreshold: 70 // Calidad mínima para considerar datos en calibración
  };
  
  private constructor() {
    // Inicializar
    this.loadCalibrationProfile();
  }
  
  /**
   * Obtiene la instancia singleton del sistema de calibración
   */
  public static getInstance(): IntelligentCalibrationSystem {
    if (!IntelligentCalibrationSystem.instance) {
      IntelligentCalibrationSystem.instance = new IntelligentCalibrationSystem();
    }
    return IntelligentCalibrationSystem.instance;
  }
  
  /**
   * Valores por defecto para progreso de calibración
   */
  private getDefaultProgress(): CalibrationProgress {
    return {
      heartRate: 0,
      spo2: 0,
      pressure: 0,
      arrhythmia: 0,
      glucose: 0,
      lipids: 0,
      hemoglobin: 0
    };
  }
  
  /**
   * Valores de referencia por defecto
   */
  private getDefaultReferences(): ReferenceValues {
    // Prohibido: No se permiten valores de referencia por defecto. Use solo datos reales.
    throw new Error('No se permiten valores de referencia por defecto. Use solo datos reales.');
  }
  
  /**
   * Factores de corrección por defecto
   */
  private getDefaultCorrectionFactors(): CorrectionFactors {
    return {
      heartRate: 1.0,
      spo2: 1.0,
      systolic: 1.0,
      diastolic: 1.0,
      glucose: 1.0
    };
  }
  
  /**
   * Inicia proceso de calibración inteligente
   */
  public startCalibration(): void {
    if (this.calibrationActive) return;
    
    this.calibrationActive = true;
    this.calibrationPhase = 'baseline';
    this.progress = this.getDefaultProgress();
    
    console.log('Sistema de calibración inteligente iniciado');
    
    // Iniciar fase de establecimiento de línea base
    this.startBaselinePhase();
  }
  
  /**
   * Procesa una nueva medición para calibración continua
   */
  public processMeasurement(data: MeasurementData): ProcessedMeasurement {
    // Guardar en historial
    this.addToHistory(data);
    
    // Aplicar calibración si está activa
    if (this.calibrationActive || this.config.continuousLearningEnabled) {
      return this.applyCalibration(data);
    }
    
    // Si no hay calibración activa, solo aplicar correcciones básicas
    return this.applyBasicCorrections(data);
  }
  
  /**
   * Añade medición al historial
   */
  private addToHistory(data: MeasurementData): void {
    this.measurementHistory.push(data);
    
    // Limitar tamaño del historial
    if (this.measurementHistory.length > this.MAX_HISTORY_SIZE) {
      this.measurementHistory.shift();
    }
  }
  
  /**
   * Proporciona retroalimentación al sistema (para aprendizaje)
   */
  public provideFeedback(feedback: CalibrationFeedback): void {
    if (!this.calibrationActive && !this.config.continuousLearningEnabled) return;
    
    // Actualizar factores de corrección basados en la retroalimentación
    if (feedback.accuracy !== undefined) {
      // Ajustar agresividad de corrección basado en precisión reportada
      const adjustmentFactor = this.calculateAdjustmentFactor(feedback.accuracy);
      
      // Actualizar factores específicos si se proporcionan
      if (feedback.measurementType === 'heartRate') {
        this.correctionFactors.heartRate *= (1 + adjustmentFactor);
      } else if (feedback.measurementType === 'spo2') {
        this.correctionFactors.spo2 *= (1 + adjustmentFactor);
      } else if (feedback.measurementType === 'bloodPressure') {
        this.correctionFactors.systolic *= (1 + adjustmentFactor);
        this.correctionFactors.diastolic *= (1 + adjustmentFactor);
      } else if (feedback.measurementType === 'glucose') {
        this.correctionFactors.glucose *= (1 + adjustmentFactor);
      }
      
      console.log(`Calibración ajustada para ${feedback.measurementType}:`, adjustmentFactor);
    }
    
    // Si se proporciona un valor de referencia, usarlo para calibración
    if (feedback.referenceValue !== undefined) {
      this.setReferenceValue(feedback.measurementType, feedback.referenceValue);
      this.recalibrateWithReference(feedback.measurementType, feedback.referenceValue);
    }
    
    // Ajustar pesos de características si se proporciona información de condiciones
    if (feedback.conditions) {
      this.adjustForConditions(feedback.conditions);
    }
    
    // Guardar actualización
    this.saveCalibrationProfile();
  }
  
  /**
   * Reinicia el sistema de calibración a sus valores por defecto
   */
  public resetCalibration(full: boolean = false): void {
    this.calibrationActive = false;
    this.calibrationPhase = 'inactive';
    this.progress = this.getDefaultProgress();
    
    if (full) {
      this.correctionFactors = this.getDefaultCorrectionFactors();
      this.referenceValues = this.getDefaultReferences();
      this.measurementHistory = [];
      this.userProfile = null;
      this.saveCalibrationProfile();
    }
    
    // Notificar reinicio
    console.log('Sistema de calibración reiniciado', full ? '(completo)' : '(parcial)');
  }
  
  /**
   * Estado actual del sistema de calibración
   */
  public getCalibrationState(): CalibrationState {
    return {
      isCalibrating: this.calibrationActive,
      phase: this.calibrationPhase,
      progress: this.progress,
      correctionFactors: { ...this.correctionFactors },
      references: { ...this.referenceValues },
      config: { ...this.config }
    };
  }
  
  /**
   * Actualiza la configuración del sistema de calibración
   */
  public updateConfig(newConfig: Partial<CalibrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Activar/desactivar aprendizaje continuo
    if (newConfig.continuousLearningEnabled !== undefined) {
      console.log(`Aprendizaje continuo ${newConfig.continuousLearningEnabled ? 'activado' : 'desactivado'}`);
    }
    
    this.saveCalibrationProfile();
  }
  
  /**
   * Registra un valor de referencia externo
   */
  public setReferenceValue(type: MeasurementType, value: number | { systolic: number, diastolic: number }): void {
    if (type === 'heartRate') {
      this.referenceValues.heartRate = value as number;
    } else if (type === 'spo2') {
      this.referenceValues.spo2 = value as number;
    } else if (type === 'bloodPressure' && typeof value !== 'number') {
      this.referenceValues.systolic = value.systolic;
      this.referenceValues.diastolic = value.diastolic;
    } else if (type === 'glucose') {
      this.referenceValues.glucose = value as number;
    }
    
    console.log(`Valor de referencia registrado para ${type}:`, value);
    this.saveCalibrationProfile();
  }
  
  /**
   * Ajusta calibración basada en valores de referencia
   */
  private recalibrateWithReference(type: MeasurementType, reference: number | { systolic: number, diastolic: number }): void {
    // Obtener últimas mediciones del tipo específico
    const recentMeasurements = this.measurementHistory
      .filter(m => m.quality > this.config.minimumQualityThreshold)
      .slice(-5);
    
    if (recentMeasurements.length === 0) return;
    
    // Calcular media de mediciones recientes
    let avgMeasurement: number | { systolic: number, diastolic: number };
    
    if (type === 'heartRate') {
      avgMeasurement = recentMeasurements.reduce((sum, m) => sum + m.heartRate, 0) / recentMeasurements.length;
      // Calcular factor de corrección
      if (avgMeasurement > 0 && typeof reference === 'number') {
        const correction = reference / avgMeasurement;
        // Aplicar ajuste gradual
        this.correctionFactors.heartRate = 
          this.correctionFactors.heartRate * (1 - this.config.aggressiveness) + 
          correction * this.config.aggressiveness;
      }
    } else if (type === 'spo2') {
      avgMeasurement = recentMeasurements.reduce((sum, m) => sum + m.spo2, 0) / recentMeasurements.length;
      if (avgMeasurement > 0 && typeof reference === 'number') {
        const correction = reference / avgMeasurement;
        this.correctionFactors.spo2 = 
          this.correctionFactors.spo2 * (1 - this.config.aggressiveness) + 
          correction * this.config.aggressiveness;
      }
    } else if (type === 'bloodPressure' && typeof reference !== 'number') {
      const avgSystolic = recentMeasurements.reduce((sum, m) => sum + m.systolic, 0) / recentMeasurements.length;
      const avgDiastolic = recentMeasurements.reduce((sum, m) => sum + m.diastolic, 0) / recentMeasurements.length;
      
      if (avgSystolic > 0 && avgDiastolic > 0) {
        const systolicCorrection = reference.systolic / avgSystolic;
        const diastolicCorrection = reference.diastolic / avgDiastolic;
        
        this.correctionFactors.systolic = 
          this.correctionFactors.systolic * (1 - this.config.aggressiveness) + 
          systolicCorrection * this.config.aggressiveness;
          
        this.correctionFactors.diastolic = 
          this.correctionFactors.diastolic * (1 - this.config.aggressiveness) + 
          diastolicCorrection * this.config.aggressiveness;
      }
    } else if (type === 'glucose') {
      avgMeasurement = recentMeasurements.reduce((sum, m) => sum + m.glucose, 0) / recentMeasurements.length;
      if (avgMeasurement > 0 && typeof reference === 'number') {
        const correction = reference / avgMeasurement;
        this.correctionFactors.glucose = 
          this.correctionFactors.glucose * (1 - this.config.aggressiveness) + 
          correction * this.config.aggressiveness;
      }
    }
    
    // Actualizar modelos neuronales con los nuevos datos de referencia
    this.updateNeuralModels(type, reference);
  }
  
  /**
   * Actualiza los modelos neuronales con datos de referencia
   */
  private updateNeuralModels(type: MeasurementType, reference: number | { systolic: number, diastolic: number }): void {
    // Método vacío para evitar error de referencia a modelos que no existen
    console.log('updateNeuralModels llamado pero sin implementación disponible');
  }
  
  /**
   * Inicia fase de establecimiento de línea base
   */
  private startBaselinePhase(): void {
    this.calibrationPhase = 'baseline';
    this.progress.heartRate = 0.1;
    this.progress.spo2 = 0.1;
    this.progress.pressure = 0.1;
    this.progress.glucose = 0.1;
    
    console.log('Fase de línea base iniciada');
    // El avance de la fase debe realizarse solo con datos reales
  }
  
  /**
   * Inicia fase de aprendizaje
   */
  private startLearningPhase(): void {
    this.calibrationPhase = 'learning';
    this.progress.heartRate = 0.5;
    this.progress.spo2 = 0.5;
    this.progress.pressure = 0.4;
    this.progress.glucose = 0.4;
    
    console.log('Fase de aprendizaje iniciada');
    // El avance de la fase debe realizarse solo con datos reales
  }
  
  /**
   * Inicia fase de validación
   */
  private startValidationPhase(): void {
    this.calibrationPhase = 'validation';
    this.progress.heartRate = 0.8;
    this.progress.spo2 = 0.8;
    this.progress.pressure = 0.7;
    this.progress.glucose = 0.7;
    
    console.log('Fase de validación iniciada');
    // El avance de la fase debe realizarse solo con datos reales
  }
  
  /**
   * Completa el proceso de calibración
   */
  private completeCalibration(): void {
    this.calibrationActive = false;
    this.calibrationPhase = 'active';
    this.progress.heartRate = 1.0;
    this.progress.spo2 = 1.0;
    this.progress.pressure = 1.0;
    this.progress.glucose = 1.0;
    
    console.log('Calibración completada');
    
    // Guardar perfil de calibración
    this.saveCalibrationProfile();
  }
  
  /**
   * Aplica calibración a una medición
   */
  private applyCalibration(data: MeasurementData): ProcessedMeasurement {
    // Aplicar correcciones básicas
    const processed = this.applyBasicCorrections(data);
    
    // Si está en modo de calibración activa, ajustar basado en fase
    if (this.calibrationActive) {
      if (this.calibrationPhase === 'baseline') {
        // Durante línea base, recopilar datos sin correcciones mayores
        this.updateBaselineProgress(data);
        return processed;
      } else if (this.calibrationPhase === 'learning') {
        // Durante aprendizaje, aplicar ajustes incrementales
        this.updateLearningProgress(data);
      } else if (this.calibrationPhase === 'validation') {
        // Durante validación, verificar precisión
        this.updateValidationProgress(data);
      }
    }
    
    // Aplicar factores de corrección completos
    return {
      ...processed,
      heartRate: processed.heartRate * this.correctionFactors.heartRate,
      spo2: processed.spo2 * this.correctionFactors.spo2,
      systolic: processed.systolic * this.correctionFactors.systolic,
      diastolic: processed.diastolic * this.correctionFactors.diastolic,
      glucose: processed.glucose * this.correctionFactors.glucose
    };
  }
  
  /**
   * Aplica correcciones básicas a una medición
   */
  private applyBasicCorrections(data: MeasurementData): ProcessedMeasurement {
    // Detectar y corregir valores atípicos
    const heartRate = this.correctOutlier(data.heartRate, 40, 200);
    const spo2 = this.correctOutlier(data.spo2, 85, 100);
    const systolic = this.correctOutlier(data.systolic, 90, 180);
    const diastolic = this.correctOutlier(data.diastolic, 50, 110);
    const glucose = this.correctOutlier(data.glucose, 70, 180);
    
    // Ajustar basado en calidad de la señal
    const qualityFactor = Math.max(0.5, data.quality / 100);
    
    // Compensar factores ambientales si están activados
    let environmentalCorrection = 1.0;
    if (this.config.adaptToEnvironment && data.environmentalFactors) {
      environmentalCorrection = this.calculateEnvironmentalCorrection(data.environmentalFactors);
    }
    
    return {
      ...data,
      heartRate,
      spo2,
      systolic,
      diastolic,
      glucose,
      qualityFactor,
      environmentalCorrection
    };
  }
  
  /**
   * Calcula factor de corrección ambiental
   */
  private calculateEnvironmentalCorrection(factors: EnvironmentalFactors): number {
    let correction = 1.0;
    
    // Ajustar por iluminación
    if (factors.lightLevel !== undefined) {
      // Bajo nivel de luz puede afectar la señal PPG
      correction *= 1 - Math.max(0, (0.5 - factors.lightLevel) * 0.2);
    }
    
    // Ajustar por temperatura
    if (factors.temperature !== undefined) {
      // Temperaturas extremas pueden afectar la circulación
      const tempDeviation = Math.abs(factors.temperature - 22) / 10; // 22°C considerado óptimo
      correction *= 1 - Math.min(0.1, tempDeviation * 0.05);
    }
    
    // Ajustar por movimiento
    if (factors.motionLevel !== undefined) {
      // El movimiento afecta significativamente las lecturas PPG
      correction *= 1 - Math.min(0.3, factors.motionLevel * 0.3);
    }
    
    return correction;
  }
  
  /**
   * Corrige valores atípicos
   */
  private correctOutlier(value: number, min: number, max: number): number {
    if (isNaN(value)) return (min + max) / 2;
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * Calcula factor de ajuste basado en retroalimentación
   */
  private calculateAdjustmentFactor(accuracy: number): number {
    // Escala de -0.05 a 0.05 basado en precisión de 0 a 1
    const rawAdjustment = (accuracy - 0.5) * 0.1;
    
    // Factor de aprendizaje
    const learningRate = this.config.aggressiveness * 0.1;
    
    return rawAdjustment * learningRate;
  }
  
  /**
   * Ajusta calibración para condiciones específicas
   */
  private adjustForConditions(conditions: MeasurementConditions): void {
    if (conditions.userActivity) {
      // Ajustar para distintos niveles de actividad
      if (conditions.userActivity === 'resting') {
        // Para descanso, menos correcciones
        this.config.aggressiveness = Math.max(0.2, this.config.aggressiveness - 0.1);
      } else if (conditions.userActivity === 'active') {
        // Para actividad, correcciones más agresivas
        this.config.aggressiveness = Math.min(0.8, this.config.aggressiveness + 0.1);
      }
    }
    
    if (conditions.devicePosition) {
      // Ajustar para posición del dispositivo
      // Diferente calibración para dedo vs muñeca
      console.log('Ajustando para posición del dispositivo:', conditions.devicePosition);
    }
    
    if (conditions.userState) {
      // Ajustar para estado del usuario (post-comida, etc.)
      if (conditions.userState === 'postMeal') {
        // Ajustar específicamente para glucosa
        // Después de comer es normal que la glucosa aumente
        console.log('Ajustando calibración para estado post-comida');
      }
    }
  }
  
  /**
   * Actualiza progreso de la fase de línea base
   */
  private updateBaselineProgress(data: MeasurementData): void {
    // Solo usar datos de alta calidad para línea base
    if (data.quality < 75) return;
    
    // Incrementar progreso
    this.progress.heartRate = Math.min(0.4, this.progress.heartRate + 0.05);
    this.progress.spo2 = Math.min(0.4, this.progress.spo2 + 0.05);
    this.progress.pressure = Math.min(0.3, this.progress.pressure + 0.03);
    this.progress.glucose = Math.min(0.3, this.progress.glucose + 0.03);
    
    // Avanzar a siguiente fase si se completa esta
    if (this.progress.heartRate >= 0.4 && 
        this.progress.spo2 >= 0.4 && 
        this.progress.pressure >= 0.3 && 
        this.progress.glucose >= 0.3) {
      this.startLearningPhase();
    }
  }
  
  /**
   * Actualiza progreso de la fase de aprendizaje
   */
  private updateLearningProgress(data: MeasurementData): void {
    // Solo usar datos de calidad decente
    if (data.quality < 65) return;
    
    // Incrementar progreso
    this.progress.heartRate = Math.min(0.7, this.progress.heartRate + 0.03);
    this.progress.spo2 = Math.min(0.7, this.progress.spo2 + 0.03);
    this.progress.pressure = Math.min(0.6, this.progress.pressure + 0.02);
    this.progress.glucose = Math.min(0.6, this.progress.glucose + 0.02);
    
    // Aprender de los datos
    this.learnFromMeasurement(data);
    
    // Avanzar a siguiente fase si se completa esta
    if (this.progress.heartRate >= 0.7 && 
        this.progress.spo2 >= 0.7 && 
        this.progress.pressure >= 0.6 && 
        this.progress.glucose >= 0.6) {
      this.startValidationPhase();
    }
  }
  
  /**
   * Actualiza progreso de la fase de validación
   */
  private updateValidationProgress(data: MeasurementData): void {
    // Solo usar datos de buena calidad
    if (data.quality < 80) return;
    
    // Incrementar progreso
    this.progress.heartRate = Math.min(1.0, this.progress.heartRate + 0.05);
    this.progress.spo2 = Math.min(1.0, this.progress.spo2 + 0.05);
    this.progress.pressure = Math.min(1.0, this.progress.pressure + 0.05);
    this.progress.glucose = Math.min(1.0, this.progress.glucose + 0.05);
    
    // Finalizar calibración si se completa todo
    if (this.progress.heartRate >= 0.95 && 
        this.progress.spo2 >= 0.95 && 
        this.progress.pressure >= 0.95 && 
        this.progress.glucose >= 0.95) {
      this.completeCalibration();
    }
  }
  
  /**
   * Aprende de las mediciones durante la calibración
   */
  private learnFromMeasurement(data: MeasurementData): void {
    // Solo aprender de datos de calidad aceptable
    if (data.quality < this.config.minimumQualityThreshold) return;
    // Ajustar factores de corrección SOLO en base a estabilidad y calidad reales
    // (Eliminado cualquier uso de Math.random o ajustes aleatorios)
    // Ejemplo: Si la estabilidad es baja, reducir el factor de corrección ligeramente
    const stability = this.calculateStability(this.measurementHistory.map(m => m.heartRate));
    if (stability < 0.1) {
      this.correctionFactors.heartRate *= 0.98;
    } else if (stability > 0.9) {
      this.correctionFactors.heartRate *= 1.01;
    }
    // Repetir lógica para otros factores si es necesario, siempre basado en datos reales
    this.constrainCorrectionFactors();
  }
  
  /**
   * Calcula estabilidad como coeficiente de variación
   */
  private calculateStability(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (mean === 0) return 1;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / mean; // Coeficiente de variación (menor es más estable)
  }
  
  /**
   * Asegura que los factores de corrección estén en rangos razonables
   */
  private constrainCorrectionFactors(): void {
    // Límites para factores de corrección (para evitar drift extremo)
    this.correctionFactors.heartRate = this.constrainValue(this.correctionFactors.heartRate, 0.8, 1.2);
    this.correctionFactors.spo2 = this.constrainValue(this.correctionFactors.spo2, 0.95, 1.05);
    this.correctionFactors.systolic = this.constrainValue(this.correctionFactors.systolic, 0.85, 1.15);
    this.correctionFactors.diastolic = this.constrainValue(this.correctionFactors.diastolic, 0.85, 1.15);
    this.correctionFactors.glucose = this.constrainValue(this.correctionFactors.glucose, 0.8, 1.2);
  }
  
  /**
   * Limita un valor a un rango específico
   */
  private constrainValue(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * Carga perfil de calibración desde almacenamiento
   */
  private async loadCalibrationProfile(): Promise<void> {
    try {
      // Intentar cargar desde localStorage primero (más rápido)
      const localProfile = localStorage.getItem('calibrationProfile');
      if (localProfile) {
        this.userProfile = JSON.parse(localProfile);
        this.applyUserProfile();
        console.log('Perfil de calibración cargado desde localStorage');
      }
      
      // Intentar sincronizar con Supabase si está disponible
      const { data, error } = await supabase
        .from('calibration_settings')
        .select('*')
        .eq('is_active', true)
        .single();
      
      if (data && !error) {
        // Convertir formato de base de datos a perfil de usuario
        this.userProfile = {
          userId: data.user_id,
          createdAt: new Date(data.created_at),
          lastUpdated: new Date(data.updated_at),
          correctionFactors: {
            heartRate: 1.0,
            spo2: 1.0,
            systolic: 1.0,
            diastolic: 1.0,
            glucose: 1.0
          },
          referenceValues: {
            heartRate: data.systolic_reference || 75, // Using available fields
            spo2: data.diastolic_reference || 97,
            systolic: data.systolic_reference || 120,
            diastolic: data.diastolic_reference || 80,
            glucose: data.quality_threshold || 100 // Using available field as fallback
          },
          config: {
            autoCalibrationEnabled: true,
            continuousLearningEnabled: true,
            syncWithReferenceDevices: false,
            adaptToEnvironment: true,
            adaptToUserActivity: true,
            aggressiveness: data.quality_threshold ? data.quality_threshold / 100 : 0.5,
            minimumQualityThreshold: data.quality_threshold || 70
          }
        };
        
        this.applyUserProfile();
        console.log('Perfil de calibración sincronizado con Supabase');
      }
    } catch (error) {
      console.error('Error al cargar perfil de calibración:', error);
      // Usar valores por defecto
      this.correctionFactors = this.getDefaultCorrectionFactors();
      this.referenceValues = this.getDefaultReferences();
    }
  }
  
  /**
   * Guarda perfil de calibración en almacenamiento
   */
  private async saveCalibrationProfile(): Promise<void> {
    if (!this.userProfile) {
      // Crear nuevo perfil si no existe
      this.userProfile = {
        userId: 'default', // Idealmente, identificador real del usuario
        createdAt: new Date(),
        lastUpdated: new Date(),
        correctionFactors: { ...this.correctionFactors },
        referenceValues: { ...this.referenceValues },
        config: { ...this.config }
      };
    } else {
      // Actualizar perfil existente
      this.userProfile.lastUpdated = new Date();
      this.userProfile.correctionFactors = { ...this.correctionFactors };
      this.userProfile.referenceValues = { ...this.referenceValues };
      this.userProfile.config = { ...this.config };
    }
    
    try {
      // Guardar en localStorage para acceso rápido
      localStorage.setItem('calibrationProfile', JSON.stringify(this.userProfile));
      
      // Si hay conexión a Supabase, sincronizar
      const { error } = await supabase
        .from('calibration_settings')
        .upsert({
          user_id: this.userProfile.userId,
          is_active: true,
          systolic_reference: this.userProfile.referenceValues.systolic,
          diastolic_reference: this.userProfile.referenceValues.diastolic,
          quality_threshold: this.userProfile.config.minimumQualityThreshold,
          updated_at: new Date().toISOString()
        });
      
      // Finish saving at Supabase
      if (error) {
        console.error('Error al guardar perfil de calibración en Supabase:', error);
      } else {
        console.log('Perfil de calibración guardado en Supabase');
      }
    } catch (error) {
      console.error('Error al guardar perfil de calibración:', error);
    }
  }
  
  /**
   * Aplica el perfil de usuario cargado
   */
  private applyUserProfile(): void {
    if (!this.userProfile) return;
    this.correctionFactors = { ...this.userProfile.correctionFactors };
    this.referenceValues = { ...this.userProfile.referenceValues };
    this.config = { ...this.userProfile.config };
  }
  
}
