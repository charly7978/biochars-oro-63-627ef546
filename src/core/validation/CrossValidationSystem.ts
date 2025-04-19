import { getModel } from '../neural/ModelRegistry';
import { HeartRateNeuralModel } from '../neural/HeartRateModel';
import { SpO2NeuralModel } from '../neural/SpO2Model';
import { BloodPressureNeuralModel } from '../neural/BloodPressureModel';
import { GlucoseNeuralModel } from '../neural/GlucoseModel';
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
    
    // Obtener valores de modelos alternativos
    const alternativeValues = this.getAlternativeValues(metric, signal);
    
    // Si calidad es baja, siempre usar modelos alternativos
    const forceAlternatives = quality < 70;
    
    // Calcular consenso y divergencia
    const { consensusValue, confidence, divergenceScore } = 
      this.calculateConsensus(metric, value, alternativeValues, forceAlternatives);
    
    // Generar recomendaciones
    let recommendations = this.generateRecommendations(
      metric, value, consensusValue, confidence, divergenceScore, quality
    );
    
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
        recommendations.push('VETO: Resultados fisiológicamente incoherentes. Medición descartada automáticamente.');
        vetoed = true;
      }
    }
    
    // Determinar si se usó un valor alternativo
    const usedAlternativeModel = Math.abs(consensusValue - value) / value > 0.01;
    
    // Crear resultado
    const result: ValidationResult = {
      metric,
      primaryValue: value,
      alternativeValues: alternativeValues.map(v => v.value),
      confidence,
      consensusValue: vetoed ? 0 : consensusValue,
      divergenceScore,
      recommendations,
      usedAlternativeModel
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
    // Obtener valores alternativos
    const alternativeValues = this.getAlternativeValues(metric, signal);
    
    // Calcular consenso dando menos peso al valor original
    const { consensusValue, confidence } = this.calculateConsensus(
      metric, value, alternativeValues, true,
      anomaly ? 0.3 : 0.6
    );
    
    // Generar explicaciones
    const explanations = [];
    
    if (anomaly) {
      explanations.push(`Se detectó una anomalía: ${anomaly.description}`);
      explanations.push(`La medición original (${value.toFixed(1)}) está fuera del rango esperado.`);
    } else {
      explanations.push(`La medición original (${value.toFixed(1)}) parece atípica.`);
    }
    
    explanations.push(`Se utilizaron ${alternativeValues.length} métodos alternativos de estimación.`);
    
    if (Math.abs(consensusValue - value) / value > 0.1) {
      explanations.push(`Hay una discrepancia del ${(Math.abs(consensusValue - value) / value * 100).toFixed(1)}% entre la medición original y el consenso.`);
    }
    
    // Métodos utilizados
    const methods = [
      'Modelo neural principal',
      ...alternativeValues.map(v => `Modelo alternativo: ${v.modelName}`)
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
   * Obtiene valores de modelos alternativos
   */
  private getAlternativeValues(metric: string, signal: number[]): Array<{value: number, modelName: string, confidence: number}> {
    const results: Array<{value: number, modelName: string, confidence: number}> = [];
    
    if (!this.config.useSecondaryModelsAlways && signal.length < 200) {
      return results;
    }
    
    // Obtener modelo neural principal
    let primaryModel: any = null;
    if (metric === 'heartRate') {
      primaryModel = getModel<HeartRateNeuralModel>('heartRate');
    } else if (metric === 'spo2') {
      primaryModel = getModel<SpO2NeuralModel>('spo2');
    } else if (metric === 'systolic' || metric === 'diastolic') {
      primaryModel = getModel<BloodPressureNeuralModel>('bloodPressure');
    } else if (metric === 'glucose') {
      primaryModel = getModel<GlucoseNeuralModel>('glucose');
    }
    
    // Añadir predicción del modelo neural
    if (primaryModel) {
      try {
        let neuralValue: number;
        
        if (metric === 'systolic') {
          const bpResult = primaryModel.predict(signal);
          neuralValue = bpResult[0];
        } else if (metric === 'diastolic') {
          const bpResult = primaryModel.predict(signal);
          neuralValue = bpResult[1];
        } else {
          neuralValue = primaryModel.predict(signal)[0];
        }
        
        results.push({
          value: neuralValue,
          modelName: 'NeuralModel',
          confidence: this.modelConfidence.get(`neural_${metric}`) || 0.8
        });
      } catch (error) {
        console.error(`Error al obtener predicción del modelo neural:`, error);
      }
    }
    
    // Obtener modelos alternativos
    let alternativeModelsKey = metric;
    if (metric === 'systolic' || metric === 'diastolic') {
      alternativeModelsKey = 'bloodPressure';
    }
    
    const alternativeModels = this.alternativeModels.get(alternativeModelsKey) || [];
    
    // Aplicar cada modelo alternativo
    for (const model of alternativeModels) {
      try {
        let altValue = model.predict(signal);
        
        if (alternativeModelsKey === 'bloodPressure') {
          if (metric === 'systolic') {
            altValue = altValue.systolic;
          } else if (metric === 'diastolic') {
            altValue = altValue.diastolic;
          }
        }
        
        const modelConfidence = this.modelConfidence.get(`${model.name}_${alternativeModelsKey}`) || 0.6;
        
        results.push({
          value: altValue,
          modelName: model.name,
          confidence: modelConfidence
        });
      } catch (error) {
        console.error(`Error al aplicar modelo alternativo:`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Calcula consenso entre valores de diferentes modelos
   */
  private calculateConsensus(
    metric: string,
    primaryValue: number,
    alternativeValues: Array<{value: number, modelName: string, confidence: number}>,
    forceAlternatives: boolean = false,
    primaryWeight: number = 0.6
  ): { consensusValue: number, confidence: number, divergenceScore: number } {
    if (alternativeValues.length === 0) {
      return { consensusValue: primaryValue, confidence: 0.8, divergenceScore: 0 };
    }
    
    // Preparar valores y pesos
    const values = [primaryValue, ...alternativeValues.map(v => v.value)];
    let weights = [primaryWeight, ...alternativeValues.map(v => ((1 - primaryWeight) / alternativeValues.length) * v.confidence)];
    
    // Normalizar pesos
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    weights = weights.map(w => w / weightSum);
    
    // Detectar valores atípicos
    let outlierIndices: number[] = [];
    if (this.config.outlierRejectionEnabled) {
      outlierIndices = this.detectOutliers(values);
    }
    
    // Ajustar pesos si hay outliers
    if (outlierIndices.length > 0) {
      if (outlierIndices.includes(0) && forceAlternatives) {
        // Excluir valor primario
        weights[0] = 0;
      }
      
      for (const idx of outlierIndices) {
        weights[idx] = 0;
      }
      
      const newWeightSum = weights.reduce((sum, w) => sum + w, 0);
      if (newWeightSum > 0) {
        weights = weights.map(w => w / newWeightSum);
      } else {
        // Restaurar pesos si todos son outliers
        weights = [primaryWeight, ...alternativeValues.map(v => ((1 - primaryWeight) / alternativeValues.length) * v.confidence)];
      }
    }
    
    // Calcular valor de consenso ponderado
    const consensusValue = values.reduce((sum, val, idx) => sum + val * weights[idx], 0);
    
    // Calcular divergencia
    const meanValue = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - meanValue, 2));
    const variance = squaredDiffs.reduce((sum, sqDiff) => sum + sqDiff, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalizar divergencia
    const divergenceScore = stdDev / (meanValue || 1);
    
    // Calcular confianza
    const meanConfidence = alternativeValues.reduce((sum, alt) => sum + alt.confidence, primaryWeight) / (alternativeValues.length + 1);
    const maxDivergence = this.config.divergenceThreshold * 2;
    const confidenceFromDivergence = Math.max(0, 1 - (divergenceScore / maxDivergence));
    
    const confidence = 0.4 * meanConfidence + 0.6 * confidenceFromDivergence;
    
    return { consensusValue, confidence, divergenceScore };
  }
  
  /**
   * Detecta valores atípicos
   */
  private detectOutliers(values: number[]): number[] {
    if (values.length < 3) return [];
    
    // Calcular mediana y MAD
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(sortedValues.length / 2)];
    
    const deviations = sortedValues.map(value => Math.abs(value - median));
    const sortedDeviations = [...deviations].sort((a, b) => a - b);
    const mad = sortedDeviations[Math.floor(sortedDeviations.length / 2)];
    
    // Identificar outliers (3*MAD)
    const threshold = 3 * mad;
    
    return values.map((v, i) => Math.abs(v - median) > threshold ? i : -1)
                .filter(i => i !== -1);
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
    
    // Actualizar confianza en modelos
    if (this.config.adaptToUserFeedback) {
      this.updateModelConfidence(metric, result);
    }
  }
  
  /**
   * Actualiza confianza en modelos
   */
  private updateModelConfidence(metric: string, result: ValidationResult): void {
    // Ejemplo simplificado basado en divergencia
    if (result.divergenceScore < 0.05) {
      const currentConfidence = this.modelConfidence.get(`neural_${metric}`) || 0.8;
      this.modelConfidence.set(`neural_${metric}`, Math.min(0.95, currentConfidence + 0.01));
    } else if (result.divergenceScore > 0.2) {
      const currentConfidence = this.modelConfidence.get(`neural_${metric}`) || 0.8;
      this.modelConfidence.set(`neural_${metric}`, Math.max(0.6, currentConfidence - 0.01));
    }
  }
  
  /**
   * Procesa feedback del usuario sobre precisión
   */
  public provideUserFeedback(metric: string, isAccurate: boolean): void {
    if (!this.config.adaptToUserFeedback) return;
    
    const history = this.validationHistory.get(metric);
    if (!history || history.length === 0) return;
    
    const lastResult = history[history.length - 1];
    const neuralConfidenceKey = `neural_${metric}`;
    let neuralConfidence = this.modelConfidence.get(neuralConfidenceKey) || 0.8;
    
    if (isAccurate) {
      neuralConfidence = Math.min(0.95, neuralConfidence + 0.02);
    } else {
      neuralConfidence = Math.max(0.5, neuralConfidence - 0.03);
      
      if (lastResult.usedAlternativeModel) {
        // Aumentar confianza de modelos alternativos
        const alternativeModels = this.alternativeModels.get(metric) || [];
        for (const model of alternativeModels) {
          const modelKey = `${model.name}_${metric}`;
          const modelConfidence = this.modelConfidence.get(modelKey) || 0.6;
          this.modelConfidence.set(modelKey, Math.min(0.9, modelConfidence + 0.03));
        }
      }
    }
    
    this.modelConfidence.set(neuralConfidenceKey, neuralConfidence);
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
