
import { IntelligentCalibrationSystem, MeasurementData } from '../calibration/IntelligentCalibrationSystem';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tipos de anomalías que el sistema puede detectar
 */
export enum AnomalyType {
  STATISTICAL_OUTLIER = 'statistical_outlier',
  RAPID_CHANGE = 'rapid_change',
  PATTERN_BREAK = 'pattern_break',
  PHYSIOLOGICAL_IMPOSSIBLE = 'physiological_impossible',
  SIGNAL_DISRUPTION = 'signal_disruption',
  SENSOR_ERROR = 'sensor_error',
  UNEXPECTED_CORRELATION = 'unexpected_correlation'
}

/**
 * Niveles de severidad para las anomalías detectadas
 */
export enum SeverityLevel {
  INFO = 'info',           // Solo informativo
  LOW = 'low',             // Atención leve requerida
  MEDIUM = 'medium',       // Atención significativa requerida
  HIGH = 'high',           // Atención urgente requerida
  CRITICAL = 'critical'    // Emergencia médica potencial
}

/**
 * Configuración de detección para un tipo específico de medida
 */
export interface AnomalyDetectionConfig {
  enabled: boolean;
  thresholds: {
    statistical: {
      zscore: number;              // Umbral de Z-score (típicamente 2-3)
      percentileRange: [number, number]; // Rango de percentiles (ej: [5, 95])
    };
    rapidChange: {
      maxPercentChange: number;    // Cambio máximo permitido (porcentaje)
      maxAbsoluteChange: number;   // Cambio máximo permitido (valor absoluto)
      timeWindowMs: number;        // Ventana de tiempo para analizar cambios (ms)
    };
    patternBreak: {
      sensitivity: number;         // 0-1, qué tan sensible es la detección
      minPatternLength: number;    // Mínimo de puntos para establecer un patrón
    };
    physiological: {
      min: number;                 // Valor mínimo fisiológicamente posible
      max: number;                 // Valor máximo fisiológicamente posible
      minDelta: number;            // Cambio mínimo esperado entre mediciones
      maxDelta: number;            // Cambio máximo esperado entre mediciones
    };
    correlation: {
      expectedCorrelations: {      // Correlaciones esperadas con otras medidas
        [key: string]: [number, number]; // [min, max] correlación esperada
      };
    };
  };
  alerting: {
    enabled: boolean;
    minSeverityToAlert: SeverityLevel;
    debounceMs: number;            // Tiempo mínimo entre alertas (ms)
    suppressRecurring: boolean;    // Suprimir alertas recurrentes del mismo tipo
    notifyTypes: AnomalyType[];    // Tipos de anomalías que generan alertas
  };
}

/**
 * Anomalía detectada
 */
export interface DetectedAnomaly {
  id: string;
  timestamp: number;
  type: AnomalyType;
  measurementType: string;
  value: number;
  expectedRange: [number, number];
  deviation: number;               // Cuánto se desvía del rango esperado
  severity: SeverityLevel;
  description: string;
  isAcknowledged: boolean;
  metadata?: any;
}

/**
 * Configuración por defecto para cada tipo de medida
 */
