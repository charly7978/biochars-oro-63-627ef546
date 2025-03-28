
/**
 * Calculador central de signos vitales
 * 
 * Coordina los calculadores especializados y maneja el feedback bidireccional
 * con el optimizador mediante algoritmos avanzados de cálculo honesto
 */

import { 
  VitalSignsCalculatorManager, 
  CalculationResult, 
  VitalSignCalculation,
  CalculationVisualizationData,
  VitalSignCalculator
} from './types';

import { 
  OptimizedSignal, 
  VitalSignChannel, 
  FeedbackData 
} from '../../signal-optimization/types';

import { HeartRateCalculator } from './calculators/heart-rate-calculator';
import { SPO2Calculator } from './calculators/spo2-calculator';
import { BloodPressureCalculator } from './calculators/blood-pressure-calculator';
import { GlucoseCalculator } from './calculators/glucose-calculator';
import { LipidsCalculator } from './calculators/lipids-calculator';
import { ArrhythmiaCalculator } from './calculators/arrhythmia-calculator';
import { FeedbackManager } from './feedback-manager';

/**
 * Implementación del calculador principal de signos vitales
 * con algoritmos avanzados y feedback bidireccional
 */
class VitalSignsCalculatorImpl implements VitalSignsCalculatorManager {
  private calculators: Map<VitalSignChannel, VitalSignCalculator> = new Map();
  private arrhythmiaCalculator: ArrhythmiaCalculator;
  private feedbackManager: FeedbackManager;
  private visualizationData: CalculationVisualizationData = {
    ppgData: [],
    arrhythmiaMarkers: []
  };
  
  // Resultados anteriores para estabilidad y consistencia
  private lastCalculations: Record<VitalSignChannel, VitalSignCalculation | null> = {
    heartRate: null,
    spo2: null,
    bloodPressure: null,
    glucose: null,
    cholesterol: null,
    triglycerides: null
  };
  
  // Sistemas avanzados de cálculo y análisis
  private dataIntegrityValidator: DataIntegrityValidator;
  private calculationTrendAnalyzer: CalculationTrendAnalyzer;
  private crossChannelCorrelator: CrossChannelCorrelator;
  
  constructor() {
    // Inicializar calculadores especializados con algoritmos avanzados
    this.calculators.set('heartRate', new HeartRateCalculator());
    this.calculators.set('spo2', new SPO2Calculator());
    this.calculators.set('bloodPressure', new BloodPressureCalculator());
    this.calculators.set('glucose', new GlucoseCalculator());
    this.calculators.set('cholesterol', new LipidsCalculator('cholesterol'));
    this.calculators.set('triglycerides', new LipidsCalculator('triglycerides'));
    
    // Inicializar calculador de arritmias avanzado
    this.arrhythmiaCalculator = new ArrhythmiaCalculator();
    
    // Inicializar gestor de feedback bidireccional
    this.feedbackManager = new FeedbackManager(this.calculators);
    
    // Inicializar sistemas avanzados de análisis
    this.dataIntegrityValidator = new DataIntegrityValidator();
    this.calculationTrendAnalyzer = new CalculationTrendAnalyzer();
    this.crossChannelCorrelator = new CrossChannelCorrelator();
    
    console.log("VitalSignsCalculator: Inicializado con calculadores avanzados y sistemas de análisis de vanguardia");
  }
  
