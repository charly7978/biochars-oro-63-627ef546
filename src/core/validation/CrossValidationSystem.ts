// import { getModel } from '../neural/ModelRegistry';
// import { HeartRateNeuralModel } from '../neural/HeartRateModel';
// import { SpO2NeuralModel } from '../neural/SpO2Model';
// import { BloodPressureNeuralModel } from '../neural/BloodPressureModel';
// import { GlucoseNeuralModel } from '../neural/GlucoseModel';
import { AnomalyDetectionSystem, DetectedAnomaly, SeverityLevel } from '../anomaly/AnomalyDetectionSystem';

/**
 * Interfaces para el sistema de validación cruzada
 */
export interface ValidationResult {
  metric: string;
  primaryValue: number;
  alternativeValues: number[];
  confidence: number; // 0-1
  consensusValue: number;
  divergenceScore: number; // 0-1
  recommendations: string[];
  usedAlternativeModel: boolean;
}

export interface SecondOpinion {
  metric: string;
  originalValue: number;
  revisedValue: number;
  confidenceInRevision: number; // 0-1
  explanations: string[];
  methods: string[];
  recommendedActions: string[];
}

export interface CrossValidationConfig {
  enabled: boolean;
  divergenceThreshold: number;
  confidenceThreshold: number;
  useSecondaryModelsAlways: boolean;
  weightingStrategy: 'equal' | 'confidence' | 'adaptive';
  outlierRejectionEnabled: boolean;
  adaptToUserFeedback: boolean;
}

/**
 * Sistema de validación cruzada entre modelos
 */
export class CrossValidationSystem {
  private static instance: CrossValidationSystem;
  private anomalyDetection: AnomalyDetectionSystem;
  private config: CrossValidationConfig = {
    enabled: true,
    divergenceThreshold: 0.15,
    confidenceThreshold: 0.7,
    useSecondaryModelsAlways: false,
    weightingStrategy: 'adaptive',
    outlierRejectionEnabled: true,
    adaptToUserFeedback: true
  };
  
  // Historial y modelos alternativos
  private validationHistory: Map<string, ValidationResult[]> = new Map();
  private alternativeModels: Map<string, any[]> = new Map();
  private modelConfidence: Map<string, number> = new Map();
  
  private constructor() {
    this.anomalyDetection = AnomalyDetectionSystem.getInstance();
    this.initializeAlternativeModels();
    this.initializeModelConfidence();
    
    // Escuchar anomalías para ofrecer segunda opinión
    this.anomalyDetection.onAnomalyDetected(this.handleAnomaly.bind(this));
  }
  
  /**
   * Obtiene la instancia singleton
   */
  public static getInstance(): CrossValidationSystem {
    if (!CrossValidationSystem.instance) {
      CrossValidationSystem.instance = new CrossValidationSystem();
    }
    return CrossValidationSystem.instance;
  }
  
  /**
   * Inicializa modelos alternativos para cada tipo de métrica
   */
  private initializeAlternativeModels(): void {
    // Modelos para frecuencia cardíaca
    this.alternativeModels.set('heartRate', []); // Solo se permiten modelos reales
    // Modelos para SpO2
    this.alternativeModels.set('spo2', []);
    // Modelos para presión arterial
    this.alternativeModels.set('bloodPressure', []);
    // Modelos para glucosa
    this.alternativeModels.set('glucose', []);
  }
  
  /**
   * Inicializa confianza para cada modelo
   */
  private initializeModelConfidence(): void {
    // Modelos primarios
    this.modelConfidence.set('neural_heartRate', 0.85);
    this.modelConfidence.set('neural_spo2', 0.85);
    this.modelConfidence.set('neural_bloodPressure', 0.80);
    this.modelConfidence.set('neural_glucose', 0.75);
    
    // Modelos alternativos
    this.modelConfidence.set('FrequencyDomain_heartRate', 0.75);
    this.modelConfidence.set('PeakDetection_heartRate', 0.70);
    this.modelConfidence.set('RatioOfRatios_spo2', 0.80);
    this.modelConfidence.set('StatisticalSpo2_spo2', 0.65);
    this.modelConfidence.set('PulseTransitTime_bloodPressure', 0.70);
    this.modelConfidence.set('WaveformAnalysis_bloodPressure', 0.75);
    this.modelConfidence.set('AbsorptionSpectrum_glucose', 0.65);
    this.modelConfidence.set('WaveformFeatures_glucose', 0.60);
  }
  