const DEFAULT_CONFIGS: Record<string, AnomalyDetectionConfig> = {
  heartRate: {
    enabled: true,
    thresholds: {
      statistical: {
        zscore: 2.5,
        percentileRange: [5, 95]
      },
      rapidChange: {
        maxPercentChange: 30,    // 30% cambio máximo entre lecturas
        maxAbsoluteChange: 30,   // 30bpm cambio máximo 
        timeWindowMs: 60000      // en un minuto
      },
      patternBreak: {
        sensitivity: 0.7,
        minPatternLength: 5
      },
      physiological: {
        min: 30,                // 30bpm mínimo fisiológico
        max: 220,               // 220bpm máximo fisiológico
        minDelta: 0,            // Puede no cambiar
        maxDelta: 40            // Máximo cambio fisiológico normal
      },
      correlation: {
        expectedCorrelations: {
          'spo2': [-0.2, 0.5]   // Correlación moderada negativa a positiva
        }
      }
    },
    alerting: {
      enabled: true,
      minSeverityToAlert: SeverityLevel.MEDIUM,
      debounceMs: 300000,       // 5 minutos entre alertas
      suppressRecurring: true,
      notifyTypes: [
        AnomalyType.PHYSIOLOGICAL_IMPOSSIBLE,
        AnomalyType.RAPID_CHANGE,
        AnomalyType.PATTERN_BREAK
      ]
    }
  },
  spo2: {
    enabled: true,
    thresholds: {
      statistical: {
        zscore: 2.2,            // Más sensible que otros
        percentileRange: [10, 95]
      },
      rapidChange: {
        maxPercentChange: 10,    // 10% cambio máximo
        maxAbsoluteChange: 5,    // 5% cambio absoluto
        timeWindowMs: 60000      // en un minuto
      },
      patternBreak: {
        sensitivity: 0.8,        // Mayor sensibilidad
        minPatternLength: 4
      },
      physiological: {
        min: 70,                // 70% mínimo (niveles peligrosos)
        max: 100,               // 100% máximo teórico
        minDelta: 0,
        maxDelta: 10            // Máximo cambio esperado
      },
      correlation: {
        expectedCorrelations: {
          'heartRate': [-0.2, 0.5]
        }
      }
    },
    alerting: {
      enabled: true,
      minSeverityToAlert: SeverityLevel.LOW, // Más sensible para SpO2
      debounceMs: 180000,       // 3 minutos entre alertas
      suppressRecurring: false, // No suprimir para SpO2 (crítico)
      notifyTypes: [
        AnomalyType.PHYSIOLOGICAL_IMPOSSIBLE,
        AnomalyType.RAPID_CHANGE,
        AnomalyType.STATISTICAL_OUTLIER
      ]
    }
  },
  bloodPressure: {
    enabled: true,
    thresholds: {
      statistical: {
        zscore: 2.5,
        percentileRange: [5, 95]
      },
      rapidChange: {
        maxPercentChange: 20,
        maxAbsoluteChange: 25,   // 25mmHg cambio máximo
        timeWindowMs: 300000     // en 5 minutos
      },
      patternBreak: {
        sensitivity: 0.6,
        minPatternLength: 3
      },
      physiological: {
        min: 60,                // 60mmHg sistólica mínima
        max: 220,               // 220mmHg sistólica máxima
        minDelta: 0,
        maxDelta: 30
      },
      correlation: {
        expectedCorrelations: {
          'heartRate': [0.3, 0.7] // Correlación positiva
        }
      }
    },
    alerting: {
      enabled: true,
      minSeverityToAlert: SeverityLevel.MEDIUM,
      debounceMs: 7200000,      // 2 horas entre alertas
      suppressRecurring: true,
      notifyTypes: [
        AnomalyType.PHYSIOLOGICAL_IMPOSSIBLE,
        AnomalyType.PATTERN_BREAK,
        AnomalyType.UNEXPECTED_CORRELATION
      ]
    }
  },
  glucose: {
    enabled: true,
    thresholds: {
      statistical: {
        zscore: 2.5,
        percentileRange: [1, 99] // Rango más amplio
      },
      rapidChange: {
        maxPercentChange: 50,    // Cambios de hasta 50% pueden ser normales post-comida
        maxAbsoluteChange: 80,   // 80mg/dL cambio máximo
        timeWindowMs: 1800000    // en 30 minutos
      },
      patternBreak: {
        sensitivity: 0.5,        // Menor sensibilidad (alta variabilidad normal)
        minPatternLength: 6
      },
      physiological: {
        min: 40,                // 40mg/dL mínimo (hipoglucemia severa)
        max: 400,               // 400mg/dL máximo (hiperglucemia severa)
        minDelta: 0,
        maxDelta: 100           // Cambios post-prandiales pueden ser grandes
      },
      correlation: {
        expectedCorrelations: {}  // Correlaciones menos significativas
      }
    },
    alerting: {
      enabled: true,
      minSeverityToAlert: SeverityLevel.MEDIUM,
      debounceMs: 3600000,      // 1 hora entre alertas
      suppressRecurring: true,
      notifyTypes: [
        AnomalyType.PHYSIOLOGICAL_IMPOSSIBLE,
        AnomalyType.RAPID_CHANGE,
        AnomalyType.STATISTICAL_OUTLIER
      ]
    }
  }
};

/**
 * Sistema de Detección de Anomalías
 * 
 * Detecta anomalías en las mediciones biométricas utilizando múltiples enfoques:
 * 1. Análisis estadístico (outliers, percentiles)
 * 2. Detección de cambios rápidos
 * 3. Ruptura de patrones
 * 4. Validación fisiológica
 * 5. Análisis de correlación entre medidas
 */
export class AnomalyDetectionSystem {
  private static instance: AnomalyDetectionSystem;
  
  private configs: Record<string, AnomalyDetectionConfig> = {};
  private history: Record<string, MeasurementData[]> = {};
  private anomalies: DetectedAnomaly[] = [];
  private lastAlertTimes: Record<string, number> = {};
  private lastDetectedAnomalies: Record<string, DetectedAnomaly> = {};
  
  // Estadísticas de línea base
  private baselineStats: Record<string, {
    mean: number;
    stdDev: number;
    median: number;
    percentiles: Record<number, number>;
    patternLength: number;
    isBaseline: boolean;
  }> = {};
  
  // Callbacks
  private onAnomalyDetectedCallbacks: ((anomaly: DetectedAnomaly) => void)[] = [];
  
  private constructor() {
    // Inicializar con configuraciones por defecto
    this.configs = JSON.parse(JSON.stringify(DEFAULT_CONFIGS));
    this.loadUserConfigurations();
  }
  
  /**
   * Obtiene la instancia singleton del sistema
   */
  public static getInstance(): AnomalyDetectionSystem {
    if (!AnomalyDetectionSystem.instance) {
      AnomalyDetectionSystem.instance = new AnomalyDetectionSystem();
    }
    return AnomalyDetectionSystem.instance;
  }
  
  /**
   * Procesa una nueva medición para detectar anomalías
   */
  public processMeasurement(data: MeasurementData): DetectedAnomaly[] {
    const detectedAnomalies: DetectedAnomaly[] = [];
    
    // Procesar cada tipo de medición
    this.processMetric('heartRate', data.heartRate, data, detectedAnomalies);
    this.processMetric('spo2', data.spo2, data, detectedAnomalies);
    
    // Procesar presión arterial (sistólica y diastólica)
    this.processMetric('systolic', data.systolic, data, detectedAnomalies);
    this.processMetric('diastolic', data.diastolic, data, detectedAnomalies);
    
    // Procesar glucosa
    this.processMetric('glucose', data.glucose, data, detectedAnomalies);
    
    // Almacenar nuevas anomalías y actualizar historial
    if (detectedAnomalies.length > 0) {
      this.anomalies = [...this.anomalies, ...detectedAnomalies];
      
      // Limitar tamaño del historial de anomalías
      if (this.anomalies.length > 100) {
        this.anomalies = this.anomalies.slice(-100);
      }
      
      // Notificar a los observadores
      this.notifyAnomalyDetection(detectedAnomalies);
    }
    
    // Actualizar historial de mediciones
    this.updateMeasurementHistory(data);
    
    return detectedAnomalies;
  }
  