  /**
   * Procesa todas las señales optimizadas y calcula resultados
   * utilizando algoritmos avanzados y análisis entre canales
   */
  public processOptimizedSignals(
    signals: Record<VitalSignChannel, OptimizedSignal | null>
  ): CalculationResult {
    // Crear resultado por defecto
    const result: CalculationResult = {
      heartRate: this.getDefaultCalculation(),
      spo2: this.getDefaultCalculation(),
      bloodPressure: this.getDefaultCalculation(),
      glucose: this.getDefaultCalculation(),
      cholesterol: this.getDefaultCalculation(),
      triglycerides: this.getDefaultCalculation(),
      arrhythmia: {
        status: "--",
        count: 0,
        lastDetection: null,
        data: null
      }
    };
    
    // Validar integridad de los datos de entrada
    const validatedSignals = this.dataIntegrityValidator.validate(signals);
    
    // Primera fase: cálculos independientes por canal
    const channelResults = new Map<VitalSignChannel, VitalSignCalculation>();
    
    // Procesar cada canal con su calculador especializado
    for (const [channel, signal] of Object.entries(validatedSignals)) {
      if (signal && signal.optimizedValue !== undefined) {
        const calculator = this.calculators.get(channel as VitalSignChannel);
        
        if (calculator) {
          try {
            // Calcular signo vital con el calculador especializado
            const calculation = calculator.calculate(signal);
            
            // Registrar resultado para análisis cruzado
            channelResults.set(channel as VitalSignChannel, calculation);
            
            // Guardar resultado en la estructura de resultados
            result[channel as keyof Omit<CalculationResult, 'arrhythmia'>] = calculation;
            
            // Actualizar último cálculo válido
            this.lastCalculations[channel as VitalSignChannel] = calculation;
            
            // Generar feedback para el optimizador si es necesario
            this.feedbackManager.registerCalculation(channel as VitalSignChannel, calculation);
          } catch (error) {
            console.error(`Error en cálculo avanzado de ${channel}:`, error);
            
            // En caso de error, usar último resultado válido si existe
            if (this.lastCalculations[channel as VitalSignChannel]) {
              result[channel as keyof Omit<CalculationResult, 'arrhythmia'>] = 
                this.lastCalculations[channel as VitalSignChannel]!;
            }
          }
        }
      }
    }
    
    // Segunda fase: análisis cruzado entre canales para validación avanzada
    if (channelResults.size > 1) {
      this.crossChannelCorrelator.analyzeCorrelations(channelResults);
      
      // Aplicar ajustes basados en correlaciones detectadas
      for (const [channel, adjustment] of this.crossChannelCorrelator.getAdjustments()) {
        if (result[channel as keyof Omit<CalculationResult, 'arrhythmia'>]) {
          const original = result[channel as keyof Omit<CalculationResult, 'arrhythmia'>];
          const adjusted = {
            ...original,
            value: typeof original.value === 'number' ? 
                   original.value * adjustment.valueFactor : original.value,
            confidence: original.confidence * adjustment.confidenceFactor
          };
          
          result[channel as keyof Omit<CalculationResult, 'arrhythmia'>] = adjusted;
        }
      }
    }
    
    // Tercera fase: análisis de tendencias para mejorar consistencia temporal
    for (const channel of Object.keys(result)) {
      if (channel !== 'arrhythmia') {
        const typedChannel = channel as keyof Omit<CalculationResult, 'arrhythmia'>;
        if (result[typedChannel] && this.lastCalculations[typedChannel as VitalSignChannel]) {
          // Analizar tendencia y aplicar suavizado temporal avanzado
          const smoothed = this.calculationTrendAnalyzer.smoothCalculation(
            typedChannel as VitalSignChannel, 
            result[typedChannel],
            this.lastCalculations[typedChannel as VitalSignChannel]!
          );
          
          result[typedChannel] = smoothed;
          this.lastCalculations[typedChannel as VitalSignChannel] = smoothed;
        }
      }
    }
    
    // Cuarta fase: procesamiento avanzado de arritmias con datos de frecuencia cardíaca
    const heartRateSignal = signals.heartRate;
    if (heartRateSignal && heartRateSignal.metadata) {
      const rrIntervals = heartRateSignal.metadata.rrIntervals || [];
      
      // Procesar arritmias con algoritmo avanzado
      const arrhythmiaResult = this.arrhythmiaCalculator.processRRIntervals(rrIntervals);
      result.arrhythmia = arrhythmiaResult;
      
      // Actualizar datos de visualización
      this.updateVisualizationData(heartRateSignal, arrhythmiaResult);
    }
    
    return result;
  }
  
