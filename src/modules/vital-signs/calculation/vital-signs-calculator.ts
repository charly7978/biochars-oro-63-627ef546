
/**
 * Calculador central de signos vitales
 * 
 * Coordina los calculadores especializados y maneja el feedback bidireccional
 * con el optimizador
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
 */
class VitalSignsCalculatorImpl implements VitalSignsCalculatorManager {
  private calculators: Map<VitalSignChannel, VitalSignCalculator> = new Map();
  private arrhythmiaCalculator: ArrhythmiaCalculator;
  private feedbackManager: FeedbackManager;
  private visualizationData: CalculationVisualizationData = {
    ppgData: [],
    arrhythmiaMarkers: []
  };
  
  // Resultados anteriores para estabilidad
  private lastCalculations: Record<VitalSignChannel, VitalSignCalculation | null> = {
    heartRate: null,
    spo2: null,
    bloodPressure: null,
    glucose: null,
    cholesterol: null,
    triglycerides: null
  };
  
  constructor() {
    // Inicializar calculadores especializados
    this.calculators.set('heartRate', new HeartRateCalculator());
    this.calculators.set('spo2', new SPO2Calculator());
    this.calculators.set('bloodPressure', new BloodPressureCalculator());
    this.calculators.set('glucose', new GlucoseCalculator());
    this.calculators.set('cholesterol', new LipidsCalculator('cholesterol'));
    this.calculators.set('triglycerides', new LipidsCalculator('triglycerides'));
    
    // Inicializar calculador de arritmias
    this.arrhythmiaCalculator = new ArrhythmiaCalculator();
    
    // Inicializar gestor de feedback
    this.feedbackManager = new FeedbackManager(this.calculators);
    
    console.log("VitalSignsCalculator: Inicializado con calculadores especializados y feedback bidireccional");
  }
  
  /**
   * Procesa todas las señales optimizadas y calcula resultados
   */
  public processOptimizedSignals(
    signals: Record<VitalSignChannel, OptimizedSignal | null>
  ): CalculationResult {
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
    
    // Procesar cada canal con su calculador especializado
    for (const [channel, signal] of Object.entries(signals)) {
      if (signal && signal.optimizedValue !== undefined) {
        const calculator = this.calculators.get(channel as VitalSignChannel);
        
        if (calculator) {
          try {
            // Calcular signo vital con el calculador especializado
            const calculation = calculator.calculate(signal);
            
            // Guardar resultado en la estructura de resultados
            result[channel as keyof Omit<CalculationResult, 'arrhythmia'>] = calculation;
            
            // Actualizar último cálculo válido
            this.lastCalculations[channel as VitalSignChannel] = calculation;
            
            // Generar feedback para el optimizador si es necesario
            this.feedbackManager.registerCalculation(channel as VitalSignChannel, calculation);
          } catch (error) {
            console.error(`Error en cálculo de ${channel}:`, error);
            
            // En caso de error, usar último resultado válido si existe
            if (this.lastCalculations[channel as VitalSignChannel]) {
              result[channel as keyof Omit<CalculationResult, 'arrhythmia'>] = 
                this.lastCalculations[channel as VitalSignChannel]!;
            }
          }
        }
      }
    }
    
    // Procesar arritmias con datos de frecuencia cardíaca
    if (signals.heartRate && result.heartRate.value) {
      // Extraer metadata de picos cardíacos si existe
      const peakMetadata = signals.heartRate.metadata || {};
      const rrIntervals = peakMetadata.rrIntervals as number[] || [];
      
      // Calcular estado de arritmia
      const arrhythmiaResult = this.arrhythmiaCalculator.processRRIntervals(rrIntervals);
      result.arrhythmia = arrhythmiaResult;
      
      // Actualizar datos de visualización
      this.updateVisualizationData(signals.heartRate, arrhythmiaResult);
    }
    
    return result;
  }
  
  /**
   * Actualiza datos para visualización en gráfico PPG
   */
  private updateVisualizationData(
    signal: OptimizedSignal,
    arrhythmiaResult: CalculationResult['arrhythmia']
  ): void {
    // Añadir punto de señal actual
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
   * Obtiene datos de visualización para gráficos
   */
  public getVisualizationData(): CalculationVisualizationData {
    return this.visualizationData;
  }
  
  /**
   * Genera feedback para el optimizador
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
   * Reinicia todos los calculadores
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
    
    console.log("VitalSignsCalculator: Reset completo de todos los calculadores");
  }
}

/**
 * Crea una nueva instancia del calculador
 */
export function createVitalSignsCalculator(): VitalSignsCalculatorManager {
  return new VitalSignsCalculatorImpl();
}