  /**
   * Registra un callback para cuando se detecta una anomalía
   */
  public onAnomalyDetected(callback: (anomaly: DetectedAnomaly) => void): void {
    this.onAnomalyDetectedCallbacks.push(callback);
  }
  
  /**
   * Obtiene anomalías detectadas recientemente
   */
  public getRecentAnomalies(count: number = 10): DetectedAnomaly[] {
    return this.anomalies.slice(-count);
  }
  
  /**
   * Marca una anomalía como reconocida
   */
  public acknowledgeAnomaly(anomalyId: string): boolean {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    if (anomaly) {
      anomaly.isAcknowledged = true;
      return true;
    }
    return false;
  }
  
  /**
   * Actualiza la configuración para un tipo de métrica
   */
  public updateConfig(metricType: string, config: Partial<AnomalyDetectionConfig>): void {
    // Asegurarse de que la configuración existe
    if (!this.configs[metricType]) {
      if (DEFAULT_CONFIGS[metricType]) {
        this.configs[metricType] = JSON.parse(JSON.stringify(DEFAULT_CONFIGS[metricType]));
      } else {
        console.error(`No hay configuración por defecto para el tipo: ${metricType}`);
        return;
      }
    }
    
    // Aplicar actualización parcial
    this.configs[metricType] = this.mergeConfigs(this.configs[metricType], config);
    
    // Guardar configuración actualizada
    this.saveUserConfigurations();
    
    console.log(`Configuración actualizada para ${metricType}:`, this.configs[metricType]);
  }
  
  /**
   * Resetea la configuración a valores por defecto
   */
  public resetConfig(metricType?: string): void {
    if (metricType) {
      // Resetear configuración específica
      if (DEFAULT_CONFIGS[metricType]) {
        this.configs[metricType] = JSON.parse(JSON.stringify(DEFAULT_CONFIGS[metricType]));
      }
    } else {
      // Resetear todas las configuraciones
      this.configs = JSON.parse(JSON.stringify(DEFAULT_CONFIGS));
    }
    
    // Guardar configuraciones
    this.saveUserConfigurations();
  }
  
  /**
   * Obtiene la configuración actual de un tipo de métrica
   */
  public getConfig(metricType: string): AnomalyDetectionConfig | null {
    return this.configs[metricType] || null;
  }
  
  /**
   * Obtiene todas las configuraciones
   */
  public getAllConfigs(): Record<string, AnomalyDetectionConfig> {
    return { ...this.configs };
  }
  
  /**
   * Procesa un tipo específico de métrica
   */
  private processMetric(
    metricType: string, 
    value: number, 
    fullData: MeasurementData, 
    detectedAnomalies: DetectedAnomaly[]
  ): void {
    // Verificar si hay configuración para este tipo
    const config = this.getEffectiveConfig(metricType);
    if (!config || !config.enabled) return;
    
    // Verificar calidad de la señal
    if (fullData.quality < 50) {
      // Para señales de baja calidad, solo detectar anomalías graves
      this.detectPhysiologicalAnomaly(metricType, value, config, detectedAnomalies);
      return;
    }
    
    // Actualizar estadísticas si es necesario
    this.updateBaselineStats(metricType, value);
    
    // Aplicar cada tipo de detección
    this.detectStatisticalAnomaly(metricType, value, config, detectedAnomalies);
    this.detectRapidChangeAnomaly(metricType, value, config, detectedAnomalies);
    this.detectPatternBreakAnomaly(metricType, value, config, detectedAnomalies);
    this.detectPhysiologicalAnomaly(metricType, value, config, detectedAnomalies);
    this.detectCorrelationAnomaly(metricType, value, fullData, config, detectedAnomalies);
  }
  
  /**
   * Obtiene la configuración efectiva para un tipo de métrica
   */
  private getEffectiveConfig(metricType: string): AnomalyDetectionConfig | null {
    // Primero buscar configuración específica
    if (this.configs[metricType]) {
      return this.configs[metricType];
    }
    
    // Si no hay específica, buscar en configuraciones por defecto
    if (DEFAULT_CONFIGS[metricType]) {
      // Crear una copia y almacenarla
      this.configs[metricType] = JSON.parse(JSON.stringify(DEFAULT_CONFIGS[metricType]));
      return this.configs[metricType];
    }
    
    // Para presión arterial, aplicar configuración combinada
    if (metricType === 'systolic' || metricType === 'diastolic') {
      if (this.configs['bloodPressure']) {
        return this.configs['bloodPressure'];
      } else if (DEFAULT_CONFIGS['bloodPressure']) {
        this.configs['bloodPressure'] = JSON.parse(JSON.stringify(DEFAULT_CONFIGS['bloodPressure']));
        return this.configs['bloodPressure'];
      }
    }
    
    return null;
  }
  
