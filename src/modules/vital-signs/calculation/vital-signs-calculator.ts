
/**
 * Calculador central de signos vitales
 * Integra todos los calculadores especializados y gestiona feedback bidireccional con el optimizador
 */

import { OptimizedSignal, VitalSignChannel, FeedbackData } from '../../signal-optimization/types';
import { HeartRateCalculator } from './calculators/heart-rate-calculator';
import { SPO2Calculator } from './calculators/spo2-calculator';
import { BloodPressureCalculator } from './calculators/blood-pressure-calculator';
import { GlucoseCalculator } from './calculators/glucose-calculator';
import { LipidsCalculator } from './calculators/lipids-calculator';
import { ArrhythmiaCalculator } from './calculators/arrhythmia-calculator';
import { FeedbackManager } from './feedback-manager';
import { BaseCalculator, CalculationResult } from './types';

/**
 * Clase principal que gestiona el cálculo de signos vitales
 * Integra todos los calculadores especializados y gestiona feedback bidireccional
 */
export class VitalSignsCalculatorManager {
  private calculators: Map<VitalSignChannel, BaseCalculator> = new Map();
  private feedbackManager: FeedbackManager;
  private lastCalculation: CalculationResult | null = null;
  private visualizationData: any = null;
  
  constructor() {
    // Inicializar calculadores especializados
    this.calculators.set('heartRate', new HeartRateCalculator());
    this.calculators.set('spo2', new SPO2Calculator());
    this.calculators.set('bloodPressure', new BloodPressureCalculator());
    this.calculators.set('glucose', new GlucoseCalculator());
    this.calculators.set('cholesterol', new LipidsCalculator('cholesterol'));
    this.calculators.set('triglycerides', new LipidsCalculator('triglycerides'));
    
    // Inicializar gestor de feedback
    this.feedbackManager = new FeedbackManager();
    
    console.log("VitalSignsCalculator: Inicializado con 6 calculadores especializados");
  }
  
  /**
   * Procesa señales optimizadas para calcular signos vitales
   */
  public processOptimizedSignals(
    optimizedSignals: Record<VitalSignChannel, OptimizedSignal | null>
  ): CalculationResult {
    // Inicializar resultado
    const result: CalculationResult = {
      heartRate: { value: 0, confidence: 0 },
      spo2: { value: 0, confidence: 0 },
      bloodPressure: { value: "--/--", confidence: 0 },
      glucose: { value: 0, confidence: 0 },
      cholesterol: { value: 0, confidence: 0 },
      triglycerides: { value: 0, confidence: 0 },
      arrhythmia: { status: "--", data: null }
    };
    
    try {
      // Procesar cada calculador con su señal correspondiente
      for (const [channel, calculator] of this.calculators.entries()) {
        // Obtener señal optimizada para este canal
        const signal = optimizedSignals[channel];
        
        if (signal) {
          // Calcular utilizando señal optimizada
          const channelResult = calculator.calculate(signal);
          
          // Guardar resultado
          if (channel === 'heartRate') {
            result.heartRate = channelResult;
            
            // Calcular arritmias si hay datos de frecuencia cardíaca
            if (signal.metadata?.intervals && signal.metadata.intervals.length > 0) {
              const arrhythmiaCalculator = new ArrhythmiaCalculator();
              result.arrhythmia = arrhythmiaCalculator.calculate({
                channel: 'heartRate',
                value: channelResult.value as number,
                timestamp: signal.timestamp,
                confidence: channelResult.confidence,
                metadata: {
                  intervals: signal.metadata.intervals,
                  lastPeakTime: signal.metadata.lastPeakTime
                }
              });
            }
          } else if (channel === 'spo2') {
            result.spo2 = channelResult;
          } else if (channel === 'bloodPressure') {
            result.bloodPressure = channelResult;
          } else if (channel === 'glucose') {
            result.glucose = channelResult;
          } else if (channel === 'cholesterol') {
            result.cholesterol = channelResult;
          } else if (channel === 'triglycerides') {
            result.triglycerides = channelResult;
          }
        }
      }
      
      // Guardar último cálculo
      this.lastCalculation = result;
      
      // Actualizar datos de visualización
      this.updateVisualizationData(optimizedSignals);
      
      return result;
    } catch (error) {
      console.error("Error en cálculo de signos vitales:", error);
      return result;
    }
  }
  
  /**
   * Genera retroalimentación para el optimizador
   */
  public generateFeedback(): FeedbackData[] {
    if (!this.lastCalculation) {
      return [];
    }
    
    return this.feedbackManager.generateFeedback(this.lastCalculation);
  }
  
  /**
   * Reinicia todos los calculadores
   */
  public reset(): void {
    for (const calculator of this.calculators.values()) {
      calculator.reset();
    }
    
    this.lastCalculation = null;
    this.visualizationData = null;
  }
  
  /**
   * Obtiene datos para visualización
   */
  public getVisualizationData(): any {
    return this.visualizationData;
  }
  
  /**
   * Actualiza datos para visualización
   */
  private updateVisualizationData(
    optimizedSignals: Record<VitalSignChannel, OptimizedSignal | null>
  ): void {
    // Crear estructura para visualización
    const visualData: any = {
      heartRate: {
        values: [],
        peaks: [],
        intervals: []
      },
      spo2: {
        values: []
      },
      bloodPressure: {
        values: []
      }
    };
    
    // Añadir datos de frecuencia cardíaca
    const hrSignal = optimizedSignals.heartRate;
    if (hrSignal) {
      visualData.heartRate.values.push({
        value: hrSignal.value,
        timestamp: hrSignal.timestamp
      });
      
      if (hrSignal.metadata?.peaks) {
        visualData.heartRate.peaks.push({
          timestamp: hrSignal.timestamp,
          value: hrSignal.value
        });
      }
      
      if (hrSignal.metadata?.intervals) {
        visualData.heartRate.intervals = hrSignal.metadata.intervals;
      }
    }
    
    // Añadir datos de SpO2
    const spo2Signal = optimizedSignals.spo2;
    if (spo2Signal) {
      visualData.spo2.values.push({
        value: spo2Signal.value,
        timestamp: spo2Signal.timestamp
      });
    }
    
    // Añadir datos de presión arterial
    const bpSignal = optimizedSignals.bloodPressure;
    if (bpSignal) {
      visualData.bloodPressure.values.push({
        value: bpSignal.value,
        timestamp: bpSignal.timestamp
      });
    }
    
    // Guardar datos para visualización
    this.visualizationData = visualData;
  }
}