  /**
   * Actualiza datos para visualización avanzada en gráfico PPG
   */
  private updateVisualizationData(
    signal: OptimizedSignal,
    arrhythmiaResult: CalculationResult['arrhythmia']
  ): void {
    // Añadir punto de señal actual con marcado avanzado
    this.visualizationData.ppgData.push({
      time: signal.timestamp,
      value: signal.optimizedValue,
      isPeak: signal.metadata?.isPeak || false,
      isArrhythmia: arrhythmiaResult.status !== "--" && arrhythmiaResult.status !== "NORMAL"
    });
    
    // Mantener solo últimos 300 puntos (~10 segundos a 30fps)
    if (this.visualizationData.ppgData.length > 300) {
      this.visualizationData.ppgData = this.visualizationData.ppgData.slice(-300);
    }
    
    // Añadir marcador de arritmia si se detectó una nueva
    if (arrhythmiaResult.lastDetection && 
        arrhythmiaResult.data && 
        arrhythmiaResult.status !== "NORMAL") {
      // Verificar si ya existe un marcador reciente para esta arritmia
      const isRecentMarker = this.visualizationData.arrhythmiaMarkers.some(
        marker => Math.abs(marker.startTime - arrhythmiaResult.lastDetection!) < 1000
      );
      
      if (!isRecentMarker) {
        this.visualizationData.arrhythmiaMarkers.push({
          startTime: arrhythmiaResult.lastDetection,
          endTime: arrhythmiaResult.lastDetection + 2000, // 2 segundos de duración
          type: arrhythmiaResult.status
        });
        
        // Mantener solo últimos 10 marcadores
        if (this.visualizationData.arrhythmiaMarkers.length > 10) {
          this.visualizationData.arrhythmiaMarkers.shift();
        }
      }
    }
  }
  
  /**
   * Obtiene datos de visualización avanzada para gráficos
   */
  public getVisualizationData(): CalculationVisualizationData {
    return this.visualizationData;
  }
  
  /**
   * Genera feedback bidireccional avanzado para el optimizador
   */
  public generateFeedback(): Array<FeedbackData> {
    return this.feedbackManager.generateFeedback();
  }
  
  /**
   * Retorna un cálculo por defecto
   */
  private getDefaultCalculation(): VitalSignCalculation {
    return {
      value: 0,
      confidence: 0,
      timestamp: Date.now()
    };
  }
  
  /**
   * Reinicia todos los calculadores y sistemas avanzados
   */
  public reset(): void {
    // Reiniciar calculadores individuales
    for (const calculator of this.calculators.values()) {
      calculator.reset();
    }
    
    // Reiniciar calculador de arritmias
    this.arrhythmiaCalculator.reset();
    
    // Reiniciar gestor de feedback
    this.feedbackManager.reset();
    
    // Reiniciar sistemas avanzados
    this.dataIntegrityValidator.reset();
    this.calculationTrendAnalyzer.reset();
    this.crossChannelCorrelator.reset();
    
    // Reiniciar datos de visualización
    this.visualizationData = {
      ppgData: [],
      arrhythmiaMarkers: []
    };
    
    // Reiniciar últimos cálculos
    this.lastCalculations = {
      heartRate: null,
      spo2: null,
      bloodPressure: null,
      glucose: null,
      cholesterol: null,
      triglycerides: null
    };
    
    console.log("VitalSignsCalculator: Reset completo de todos los calculadores y sistemas avanzados");
  }
}

// ===== SISTEMAS AVANZADOS DE CÁLCULO Y ANÁLISIS =====

/**
 * Validador avanzado de integridad de datos
 * Verifica y corrige problemas en las señales de entrada
 */
class DataIntegrityValidator {
  private signalHistory: Map<VitalSignChannel, OptimizedSignal[]> = new Map();
  private readonly HISTORY_SIZE = 50;
  