  /**
   * Detecta anomalías estadísticas (outliers)
   */
  private detectStatisticalAnomaly(
    metricType: string,
    value: number,
    config: AnomalyDetectionConfig,
    detectedAnomalies: DetectedAnomaly[]
  ): void {
    const stats = this.baselineStats[metricType];
    if (!stats || !stats.isBaseline) return; // No hay suficientes datos para línea base
    
    // Calcular Z-score
    const zscore = Math.abs((value - stats.mean) / (stats.stdDev || 1));
    
    // Verificar percentiles
    const [minPercentile, maxPercentile] = config.thresholds.statistical.percentileRange;
    const minValue = stats.percentiles[minPercentile] || (stats.mean - 2 * stats.stdDev);
    const maxValue = stats.percentiles[maxPercentile] || (stats.mean + 2 * stats.stdDev);
    
    // Determinar si hay anomalía
    if (zscore > config.thresholds.statistical.zscore || 
        value < minValue || 
        value > maxValue) {
      
      // Calcular severidad basada en cuánto excede el umbral
      let severity: SeverityLevel;
      if (zscore > config.thresholds.statistical.zscore * 2) {
        severity = SeverityLevel.HIGH;
      } else if (zscore > config.thresholds.statistical.zscore * 1.5) {
        severity = SeverityLevel.MEDIUM;
      } else {
        severity = SeverityLevel.LOW;
      }
      
      // Crear anomalía
      const anomaly: DetectedAnomaly = {
        id: `stat_${metricType}_${Date.now()}`,
        timestamp: Date.now(),
        type: AnomalyType.STATISTICAL_OUTLIER,
        measurementType: metricType,
        value,
        expectedRange: [minValue, maxValue],
        deviation: Math.max(
          value < minValue ? minValue - value : 0,
          value > maxValue ? value - maxValue : 0
        ),
        severity,
        description: `Valor de ${metricType} (${value}) está fuera del rango estadístico esperado (${minValue.toFixed(1)}-${maxValue.toFixed(1)})`,
        isAcknowledged: false,
        metadata: { zscore }
      };
      
      detectedAnomalies.push(anomaly);
      
      // Considerar alerta
      this.considerAlert(anomaly, config);
    }
  }
  
  /**
   * Detecta cambios rápidos en las mediciones
   */
  private detectRapidChangeAnomaly(
    metricType: string,
    value: number,
    config: AnomalyDetectionConfig,
    detectedAnomalies: DetectedAnomaly[]
  ): void {
    const history = this.history[metricType] || [];
    if (history.length < 2) return;
    
    // Obtener últimas mediciones dentro de la ventana de tiempo
    const timeWindow = config.thresholds.rapidChange.timeWindowMs;
    const recentHistory = history.filter(
      h => Date.now() - h.timestamp < timeWindow
    );
    
    if (recentHistory.length < 2) return;
    
    // Obtener valor previo más cercano en el tiempo
    const prevData = recentHistory[recentHistory.length - 1];
    let prevValue: number;
    
    switch (metricType) {
      case 'heartRate': prevValue = prevData.heartRate; break;
      case 'spo2': prevValue = prevData.spo2; break;
      case 'systolic': prevValue = prevData.systolic; break;
      case 'diastolic': prevValue = prevData.diastolic; break;
      case 'glucose': prevValue = prevData.glucose; break;
      default: return;
    }
    
    // Calcular cambio
    const absoluteChange = Math.abs(value - prevValue);
    const percentChange = prevValue !== 0 ? (absoluteChange / prevValue) * 100 : 0;
    
    // Verificar si excede umbrales
    if (absoluteChange > config.thresholds.rapidChange.maxAbsoluteChange ||
        percentChange > config.thresholds.rapidChange.maxPercentChange) {
      
      // Determinar severidad
      let severity: SeverityLevel;
      const absRatio = absoluteChange / config.thresholds.rapidChange.maxAbsoluteChange;
      const pctRatio = percentChange / config.thresholds.rapidChange.maxPercentChange;
      const maxRatio = Math.max(absRatio, pctRatio);
      
      if (maxRatio > 2) {
        severity = SeverityLevel.HIGH;
      } else if (maxRatio > 1.5) {
        severity = SeverityLevel.MEDIUM;
      } else {
        severity = SeverityLevel.LOW;
      }
      
      // Ajustar severidad basado en dirección del cambio (para algunas métricas)
      if (metricType === 'spo2' && value < prevValue) {
        // Caída en saturación de oxígeno es más preocupante
        severity = this.escalateSeverity(severity);
      } else if (metricType === 'glucose') {
        // Para glucosa, descensos rápidos son más preocupantes que aumentos
        if (value < prevValue && value < 70) {
          severity = this.escalateSeverity(severity);
        }
      }
      
      // Crear anomalía
      const anomaly: DetectedAnomaly = {
        id: `rapid_${metricType}_${Date.now()}`,
        timestamp: Date.now(),
        type: AnomalyType.RAPID_CHANGE,
        measurementType: metricType,
        value,
        expectedRange: [
          prevValue - config.thresholds.rapidChange.maxAbsoluteChange,
          prevValue + config.thresholds.rapidChange.maxAbsoluteChange
        ],
        deviation: absoluteChange,
        severity,
        description: `Cambio rápido en ${metricType}: de ${prevValue.toFixed(1)} a ${value.toFixed(1)} (${absoluteChange.toFixed(1)} / ${percentChange.toFixed(1)}%)`,
        isAcknowledged: false,
        metadata: { 
          timeWindow,
          prevValue,
          absoluteChange,
          percentChange,
          timeSinceLastMeasurement: Date.now() - prevData.timestamp
        }
      };
      
      detectedAnomalies.push(anomaly);
      
      // Considerar alerta
      this.considerAlert(anomaly, config);
    }
  }
  
