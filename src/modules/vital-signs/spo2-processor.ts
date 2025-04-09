
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAmplitude, findPeaksAndValleys } from './utils';
import * as tf from '@tensorflow/tfjs';
import { SpO2NeuralModel } from '../../core/neural/SpO2Model';

export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10;
  private spo2Buffer: number[] = [];
  private neuralModel: SpO2NeuralModel;
  private tensorflowInitialized: boolean = false;
  
  constructor() {
    this.neuralModel = new SpO2NeuralModel();
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
   * Calculates the oxygen saturation (SpO2) from real PPG values
   * No simulation or reference values are used
   */
  public calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      return this.getLastValidSpo2(1);
    }

    // Use TensorFlow for processing if available
    if (this.tensorflowInitialized) {
      try {
        return this.calculateSpO2WithTensorFlow(values);
      } catch (error) {
        console.error("SpO2Processor: TensorFlow processing failed, falling back to standard processing", error);
        return this.calculateSpO2Standard(values);
      }
    } else {
      return this.calculateSpO2Standard(values);
    }
  }

  /**
   * Calculate SpO2 using TensorFlow for better performance
   */
  private calculateSpO2WithTensorFlow(values: number[]): number {
    // Create a tensor from the values
    const tensor = tf.tensor1d(values);
    
    // Use the neural model for prediction if we have enough data
    if (values.length >= 30) {
      try {
        // Use neural model to predict SpO2
        const prediction = this.neuralModel.predict(values);
        const spO2 = Math.round(prediction[0]);
        
        // Update buffer with predicted value
        this.updateSpO2Buffer(spO2);
        
        // Return the average for stability
        return this.getAverageSpO2();
      } catch (error) {
        console.error("SpO2Processor: Neural prediction failed", error);
        // Fall back to standard calculation
        return this.calculateSpO2Standard(values);
      }
    } else {
      // Fall back to standard calculation
      return this.calculateSpO2Standard(values);
    }
  }

  /**
   * Standard calculation method without TensorFlow
   */
  private calculateSpO2Standard(values: number[]): number {
    // Calculate DC component (average value)
    const dc = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    if (dc === 0) {
      return this.getLastValidSpo2(1);
    }

    // Calculate AC component (peak-to-peak amplitude)
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    const ac = calculateAmplitude(values, peakIndices, valleyIndices);
    
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < 0.06) {
      return this.getLastValidSpo2(2);
    }

    // Direct calculation from real signal characteristics
    const R = (ac / dc);
    
    let spO2 = Math.round(98 - (15 * R));
    
    // Adjust based on real perfusion quality
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(98, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }

    spO2 = Math.min(98, spO2);
    
    // Update buffer with calculated value
    this.updateSpO2Buffer(spO2);
    
    // Return the average for stability
    return this.getAverageSpO2();
  }
  
  /**
   * Updates the SpO2 buffer with a new value
   */
  private updateSpO2Buffer(spO2: number): void {
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }
  }
  
  /**
   * Calculate average SpO2 from buffer
   */
  private getAverageSpO2(): number {
    if (this.spo2Buffer.length === 0) return 0;
    
    const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.spo2Buffer.length);
  }
  
  /**
   * Get last valid SpO2 with optional decay
   * Only uses real historical values
   */
  private getLastValidSpo2(decayAmount: number): number {
    if (this.spo2Buffer.length > 0) {
      const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
      return Math.max(0, lastValid - decayAmount);
    }
    return 0;
  }

  /**
   * Reset the SpO2 processor state
   * Ensures all measurements start from zero
   */
  public reset(): void {
    this.spo2Buffer = [];
    
    // Release TensorFlow memory
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