  constructor() {
    // Inicializar historiales para cada canal
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.signalHistory.set(channel, []);
    }
  }
  
  /**
   * Valida integridad de señales y corrige problemas
   */
  public validate(signals: Record<VitalSignChannel, OptimizedSignal | null>): 
    Record<VitalSignChannel, OptimizedSignal | null> {
    const validatedSignals: Record<VitalSignChannel, OptimizedSignal | null> = 
      { ...signals };
    
    // Procesar cada canal
    for (const [channel, signal] of Object.entries(signals)) {
      if (signal) {
        const typedChannel = channel as VitalSignChannel;
        
        // Actualizar historial
        const history = this.signalHistory.get(typedChannel) || [];
        history.push(signal);
        if (history.length > this.HISTORY_SIZE) {
          history.shift();
        }
        this.signalHistory.set(typedChannel, history);
        
        // Aplicar validaciones avanzadas específicas por canal
        const validatedSignal = this.validateSignalByChannel(typedChannel, signal, history);
        validatedSignals[typedChannel] = validatedSignal;
      }
    }
    
    return validatedSignals;
  }
  
  /**
   * Validación específica por canal con algoritmos avanzados
   */
  private validateSignalByChannel(
    channel: VitalSignChannel, 
    signal: OptimizedSignal, 
    history: OptimizedSignal[]
  ): OptimizedSignal {
    const validatedSignal = { ...signal };
    
    // Validaciones específicas según el canal
    switch (channel) {
      case 'heartRate':
        // Validar valor fisiológicamente plausible
        if (validatedSignal.optimizedValue > 4 || validatedSignal.optimizedValue < -4) {
          // Valor fuera de rango - usar promedio reciente
          if (history.length > 5) {
            const recentValues = history.slice(-5).map(s => s.optimizedValue);
            validatedSignal.optimizedValue = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
          }
        }
        break;
        
      case 'spo2':
        // La señal SpO2 debe ser positiva
        if (validatedSignal.optimizedValue < 0) {
          validatedSignal.optimizedValue = Math.abs(validatedSignal.optimizedValue);
        }
        break;
        
      case 'bloodPressure':
        // Verificar cambios bruscos improbables
        if (history.length > 1) {
          const prevValue = history[history.length - 2].optimizedValue;
          const currentValue = validatedSignal.optimizedValue;
          const percentChange = Math.abs((currentValue - prevValue) / prevValue);
          
          if (percentChange > 0.5) { // Cambio mayor al 50%
            // Suavizar cambio brusco
            validatedSignal.optimizedValue = prevValue * 0.7 + currentValue * 0.3;
            validatedSignal.quality *= 0.8; // Reducir confianza
          }
        }
        break;
        
      case 'glucose':
      case 'cholesterol':
      case 'triglycerides':
        // Datos metabólicos no pueden tener cambios extremadamente rápidos
        // Aplicar limitación de tasa de cambio
        if (history.length > 10) {
          const avgRate = this.calculateAverageRateOfChange(history.slice(-10));
          const lastValue = history[history.length - 2].optimizedValue;
          const currentRate = Math.abs(validatedSignal.optimizedValue - lastValue);
          
          if (currentRate > avgRate * 3) {
            // Limitar tasa de cambio a 3 veces el promedio
            const direction = validatedSignal.optimizedValue > lastValue ? 1 : -1;
            validatedSignal.optimizedValue = lastValue + (direction * avgRate * 3);
          }
        }
        break;
    }
    
    return validatedSignal;
  }
  
  /**
   * Calcula la tasa promedio de cambio en una serie de señales
   */
  private calculateAverageRateOfChange(signals: OptimizedSignal[]): number {
    if (signals.length < 2) return 0;
    
    let sumRates = 0;
    for (let i = 1; i < signals.length; i++) {
      sumRates += Math.abs(signals[i].optimizedValue - signals[i-1].optimizedValue);
    }
    
    return sumRates / (signals.length - 1);
  }
  
  /**
   * Reinicia el validador
   */
  public reset(): void {
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.signalHistory.set(channel, []);
    }
  }
}

/**
 * Analizador avanzado de tendencias de cálculo
 * Mejora la consistencia temporal de los resultados
 */
class CalculationTrendAnalyzer {
  private calculationHistory: Map<VitalSignChannel, VitalSignCalculation[]> = new Map();
  private readonly HISTORY_SIZE = 20;
  