  /**
   * Detecta rupturas en patrones establecidos
   */
  private detectPatternBreakAnomaly(
    metricType: string,
    value: number,
    config: AnomalyDetectionConfig,
    detectedAnomalies: DetectedAnomaly[]
  ): void {
    const history = this.getMetricHistory(metricType);
    if (history.length < config.thresholds.patternBreak.minPatternLength) return;
    
    // Análisis simplificado de ruptura de patrón
    // En una implementación completa, esto utilizaría métodos más sofisticados
    // de detección de patrones (ej. análisis de Fourier, HMM, etc.)
    
    // Detectamos tendencias y oscilaciones
    const trend = this.detectTrend(history);
    const oscillation = this.detectOscillation(history);
    
    // Valor predicho basado en tendencia y oscilación
    const predictedValue = this.predictNextValue(history, trend, oscillation);
    
    // Calcular desviación de la predicción
    const deviation = Math.abs(value - predictedValue);
    const meanValue = history.reduce((sum, val) => sum + val, 0) / history.length;
    const normalizedDeviation = deviation / (meanValue || 1);
    
    // Ajustar sensibilidad
    const sensitivity = config.thresholds.patternBreak.sensitivity;
    const deviationThreshold = (0.15 + (1 - sensitivity) * 0.25) * meanValue;
    
    if (deviation > deviationThreshold) {
      // Determinar severidad
      let severity: SeverityLevel;
      if (normalizedDeviation > 0.4) {
        severity = SeverityLevel.HIGH;
      } else if (normalizedDeviation > 0.25) {
        severity = SeverityLevel.MEDIUM;
      } else {
        severity = SeverityLevel.LOW;
      }
      
      // Crear anomalía
      const anomaly: DetectedAnomaly = {
        id: `pattern_${metricType}_${Date.now()}`,
        timestamp: Date.now(),
        type: AnomalyType.PATTERN_BREAK,
        measurementType: metricType,
        value,
        expectedRange: [
          predictedValue - deviationThreshold,
          predictedValue + deviationThreshold
        ],
        deviation,
        severity,
        description: `Ruptura de patrón en ${metricType}: valor ${value.toFixed(1)} difiere del valor predicho ${predictedValue.toFixed(1)}`,
        isAcknowledged: false,
        metadata: { 
          predictedValue,
          trend,
          oscillation,
          normalizedDeviation
        }
      };
      
      detectedAnomalies.push(anomaly);
      
      // Considerar alerta
      this.considerAlert(anomaly, config);
    }
  }
  
  /**
   * Detecta valores fisiológicamente imposibles o improbables
   */
  private detectPhysiologicalAnomaly(
    metricType: string,
    value: number,
    config: AnomalyDetectionConfig,
    detectedAnomalies: DetectedAnomaly[]
  ): void {
    const { min, max } = config.thresholds.physiological;
    
    // Verificar si está fuera de rango fisiológico
    if (value < min || value > max) {
      // Determinar severidad
      let severity: SeverityLevel;
      
      // Severidad basada en cuánto excede los límites
      if (value < min) {
        const ratio = (min - value) / (min * 0.1); // 10% del mínimo como referencia
        if (ratio > 2) {
          severity = SeverityLevel.CRITICAL;
        } else if (ratio > 1) {
          severity = SeverityLevel.HIGH;
        } else {
          severity = SeverityLevel.MEDIUM;
        }
      } else { // value > max
        const ratio = (value - max) / (max * 0.1); // 10% del máximo como referencia
        if (ratio > 2) {
          severity = SeverityLevel.CRITICAL;
        } else if (ratio > 1) {
          severity = SeverityLevel.HIGH;
        } else {
          severity = SeverityLevel.MEDIUM;
        }
      }
      
      // Ajustar severidad para casos específicos
      if (metricType === 'spo2' && value < min) {
        // Baja saturación de oxígeno es muy grave
        severity = SeverityLevel.CRITICAL;
      } else if (metricType === 'glucose') {
        // Hipoglucemia grave es emergencia médica
        if (value < 50) {
          severity = SeverityLevel.CRITICAL;
        }
        // Hiperglucemia extrema también es grave
        else if (value > 300) {
          severity = SeverityLevel.HIGH;
        }
      }
      
      // Crear anomalía
      const anomaly: DetectedAnomaly = {
        id: `physio_${metricType}_${Date.now()}`,
        timestamp: Date.now(),
        type: AnomalyType.PHYSIOLOGICAL_IMPOSSIBLE,
        measurementType: metricType,
        value,
        expectedRange: [min, max],
        deviation: value < min ? min - value : value - max,
        severity,
        description: `Valor fisiológicamente ${value < min ? 'bajo' : 'alto'} para ${metricType}: ${value.toFixed(1)} (rango normal: ${min}-${max})`,
        isAcknowledged: false
      };
      
      detectedAnomalies.push(anomaly);
      
      // Las anomalías fisiológicas siempre generan alertas
      this.considerAlert(anomaly, config, true);
    }
    
    // Verificar cambios entre mediciones consecutivas
    const history = this.getMetricHistory(metricType);
    if (history.length >= 2) {
      const lastValue = history[history.length - 1];
      const delta = Math.abs(value - lastValue);
      
      if (delta > config.thresholds.physiological.maxDelta) {
        // Cambio demasiado grande entre mediciones consecutivas
        const severity = delta > config.thresholds.physiological.maxDelta * 1.5 
          ? SeverityLevel.HIGH 
          : SeverityLevel.MEDIUM;
        
        // Crear anomalía
        const anomaly: DetectedAnomaly = {
          id: `delta_${metricType}_${Date.now()}`,
          timestamp: Date.now(),
          type: AnomalyType.PHYSIOLOGICAL_IMPOSSIBLE,
          measurementType: metricType,
          value,
          expectedRange: [
            lastValue - config.thresholds.physiological.maxDelta,
            lastValue + config.thresholds.physiological.maxDelta
          ],
          deviation: delta - config.thresholds.physiological.maxDelta,
          severity,
          description: `Cambio fisiológicamente improbable en ${metricType}: ${delta.toFixed(1)} (máximo esperado: ${config.thresholds.physiological.maxDelta})`,
          isAcknowledged: false,
          metadata: { lastValue, delta }
        };
        
        detectedAnomalies.push(anomaly);
        
        // Considerar alerta
        this.considerAlert(anomaly, config);
      }
    }
  }
  
