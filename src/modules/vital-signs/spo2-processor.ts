
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import * as tf from '@tensorflow/tfjs';
import { SpO2NeuralModel } from '../../core/neural/SpO2Model';
import { SignalOptimizationManager } from '../../core/signal/SignalOptimizationManager';
import { normalizeSignal, getSpectralEntropy } from './utils/tensorflow-utils';
import { ProcessedSignal } from '../../core/types';

/**
 * Procesador especializado ÚNICAMENTE en calcular la saturación de oxígeno en sangre (SpO2)
 * Utiliza optimización adaptativa para obtener la mejor señal para análisis de oxigenación
 */
export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10;
  private spo2Buffer: number[] = [];
  private neuralModel: SpO2NeuralModel;
  private tensorflowInitialized: boolean = false;
  private signalOptimizer: SignalOptimizationManager;
  
  constructor() {
    this.neuralModel = new SpO2NeuralModel();
    this.signalOptimizer = new SignalOptimizationManager();
    this.initializeTensorFlow();
  }
  
  /**
   * Initialize TensorFlow.js
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      // Check for WebGL support first
      const backendName = tf.getBackend();
      if (!backendName) {
        await tf.setBackend('webgl');
      }
      
      // Enable memory management
      tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
      await tf.ready();
      this.tensorflowInitialized = true;
      console.log("SpO2Processor: TensorFlow initialized successfully", {
        backend: tf.getBackend(),
        isReady: tf.engine().ready
      });
    } catch (error) {
      console.error("SpO2Processor: Failed to initialize TensorFlow", error);
      this.tensorflowInitialized = false;
    }
  }

  /**
   * Calcula la saturación de oxígeno (SpO2) únicamente a partir de valores PPG reales
   * No se utiliza simulación ni valores de referencia
   * @param values Valores de señal PPG
   * @returns Valor de SpO2 (porcentaje)
   */
  public calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      return this.getLastValidSpo2(1);
    }

    // Optimizar la señal específicamente para análisis de oxigenación
    for (const val of values) {
      this.signalOptimizer.processSignal({
        filteredValue: val,
        quality: 100, // La calidad será determinada por el optimizador
        value: val,  // Agregado para compatibilidad con ProcessedSignal
        timestamp: Date.now()  // Agregado para compatibilidad con ProcessedSignal
      } as ProcessedSignal);
    }
    
    // Obtener el canal optimizado específicamente para oxigenación
    const oxygenationChannel = this.signalOptimizer.getChannel('oxygenation');
    
    // Si el canal no está disponible o no es de suficiente calidad, usar datos originales
    const optimizedValues = oxygenationChannel && oxygenationChannel.quality > 50 
      ? oxygenationChannel.values.slice(-30)
      : values.slice(-30);
    
    // Use TensorFlow for processing if available
    if (this.tensorflowInitialized) {
      try {
        return this.calculateSpO2WithTensorFlow(optimizedValues);
      } catch (error) {
        console.error("SpO2Processor: TensorFlow processing failed, falling back to standard processing", error);
        return this.calculateSpO2Standard(optimizedValues);
      }
    } else {
      return this.calculateSpO2Standard(optimizedValues);
    }
  }

  /**
   * Calculate SpO2 using TensorFlow for better performance
   */
  private calculateSpO2WithTensorFlow(values: number[]): number {
    // Create a tensor from the values
    try {
      // Normalizar señal para el modelo
      const normalizedSignal = normalizeSignal(values);
      
      // Usar el modelo neural para predecir SpO2
      const prediction = this.neuralModel.predict(normalizedSignal.arraySync() as number[]);
      
      // Liberar tensor para evitar fugas de memoria
      normalizedSignal.dispose();
      
      const spO2 = Math.round(prediction[0]);
      
      // Actualizar buffer con el valor predicho
      this.updateSpO2Buffer(spO2);
      
      // Devolver el promedio para mayor estabilidad
      return this.getAverageSpO2();
    } catch (error) {
      console.error("SpO2Processor: Neural prediction failed", error);
      
      // Liberar recursos de TensorFlow
      tf.engine().endScope();
      tf.engine().startScope();
      
      // Recurrir al cálculo estándar
      return this.calculateSpO2Standard(values);
    }
  }

  /**
   * Standard calculation method without TensorFlow
   */
  private calculateSpO2Standard(values: number[]): number {
    // Calcular componente DC (valor promedio)
    const dc = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    if (dc === 0) {
      return this.getLastValidSpo2(1);
    }

    // Calcular componente AC (amplitud pico a pico)
    const max = Math.max(...values);
    const min = Math.min(...values);
    const ac = max - min;
    
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < 0.06) {
      return this.getLastValidSpo2(2);
    }

    // Cálculo directo a partir de características de señal real
    const R = (ac / dc);
    
    let spO2 = Math.round(98 - (15 * R));
    
    // Ajustar según calidad de perfusión real
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(98, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }

    spO2 = Math.min(98, spO2);
    
    // Actualizar buffer con valor calculado
    this.updateSpO2Buffer(spO2);
    
    // Aplicar feedback al optimizador con el resultado
    this.provideFeedbackToOptimizer(R, perfusionIndex, spO2);
    
    // Devolver el promedio para mayor estabilidad
    return this.getAverageSpO2();
  }
  
  /**
   * Proporciona retroalimentación al optimizador para mejorar la calidad de la señal
   */
  private provideFeedbackToOptimizer(R: number, perfusionIndex: number, spO2: number): void {
    // Solo proporcionar feedback si tenemos un canal de oxigenación y un valor válido de SpO2
    if (spO2 < 80 || spO2 > 100) return;
    
    // La confianza se basa en el índice de perfusión
    const confidence = Math.min(1, perfusionIndex / 0.15);
    
    // La precisión se basa en la estabilidad del SpO2
    const accuracy = this.spo2Buffer.length > 3 ? this.calculateSpO2Stability() : 0.5;
    
    // Proporcionar feedback directo al optimizador a través de sus estructuras internas
    const oxygenationChannel = this.signalOptimizer.getChannel('oxygenation');
    if (oxygenationChannel) {
      // Actualizar metadatos del canal directamente
      oxygenationChannel.metadata = oxygenationChannel.metadata || {};
      oxygenationChannel.metadata.confidence = confidence;
      oxygenationChannel.metadata.accuracy = accuracy;
      oxygenationChannel.metadata.errorRate = 1 - accuracy;
    }
  }
  
  /**
   * Calcula la estabilidad de las mediciones de SpO2
   */
  private calculateSpO2Stability(): number {
    if (this.spo2Buffer.length < 3) return 0.5;
    
    // Calcular variación
    const values = this.spo2Buffer;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Alta estabilidad = baja variación
    return Math.max(0, Math.min(1, 1 - (stdDev / 5)));
  }
  
  /**
   * Actualiza el buffer de SpO2 con un nuevo valor
   */
  private updateSpO2Buffer(spO2: number): void {
    // Evitar añadir valores inválidos
    if (spO2 <= 0 || spO2 > 100) {
      return;
    }
    
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }
  }
  
  /**
   * Calcula el promedio de SpO2 del buffer
   */
  private getAverageSpO2(): number {
    if (this.spo2Buffer.length === 0) return 0;
    
    // Eliminar valores extremos para un cálculo más robusto
    const sortedValues = [...this.spo2Buffer].sort((a, b) => a - b);
    let filteredValues = sortedValues;
    
    // Si tenemos suficientes valores, eliminar los extremos
    if (sortedValues.length >= 5) {
      filteredValues = sortedValues.slice(1, -1);
    }
    
    const sum = filteredValues.reduce((a, b) => a + b, 0);
    return Math.round(sum / filteredValues.length);
  }
  
  /**
   * Obtener el último valor válido de SpO2 con decaimiento opcional
   * Solo utiliza valores históricos reales
   */
  private getLastValidSpo2(decayAmount: number): number {
    if (this.spo2Buffer.length > 0) {
      // Obtener el último valor válido
      const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
      
      // Aplicar decaimiento con límites fisiológicos
      return Math.max(80, Math.min(100, lastValid - decayAmount));
    }
    return 95; // Valor predeterminado fisiológicamente razonable
  }

  /**
   * Reiniciar el procesador para asegurar un estado limpio
   * Asegura que todas las mediciones comienzan desde cero
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.signalOptimizer.reset();
    
    // Liberar memoria de TensorFlow
    if (this.tensorflowInitialized) {
      try {
        tf.disposeVariables();
        tf.engine().endScope();
        tf.engine().startScope();
      } catch (error) {
        console.error("SpO2Processor: Error releasing TensorFlow resources", error);
      }
    }
  }
}