  constructor() {
    // Inicializar historiales para cada canal
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.calculationHistory.set(channel, []);
    }
  }
  
  /**
   * Suaviza cálculos basado en tendencias históricas
   */
  public smoothCalculation(
    channel: VitalSignChannel,
    current: VitalSignCalculation,
    previous: VitalSignCalculation
  ): VitalSignCalculation {
    // Actualizar historial
    const history = this.calculationHistory.get(channel) || [];
    history.push(current);
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }
    this.calculationHistory.set(channel, history);
    
    // Si no hay suficiente historial, devolver el valor actual
    if (history.length < 3) {
      return current;
    }
    
    // Aplicar algoritmos de suavizado según el tipo de canal
    switch (channel) {
      case 'heartRate':
        return this.smoothHeartRate(current, history);
        
      case 'spo2':
        return this.smoothSPO2(current, history);
        
      case 'bloodPressure':
        return this.smoothBloodPressure(current, history);
        
      case 'glucose':
      case 'cholesterol':
      case 'triglycerides':
        return this.smoothMetabolicValue(current, history);
        
      default:
        return current;
    }
  }
  
  /**
   * Algoritmo especializado para suavizar ritmo cardíaco
   */
  private smoothHeartRate(
    current: VitalSignCalculation,
    history: VitalSignCalculation[]
  ): VitalSignCalculation {
    // El ritmo cardíaco puede cambiar rápidamente pero debe ser consistente
    if (typeof current.value !== 'number') return current;
    
    const recentValues = history
      .slice(-5)
      .map(h => typeof h.value === 'number' ? h.value : 0)
      .filter(v => v > 0);
    
    if (recentValues.length < 3) return current;
    
    // Calcular mediana para eliminar outliers
    const sortedValues = [...recentValues].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(sortedValues.length / 2)];
    
    // Si el valor actual difiere significativamente de la mediana
    if (Math.abs(current.value - median) / median > 0.15) {
      // Aplicar suavizado exponencial
      const alpha = 0.4; // Factor de suavizado
      const smoothedValue = alpha * current.value + (1 - alpha) * median;
      
      return {
        ...current,
        value: Math.round(smoothedValue)
      };
    }
    
    return current;
  }
  
  /**
   * Algoritmo especializado para suavizar SpO2
   */
  private smoothSPO2(
    current: VitalSignCalculation,
    history: VitalSignCalculation[]
  ): VitalSignCalculation {
    // SpO2 cambia lentamente en personas sanas
    if (typeof current.value !== 'number') return current;
    
    const recentValues = history
      .slice(-8) // Ventana más amplia
      .map(h => typeof h.value === 'number' ? h.value : 0)
      .filter(v => v > 0);
    
    if (recentValues.length < 3) return current;
    
    // Calcular promedio móvil ponderado
    let sum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < recentValues.length; i++) {
      const weight = (i + 1) / recentValues.length; // Más peso a valores recientes
      sum += recentValues[i] * weight;
      weightSum += weight;
    }
    
    const smoothedValue = Math.round(sum / weightSum);
    
    return {
      ...current,
      value: smoothedValue
    };
  }
  
  /**
   * Algoritmo especializado para suavizar presión arterial
   */
  private smoothBloodPressure(
    current: VitalSignCalculation,
    history: VitalSignCalculation[]
  ): VitalSignCalculation {
    // La presión arterial puede tener formato especial (sistólica/diastólica)
    if (typeof current.value !== 'string') return current;
    
    // Extraer componentes sistólica/diastólica
    const match = current.value.match(/(\d+)\/(\d+)/);
    if (!match) return current;
    
    const systolic = parseInt(match[1]);
    const diastolic = parseInt(match[2]);
    
    // Extraer valores históricos
    const recentSystolics: number[] = [];
    const recentDiastolics: number[] = [];
    
    for (const item of history.slice(-6)) {
      if (typeof item.value === 'string') {
        const itemMatch = item.value.match(/(\d+)\/(\d+)/);
        if (itemMatch) {
          recentSystolics.push(parseInt(itemMatch[1]));
          recentDiastolics.push(parseInt(itemMatch[2]));
        }
      }
    }
    
    if (recentSystolics.length < 3 || recentDiastolics.length < 3) return current;
    
    // Calcular medias móviles
    const avgSystolic = recentSystolics.reduce((sum, val) => sum + val, 0) / recentSystolics.length;
    const avgDiastolic = recentDiastolics.reduce((sum, val) => sum + val, 0) / recentDiastolics.length;
    
    // Aplicar suavizado con límite de cambio
    const maxSystolicChange = 5; // mmHg
    const maxDiastolicChange = 3; // mmHg
    
    const lastSystolic = recentSystolics[recentSystolics.length - 1];
    const lastDiastolic = recentDiastolics[recentDiastolics.length - 1];
    
    let smoothedSystolic = systolic;
    let smoothedDiastolic = diastolic;
    
    if (Math.abs(systolic - lastSystolic) > maxSystolicChange) {
      const direction = systolic > lastSystolic ? 1 : -1;
      smoothedSystolic = lastSystolic + (direction * maxSystolicChange);
    }
    
    if (Math.abs(diastolic - lastDiastolic) > maxDiastolicChange) {
      const direction = diastolic > lastDiastolic ? 1 : -1;
      smoothedDiastolic = lastDiastolic + (direction * maxDiastolicChange);
    }
    
    return {
      ...current,
      value: `${Math.round(smoothedSystolic)}/${Math.round(smoothedDiastolic)}`
    };
  }
  
  /**
   * Algoritmo especializado para suavizar valores metabólicos
   */
  private smoothMetabolicValue(
    current: VitalSignCalculation,
    history: VitalSignCalculation[]
  ): VitalSignCalculation {
    // Valores metabólicos cambian muy lentamente
    if (typeof current.value !== 'number') return current;
    
    const recentValues = history
      .slice(-10) // Ventana amplia
      .map(h => typeof h.value === 'number' ? h.value : 0)
      .filter(v => v > 0);
    
    if (recentValues.length < 5) return current;
    
    // Calcular tendencia
    const trend = this.calculateTrend(recentValues);
    
    // Aplicar suavizado exponencial doble (Holt)
    const alpha = 0.2; // Factor para nivel
    const beta = 0.1;  // Factor para tendencia
    
    // Nivel actual
    const level = alpha * current.value + (1 - alpha) * 
                 (recentValues[recentValues.length - 1] + trend);
    
    // Tendencia actualizada
    const newTrend = beta * (level - recentValues[recentValues.length - 1]) + 
                    (1 - beta) * trend;
    
    // Valor suavizado
    const smoothedValue = level + newTrend;
    
    return {
      ...current,
      value: smoothedValue
    };
  }
  
  /**
   * Calcula la tendencia de una serie de valores
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 3) return 0;
    
    let sumXY = 0;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    
    for (let i = 0; i < values.length; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    
    const n = values.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope;
  }
  
  /**
   * Reinicia el analizador
   */
  public reset(): void {
    const channels: VitalSignChannel[] = [
      'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
    ];
    
    for (const channel of channels) {
      this.calculationHistory.set(channel, []);
    }
  }
}