  /**
   * Detecta correlaciones anómalas entre diferentes métricas
   */
  private detectCorrelationAnomaly(
    metricType: string,
    value: number,
    fullData: MeasurementData,
    config: AnomalyDetectionConfig,
    detectedAnomalies: DetectedAnomaly[]
  ): void {
    const correlations = config.thresholds.correlation.expectedCorrelations;
    if (!correlations || Object.keys(correlations).length === 0) return;
    
    // Verificar cada correlación esperada
    for (const [otherMetric, [minCorr, maxCorr]] of Object.entries(correlations)) {
      let otherValue: number;
      
      // Obtener el valor de la otra métrica
      switch (otherMetric) {
        case 'heartRate': otherValue = fullData.heartRate; break;
        case 'spo2': otherValue = fullData.spo2; break;
        case 'systolic': otherValue = fullData.systolic; break;
        case 'diastolic': otherValue = fullData.diastolic; break;
        case 'glucose': otherValue = fullData.glucose; break;
        default: continue;
      }
      
      // Calcular correlación entre las últimas N mediciones
      const metricHistory = this.getMetricHistory(metricType);
      const otherHistory = this.getMetricHistory(otherMetric);
      
      if (metricHistory.length < 5 || otherHistory.length < 5) continue;
      
      // Tomar los últimos 5 valores para calcular correlación
      const recentMetricHistory = metricHistory.slice(-5);
      const recentOtherHistory = otherHistory.slice(-5);
      
      // Calcular correlación
      const correlation = this.calculateCorrelation(recentMetricHistory, recentOtherHistory);
      
      // Verificar si está fuera del rango esperado
      if (correlation < minCorr || correlation > maxCorr) {
        const severity = SeverityLevel.LOW; // Correlaciones anómalas suelen ser de baja severidad
        
        // Crear anomalía
        const anomaly: DetectedAnomaly = {
          id: `corr_${metricType}_${otherMetric}_${Date.now()}`,
          timestamp: Date.now(),
          type: AnomalyType.UNEXPECTED_CORRELATION,
          measurementType: `${metricType}_${otherMetric}`,
          value: correlation,
          expectedRange: [minCorr, maxCorr],
          deviation: correlation < minCorr ? minCorr - correlation : correlation - maxCorr,
          severity,
          description: `Correlación inesperada entre ${metricType} y ${otherMetric}: ${correlation.toFixed(2)} (esperado: ${minCorr.toFixed(2)}-${maxCorr.toFixed(2)})`,
          isAcknowledged: false,
          metadata: { 
            correlation, 
            metricValue: value, 
            otherValue
          }
        };
        
        detectedAnomalies.push(anomaly);
        
        // Considerar alerta
        this.considerAlert(anomaly, config);
      }
    }
  }
  
  /**
   * Considera si una anomalía debe generar una alerta
   */
  private considerAlert(
    anomaly: DetectedAnomaly, 
    config: AnomalyDetectionConfig,
    forceAlert: boolean = false
  ): void {
    // Verificar si las alertas están habilitadas
    if (!config.alerting.enabled && !forceAlert) return;
    
    // Verificar si la severidad es suficiente
    const severityLevels = [
      SeverityLevel.INFO,
      SeverityLevel.LOW,
      SeverityLevel.MEDIUM,
      SeverityLevel.HIGH,
      SeverityLevel.CRITICAL
    ];
    
    const anomalySeverityIndex = severityLevels.indexOf(anomaly.severity);
    const minSeverityIndex = severityLevels.indexOf(config.alerting.minSeverityToAlert);
    
    if (anomalySeverityIndex < minSeverityIndex && !forceAlert) return;
    
    // Verificar si este tipo de anomalía genera alertas
    if (!config.alerting.notifyTypes.includes(anomaly.type) && !forceAlert) return;
    
    // Verificar tiempo desde última alerta (debounce)
    const alertKey = `${anomaly.measurementType}_${anomaly.type}`;
    const lastAlertTime = this.lastAlertTimes[alertKey] || 0;
    const now = Date.now();
    
    if (now - lastAlertTime < config.alerting.debounceMs && !forceAlert) return;
    
    // Verificar si es una alerta recurrente
    if (config.alerting.suppressRecurring) {
      const lastAnomaly = this.lastDetectedAnomalies[alertKey];
      
      // Si es muy similar a la anterior, no alertar nuevamente
      if (lastAnomaly && 
          Math.abs(lastAnomaly.value - anomaly.value) / Math.max(1, Math.abs(lastAnomaly.value)) < 0.1 &&
          !forceAlert) {
        return;
      }
    }
    
    // Actualizar tiempo de última alerta y anomalía
    this.lastAlertTimes[alertKey] = now;
    this.lastDetectedAnomalies[alertKey] = { ...anomaly };
    
    // Enviar notificación
    this.sendAlert(anomaly);
  }
  
  /**
   * Envía alerta por una anomalía
   */
  private sendAlert(anomaly: DetectedAnomaly): void {
    // En una implementación real, esto enviaría notificaciones
    // a través de diferentes canales (push, SMS, email, etc.)
    console.log(`[ALERTA] ${anomaly.severity.toUpperCase()}: ${anomaly.description}`);
    
    // Almacenar en Supabase si es una anomalía crítica
    if (anomaly.severity === SeverityLevel.HIGH || 
        anomaly.severity === SeverityLevel.CRITICAL) {
      this.storeAnomalyInDatabase(anomaly);
    }
  }
  
  /**
   * Almacena anomalía en base de datos
   */
  private async storeAnomalyInDatabase(anomaly: DetectedAnomaly): Promise<void> {
    try {
      // En una implementación completa, esto guardaría en una tabla "anomalies"
      console.log('Guardando anomalía en base de datos:', anomaly);
      
      // Ejemplo de cómo sería con Supabase:
      /*
      const { error } = await supabase
        .from('anomalies')
        .insert({
          type: anomaly.type,
          measurement_type: anomaly.measurementType,
          value: anomaly.value,
          severity: anomaly.severity,
          description: anomaly.description,
          detected_at: new Date(anomaly.timestamp).toISOString(),
          is_acknowledged: anomaly.isAcknowledged,
          metadata: anomaly.metadata
        });
        
      if (error) {
        console.error('Error al guardar anomalía:', error);
      }
      */
    } catch (error) {
      console.error('Error al guardar anomalía en base de datos:', error);
    }
  }
  