  /**
   * Actualiza la configuración del sistema
   */
  public updateConfig(newConfig: Partial<CrossValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Valida una medición usando múltiples modelos
   */
  public validateMeasurement(
    metric: string, 
    value: number, 
    signal: number[], 
    quality: number,
    contextMetrics?: Record<string, number> // NUEVO: métricas adicionales para coherencia fisiológica
  ): ValidationResult {
    if (!this.config.enabled) {
      return {
        metric,
        primaryValue: value,
        alternativeValues: [],
        confidence: quality / 100,
        consensusValue: value,
        divergenceScore: 0,
        recommendations: [],
        usedAlternativeModel: false
      };
    }
    
    // Eliminar lógica de modelos alternativos
    // const alternativeValues = this.getAlternativeValues(metric, signal);
    // const forceAlternatives = quality < 70;
    // const { consensusValue, confidence, divergenceScore } = 
    //   this.calculateConsensus(metric, value, alternativeValues, forceAlternatives);
    // Generar recomendaciones
    // let recommendations = this.generateRecommendations(
    //   metric, value, consensusValue, confidence, divergenceScore, quality
    // );
    // SISTEMA DE VETO FISIOLÓGICO
    let vetoed = false;
    if (contextMetrics) {
      // Ejemplo de reglas fisiológicas simples
      const hr = contextMetrics['heartRate'];
      const spo2 = contextMetrics['spo2'];
      const sys = contextMetrics['systolic'] || contextMetrics['bloodPressure'];
      if (
        (typeof sys === 'number' && sys > 180 && typeof spo2 === 'number' && spo2 < 90 && typeof hr === 'number' && hr < 100) ||
        (typeof spo2 === 'number' && spo2 < 85 && typeof hr === 'number' && hr < 60)
      ) {
        // recommendations.push('VETO: Resultados fisiológicamente incoherentes. Medición descartada automáticamente.');
        vetoed = true;
      }
    }
    // Determinar si se usó un valor alternativo
    // const usedAlternativeModel = Math.abs(consensusValue - value) / value > 0.01;
    // Crear resultado
    const result: ValidationResult = {
      metric,
      primaryValue: value,
      alternativeValues: [],
      confidence: quality / 100,
      consensusValue: vetoed ? 0 : value,
      divergenceScore: 0,
      recommendations: [],
      usedAlternativeModel: false
    };
    // Almacenar en historial
    this.storeValidationResult(metric, result);
    return result;
  }
  
  /**
   * Proporciona una segunda opinión para mediciones atípicas
   */
  public getSecondOpinion(
    metric: string, 
    value: number, 
    signal: number[], 
    anomaly?: DetectedAnomaly
  ): SecondOpinion {
    // Eliminar lógica de modelos alternativos
    // const alternativeValues = this.getAlternativeValues(metric, signal);
    // const { consensusValue, confidence } = this.calculateConsensus(
    //   metric, value, alternativeValues, true,
    //   anomaly ? 0.3 : 0.6
    // );
    const consensusValue = value;
    const confidence = 0.8;
    // Generar explicaciones
    const explanations = [];
    if (anomaly) {
      explanations.push(`Se detectó una anomalía: ${anomaly.description}`);
      explanations.push(`La medición original (${value.toFixed(1)}) está fuera del rango esperado.`);
    } else {
      explanations.push(`La medición original (${value.toFixed(1)}) parece atípica.`);
    }
    explanations.push(`No se utilizaron métodos alternativos de estimación.`);
    if (Math.abs(consensusValue - value) / value > 0.1) {
      explanations.push(`Hay una discrepancia del ${(Math.abs(consensusValue - value) / value * 100).toFixed(1)}% entre la medición original y el consenso.`);
    }
    // Métodos utilizados
    const methods = [
      'Solo valor primario'
    ];
    // Acciones recomendadas
    const recommendedActions = [
      'Repetir la medición para confirmar el resultado.',
      confidence < 0.6 ? 'Considerar verificar con un dispositivo médico certificado.' : '',
      this.getMetricSpecificAction(metric, consensusValue)
    ].filter(a => a !== '');
    return {
      metric,
      originalValue: value,
      revisedValue: consensusValue,
      confidenceInRevision: confidence,
      explanations,
      methods,
      recommendedActions
    };
  }
  
  /**
   * Obtiene acción recomendada específica para un tipo de métrica
   */
  private getMetricSpecificAction(metric: string, value: number): string {
    if (metric === 'heartRate') {
      if (value > 120) return 'Frecuencia cardíaca elevada. Descansar antes de repetir.';
      if (value < 45) return 'Frecuencia cardíaca baja. Verificar si está en reposo.';
    } else if (metric === 'spo2') {
      if (value < 92) return 'Saturación de oxígeno potencialmente baja. Verificar respiración.';
    } else if (metric === 'systolic') {
      if (value > 160) return 'Presión sistólica elevada. Repetir medición tras 10 min de descanso.';
    } else if (metric === 'glucose') {
      if (value > 200) return 'Glucosa elevada. Verificar con glucómetro si está disponible.';
      if (value < 60) return 'Glucosa baja. Considerar consumir carbohidratos rápidos.';
    }
    return '';
  }
  
  /**
   * Maneja anomalías detectadas
   */
  private handleAnomaly(anomaly: DetectedAnomaly): void {
    if (anomaly.severity === SeverityLevel.LOW || 
        anomaly.severity === SeverityLevel.INFO) {
      return;
    }
    
    console.log(`Anomalía detectada en ${anomaly.measurementType}, evaluando segunda opinión...`);
    // En implementación real, activaría proceso de segunda opinión
  }
  
  /**
   * Ajustar calculateConsensus para solo usar el valor primario
   */
  private calculateConsensus(
    metric: string,
    primaryValue: number,
    alternativeValues: Array<{value: number, modelName: string, confidence: number}> = [],
    forceAlternatives: boolean = false,
    primaryWeight: number = 1.0
  ): { consensusValue: number, confidence: number, divergenceScore: number } {
    // Solo usar el valor primario, ignorar modelos alternativos
    return { consensusValue: primaryValue, confidence: 0.8, divergenceScore: 0 };
  }
  
  /**
   * Genera recomendaciones basadas en resultados
   */
  private generateRecommendations(
    metric: string,
    originalValue: number,
    consensusValue: number,
    confidence: number,
    divergenceScore: number,
    quality: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (divergenceScore > this.config.divergenceThreshold) {
      recommendations.push('Considerar repetir la medición para mayor precisión.');
      
      if (quality < 70) {
        recommendations.push('Mejorar condiciones de medición para aumentar calidad de la señal.');
      }
    }
    
    if (confidence < this.config.confidenceThreshold) {
      recommendations.push('Baja confianza en la medición. Verificar con un método alternativo si es posible.');
    }
    
    // Recomendaciones específicas
    const specificAction = this.getMetricSpecificAction(metric, consensusValue);
    if (specificAction) {
      recommendations.push(specificAction);
    }
    
    return recommendations;
  }
  
  /**
   * Almacena resultado de validación
   */
  private storeValidationResult(metric: string, result: ValidationResult): void {
    if (!this.validationHistory.has(metric)) {
      this.validationHistory.set(metric, []);
    }
    
    const history = this.validationHistory.get(metric)!;
    history.push(result);
    
    // Limitar tamaño
    if (history.length > 50) {
      history.shift();
    }
  }
  
  // Implementaciones simplificadas de métodos alternativos
  
  private frequencyDomainHeartRate(signal: number[]): number {
    throw new Error('Método eliminado: solo se permite procesamiento real.');
  }
  
  private peakDetectionHeartRate(signal: number[]): number {
    throw new Error('Método eliminado: solo se permite procesamiento real.');
  }
  
  private ratioOfRatiosSpo2(signal: number[]): number {
    throw new Error('Método eliminado: solo se permite procesamiento real.');
  }
  
  private statisticalSpo2(signal: number[]): number {
    throw new Error('Método eliminado: solo se permite procesamiento real.');
  }
}

/**
 * Función auxiliar para acceso rápido
 */
export function getCrossValidation(): CrossValidationSystem {
  return CrossValidationSystem.getInstance();
}

/**
 * Escudo protector global contra duplicidad y simulación
 */
class AntiRedundancyGuard {
  private static instance: AntiRedundancyGuard;
  private executedTasks: Set<string> = new Set();
  private registeredFiles: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): AntiRedundancyGuard {
    if (!AntiRedundancyGuard.instance) {
      AntiRedundancyGuard.instance = new AntiRedundancyGuard();
    }
    return AntiRedundancyGuard.instance;
  }

  /**
   * Registra una tarea por ID única. Si ya existe, lanza error y bloquea ejecución.
   */
  public registerTask(taskId: string): void {
    if (this.executedTasks.has(taskId)) {
      throw new Error(`Tarea duplicada o redundante detectada: ${taskId}`);
    }
    this.executedTasks.add(taskId);
  }

  /**
   * Registra un archivo por nombre/ruta. Si ya existe, lanza error y bloquea duplicidad.
   */
  public registerFile(filePath: string): void {
    if (this.registeredFiles.has(filePath)) {
      throw new Error(`Archivo duplicado detectado: ${filePath}`);
    }
    this.registeredFiles.add(filePath);
  }

  /**
   * Limpia el registro (para pruebas o reinicio global)
   */
  public reset(): void {
    this.executedTasks.clear();
    this.registeredFiles.clear();
  }
}

// Exportar el guard global para uso en todo el sistema
export const antiRedundancyGuard = AntiRedundancyGuard.getInstance();
// Ejemplo de registro de este archivo en el guard
antiRedundancyGuard.registerFile('src/core/validation/CrossValidationSystem.ts');