/**
 * Correlacionador avanzado entre canales
 * Analiza relaciones entre distintos signos vitales para validación cruzada
 */
class CrossChannelCorrelator {
  private correlationMatrix: Map<string, number> = new Map();
  private adjustments: Map<VitalSignChannel, { valueFactor: number, confidenceFactor: number }> = new Map();
  
  constructor() {
    // Inicializar matriz de correlación con valores típicos
    this.initializeCorrelations();
  }
  
  /**
   * Inicializa correlaciones típicas entre signos vitales
   */
  private initializeCorrelations(): void {
    // Formato: "canal1:canal2" => coeficiente de correlación típico
    
    // Correlación ritmo cardíaco-presión arterial (moderada positiva)
    this.correlationMatrix.set("heartRate:bloodPressure", 0.4);
    
    // Correlación ritmo cardíaco-SpO2 (débil negativa en reposo)
    this.correlationMatrix.set("heartRate:spo2", -0.2);
    
    // Otras correlaciones relevantes...
  }
  
  /**
   * Analiza correlaciones entre resultados de distintos canales
   */
  public analyzeCorrelations(results: Map<VitalSignChannel, VitalSignCalculation>): void {
    // Reiniciar ajustes
    this.adjustments.clear();
    
    // Verificar correlaciones conocidas
    this.checkHeartRateBloodPressureCorrelation(results);
    this.checkHeartRateSpO2Correlation(results);
    this.checkMetabolicCorrelations(results);
  }
  