  /**
   * Notifica a los observadores sobre anomalías detectadas
   */
  private notifyAnomalyDetection(anomalies: DetectedAnomaly[]): void {
    // Notificar a todos los callbacks registrados
    for (const anomaly of anomalies) {
      for (const callback of this.onAnomalyDetectedCallbacks) {
        try {
          callback(anomaly);
        } catch (error) {
          console.error('Error en callback de anomalía:', error);
        }
      }
    }
  }
  
  /**
   * Actualiza el historial de mediciones
   */
  private updateMeasurementHistory(data: MeasurementData): void {
    // Para cada tipo de métrica, mantener historial separado
    // Esto permite un análisis más específico por tipo
    
    this.updateMetricHistory('heartRate', data);
    this.updateMetricHistory('spo2', data);
    this.updateMetricHistory('systolic', data);
    this.updateMetricHistory('diastolic', data);
    this.updateMetricHistory('glucose', data);
    
    // Limitar tamaño de historiales
    this.trimHistories();
  }
  
  /**
   * Actualiza historial para un tipo específico de métrica
   */
  private updateMetricHistory(metricType: string, data: MeasurementData): void {
    if (!this.history[metricType]) {
      this.history[metricType] = [];
    }
    
    this.history[metricType].push(data);
  }
  
  /**
   * Limita el tamaño de los historiales
   */
  private trimHistories(): void {
    const MAX_HISTORY = 50; // Mantener hasta 50 mediciones para análisis
    
    for (const metricType in this.history) {
      if (this.history[metricType].length > MAX_HISTORY) {
        this.history[metricType] = this.history[metricType].slice(-MAX_HISTORY);
      }
    }
  }
  
  /**
   * Actualiza estadísticas de línea base para una métrica
   */
  private updateBaselineStats(metricType: string, value: number): void {
    // Inicializar si no existe
    if (!this.baselineStats[metricType]) {
      this.baselineStats[metricType] = {
        mean: value,
        stdDev: 0,
        median: value,
        percentiles: {},
        patternLength: 1,
        isBaseline: false
      };
      return;
    }
    
    // Obtener valores históricos de la métrica específica
    const history = this.getMetricHistory(metricType);
    if (history.length < 10) {
      // No hay suficientes datos para estadísticas confiables
      this.baselineStats[metricType].patternLength = history.length;
      return;
    }
    
    // Calcular estadísticas
    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    
    // Desviación estándar
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);
    