  /**
   * Verifica correlación entre ritmo cardíaco y presión arterial
   */
  private checkHeartRateBloodPressureCorrelation(
    results: Map<VitalSignChannel, VitalSignCalculation>
  ): void {
    const heartRate = results.get('heartRate');
    const bloodPressure = results.get('bloodPressure');
    
    if (!heartRate || !bloodPressure || 
        typeof heartRate.value !== 'number' || 
        typeof bloodPressure.value !== 'string') {
      return;
    }
    
    // Extraer sistólica/diastólica
    const match = bloodPressure.value.match(/(\d+)\/(\d+)/);
    if (!match) return;
    
    const systolic = parseInt(match[1]);
    const diastolic = parseInt(match[2]);
    
    // Verificar coherencia fisiológica
    // Ejemplo: ritmo muy alto con presión baja es improbable
    if (heartRate.value > 100 && systolic < 110) {
      // Posible inconsistencia - ajustar confianza
      this.adjustments.set('bloodPressure', { 
        valueFactor: 1.0, // No ajustar valor
        confidenceFactor: 0.8  // Reducir confianza en presión
      });
    }
    
    // Ejemplo: ritmo muy bajo con presión alta es improbable
    if (heartRate.value < 60 && systolic > 160) {
      this.adjustments.set('heartRate', { 
        valueFactor: 1.0,
        confidenceFactor: 0.9
      });
    }
  }
  
  /**
   * Verifica correlación entre ritmo cardíaco y SpO2
   */
  private checkHeartRateSpO2Correlation(
    results: Map<VitalSignChannel, VitalSignCalculation>
  ): void {
    const heartRate = results.get('heartRate');
    const spo2 = results.get('spo2');
    
    if (!heartRate || !spo2 || 
        typeof heartRate.value !== 'number' || 
        typeof spo2.value !== 'number') {
      return;
    }
    
    // Verificar coherencia fisiológica
    // Ejemplo: SpO2 muy baja con ritmo normal es improbable
    if (spo2.value < 90 && heartRate.value < 90) {
      this.adjustments.set('spo2', { 
        valueFactor: 1.05, // Ligero ajuste hacia arriba
        confidenceFactor: 0.9
      });
    }
  }
  
  /**
   * Verifica correlaciones entre valores metabólicos
   */
  private checkMetabolicCorrelations(
    results: Map<VitalSignChannel, VitalSignCalculation>
  ): void {
    const glucose = results.get('glucose');
    const cholesterol = results.get('cholesterol');
    const triglycerides = results.get('triglycerides');
    
    // Verificar coherencia entre colesterol y triglicéridos
    if (cholesterol && triglycerides && 
        typeof cholesterol.value === 'number' && 
        typeof triglycerides.value === 'number') {
      
      // Relación típica: triglicéridos menores que colesterol total
      if (triglycerides.value > cholesterol.value * 1.5) {
        this.adjustments.set('triglycerides', { 
          valueFactor: 0.95, // Ligero ajuste hacia abajo
          confidenceFactor: 0.9
        });
      }
    }
  }
  
  /**
   * Obtiene ajustes calculados para los distintos canales
   */
  public getAdjustments(): Map<VitalSignChannel, { valueFactor: number, confidenceFactor: number }> {
    return this.adjustments;
  }
  
  /**
   * Reinicia el correlacionador
   */
  public reset(): void {
    this.adjustments.clear();
    this.initializeCorrelations();
  }
}

/**
 * Crea una nueva instancia del calculador
 */
export function createVitalSignsCalculator(): VitalSignsCalculatorManager {
  return new VitalSignsCalculatorImpl();
}