    // Ordenar para percentiles y mediana
    const sortedValues = [...history].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(sortedValues.length / 2)];
    
    // Calcular percentiles comunes
    const percentiles: Record<number, number> = {};
    
    [1, 5, 10, 25, 50, 75, 90, 95, 99].forEach(p => {
      const idx = Math.max(0, Math.min(
        sortedValues.length - 1,
        Math.floor(sortedValues.length * p / 100)
      ));
      percentiles[p] = sortedValues[idx];
    });
    
    // Actualizar estadísticas
    this.baselineStats[metricType] = {
      mean,
      stdDev,
      median,
      percentiles,
      patternLength: history.length,
      isBaseline: history.length >= 15 // Considerar línea base solo con suficientes datos
    };
  }
  
  /**
   * Obtiene array con valores históricos de una métrica específica
   */
  private getMetricHistory(metricType: string): number[] {
    if (!this.history[metricType]) return [];
    
    // Extraer valores de la métrica específica
    return this.history[metricType].map(data => {
      switch (metricType) {
        case 'heartRate': return data.heartRate;
        case 'spo2': return data.spo2;
        case 'systolic': return data.systolic;
        case 'diastolic': return data.diastolic;
        case 'glucose': return data.glucose;
        default: return 0;
      }
    });
  }
  
  /**
   * Detecta tendencia en una serie de valores
   */
  private detectTrend(values: number[]): number {
    if (values.length < 3) return 0;
    
    // Utilizar regresión lineal simple para detectar tendencia
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    
    // Pendiente de la recta de regresión
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Normalizar
    const meanValue = sumY / n;
    return meanValue !== 0 ? slope / meanValue : 0;
  }
  
  /**
   * Detecta oscilación en una serie de valores
   */
  private detectOscillation(values: number[]): number {
    if (values.length < 4) return 0;
    
    // Detectar cambios de dirección
    let changes = 0;
    let direction = 0;
    
    for (let i = 1; i < values.length; i++) {
      const newDirection = Math.sign(values[i] - values[i-1]);
      
      if (direction !== 0 && newDirection !== 0 && direction !== newDirection) {
        changes++;
      }
      
      if (newDirection !== 0) {
        direction = newDirection;
      }
    }
    
    // Normalizar: 0 significa sin oscilación, 1 significa oscilación máxima
    return changes / (values.length - 2);
  }
  
  /**
   * Predice el siguiente valor basado en tendencia y oscilación
   */
  private predictNextValue(values: number[], trend: number, oscillation: number): number {
    if (values.length < 2) return values[0] || 0;
    
    // Valor base: último valor
    const lastValue = values[values.length - 1];
    
    // Media de los últimos valores
    const recentMean = values.slice(-5).reduce((sum, val) => sum + val, 0) / 
                      Math.min(5, values.length);
    
    // Si hay oscilación significativa
    if (oscillation > 0.3) {
      // Detectar patrón cíclico
      const last3 = values.slice(-3);
      const prev3 = values.slice(-6, -3);
      
      // Si hay similitud entre patrones previos
      if (prev3.length === 3) {
        const similarity = 1 - Math.abs(
          (last3[0] - prev3[0]) + (last3[1] - prev3[1]) + (last3[2] - prev3[2])
        ) / (3 * Math.max(1, (prev3[0] + prev3[1] + prev3[2]) / 3));
        
        if (similarity > 0.8) {
          // Usar patrón para predicción
          const nextIndex = values.length % 3;
          return prev3[nextIndex];
        }
      }
      
      // Alternativa: usar promedio como predicción en caso de oscilación
      return recentMean;
    }
    
    // Si hay tendencia significativa
    if (Math.abs(trend) > 0.01) {
      // Predicción basada en tendencia
      const meanValue = values.reduce((sum, val) => sum + val, 0) / values.length;
      return lastValue + (trend * meanValue);
    }
    
    // Sin patrón claro: usar último valor
    return lastValue;
  }
  
  /**
   * Calcula correlación entre dos series
   */
  private calculateCorrelation(series1: number[], series2: number[]): number {
    if (series1.length !== series2.length || series1.length < 2) return 0;
    
    const n = series1.length;
    let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
    
    for (let i = 0; i < n; i++) {
      sum1 += series1[i];
      sum2 += series2[i];
      sum1Sq += series1[i] ** 2;
      sum2Sq += series2[i] ** 2;
      pSum += series1[i] * series2[i];
    }
    
    // Fórmula de correlación de Pearson
    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 ** 2 / n) * (sum2Sq - sum2 ** 2 / n));
    
    return den === 0 ? 0 : num / den;
  }
  
  /**
   * Escala severidad a un nivel superior
   */
  private escalateSeverity(severity: SeverityLevel): SeverityLevel {
    switch (severity) {
      case SeverityLevel.INFO: return SeverityLevel.LOW;
      case SeverityLevel.LOW: return SeverityLevel.MEDIUM;
      case SeverityLevel.MEDIUM: return SeverityLevel.HIGH;
      case SeverityLevel.HIGH: return SeverityLevel.CRITICAL;
      default: return severity;
    }
  }
  
  /**
   * Combina configuraciones
   */
  private mergeConfigs(
    baseConfig: AnomalyDetectionConfig, 
    partialConfig: Partial<AnomalyDetectionConfig>
  ): AnomalyDetectionConfig {
    // Copia profunda de la configuración base
    const config = JSON.parse(JSON.stringify(baseConfig));
    
    // Aplicar valores de nivel superior
    if (partialConfig.enabled !== undefined) config.enabled = partialConfig.enabled;
    
    // Aplicar umbrales si están presentes
    if (partialConfig.thresholds) {
      // Estadísticos
      if (partialConfig.thresholds.statistical) {
        Object.assign(config.thresholds.statistical, partialConfig.thresholds.statistical);
      }
      
      // Cambios rápidos
      if (partialConfig.thresholds.rapidChange) {
        Object.assign(config.thresholds.rapidChange, partialConfig.thresholds.rapidChange);
      }
      
      // Ruptura de patrones
      if (partialConfig.thresholds.patternBreak) {
        Object.assign(config.thresholds.patternBreak, partialConfig.thresholds.patternBreak);
      }
      
      // Fisiológicos
      if (partialConfig.thresholds.physiological) {
        Object.assign(config.thresholds.physiological, partialConfig.thresholds.physiological);
      }
      
      // Correlación
      if (partialConfig.thresholds.correlation) {
        if (partialConfig.thresholds.correlation.expectedCorrelations) {
          config.thresholds.correlation.expectedCorrelations = {
            ...config.thresholds.correlation.expectedCorrelations,
            ...partialConfig.thresholds.correlation.expectedCorrelations
          };
        }
      }
    }
    
    // Aplicar configuración de alertas
    if (partialConfig.alerting) {
      if (partialConfig.alerting.enabled !== undefined) {
        config.alerting.enabled = partialConfig.alerting.enabled;
      }
      
      if (partialConfig.alerting.minSeverityToAlert !== undefined) {
        config.alerting.minSeverityToAlert = partialConfig.alerting.minSeverityToAlert;
      }
      
      if (partialConfig.alerting.debounceMs !== undefined) {
        config.alerting.debounceMs = partialConfig.alerting.debounceMs;
      }
      
      if (partialConfig.alerting.suppressRecurring !== undefined) {
        config.alerting.suppressRecurring = partialConfig.alerting.suppressRecurring;
      }
      
      if (partialConfig.alerting.notifyTypes !== undefined) {
        config.alerting.notifyTypes = [...partialConfig.alerting.notifyTypes];
      }
    }
    
    return config;
  }
  
  /**
   * Carga configuraciones de usuario desde almacenamiento
   */
  private async loadUserConfigurations(): Promise<void> {
    try {
      // Intentar cargar desde localStorage
      const storedConfigs = localStorage.getItem('anomalyConfigs');
      if (storedConfigs) {
        const configs = JSON.parse(storedConfigs);
        this.configs = { ...this.configs, ...configs };
        console.log('Configuraciones de anomalías cargadas desde localStorage');
      }
      
      // Sincronizar con Supabase (implementación futura)
    } catch (error) {
      console.error('Error al cargar configuraciones de usuario:', error);
    }
  }
  
  /**
   * Guarda configuraciones de usuario
   */
  private async saveUserConfigurations(): Promise<void> {
    try {
      // Guardar en localStorage
      localStorage.setItem('anomalyConfigs', JSON.stringify(this.configs));
      
      // Sincronizar con Supabase (implementación futura)
    } catch (error) {
      console.error('Error al guardar configuraciones de usuario:', error);
    }
  }
}

export const getAnomalyDetector = (): AnomalyDetectionSystem => {
  return AnomalyDetectionSystem.getInstance();
};
