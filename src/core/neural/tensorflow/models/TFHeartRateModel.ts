
import * as tf from '@tensorflow/tfjs';

/**
 * Modelo de frecuencia cardíaca basado en TensorFlow.js
 * Implementación simplificada para demostración
 */
export class TFHeartRateModel {
  private model: tf.LayersModel | null = null;
  private inputShape: number[] = [300, 1];
  private isInitialized: boolean = false;
  
  constructor() {
    // Model will be created on demand
  }
  
  /**
   * Carga o crea el modelo
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Intenta cargar el modelo desde storage
      this.model = await tf.loadLayersModel('indexeddb://heartrate-model')
        .catch(() => null);
      
      if (!this.model) {
        console.log('Creating new heart rate model');
        this.model = this.createModel();
        
        // Guardar el modelo para uso futuro
        await this.model.save('indexeddb://heartrate-model')
          .catch(err => console.warn('Failed to save model:', err));
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing heart rate model:', error);
      throw error;
    }
  }
  
  /**
   * Crea un modelo de red neuronal para detección de ritmo cardíaco
   */
  private createModel(): tf.LayersModel {
    const input = tf.input({shape: this.inputShape});
    
    // Preprocesamiento - normalización
    const normalized = tf.layers.lambda({
      outputShape: this.inputShape,
      // @ts-ignore - can't properly type this callback
      function: (x: any) => tf.div(
        tf.sub(x, tf.mean(x)), 
        tf.add(tf.std(x), tf.scalar(1e-5))
      )
    }).apply(input);
    
    // Capas convolucionales
    let x: any = tf.layers.conv1d({
      filters: 16,
      kernelSize: 5,
      strides: 1,
      padding: 'same',
      activation: 'relu',
      kernelInitializer: 'glorotUniform'
    }).apply(normalized);
    
    x = tf.layers.maxPooling1d({
      poolSize: 2,
      strides: 2
    }).apply(x);
    
    x = tf.layers.conv1d({
      filters: 32,
      kernelSize: 3,
      strides: 1,
      padding: 'same',
      activation: 'relu',
      kernelInitializer: 'glorotUniform'
    }).apply(x);
    
    x = tf.layers.maxPooling1d({
      poolSize: 2,
      strides: 2
    }).apply(x);
    
    // Conexión residual
    const residual = tf.layers.conv1d({
      filters: 32,
      kernelSize: 1,
      strides: 4,
      padding: 'same',
      kernelInitializer: 'glorotUniform'
    }).apply(normalized);
    
    // Combinamos la salida principal con la residual
    // Usando funcional API para simular Add
    x = tf.layers.add().apply([x, residual]);
    x = tf.layers.activation({activation: 'relu'}).apply(x);
    
    // Capas densas
    x = tf.layers.flatten().apply(x);
    x = tf.layers.dense({
      units: 64,
      activation: 'relu',
      kernelInitializer: 'glorotUniform'
    }).apply(x);
    
    x = tf.layers.dropout({rate: 0.25}).apply(x);
    
    // Capa de salida - frecuencia cardíaca
    const output = tf.layers.dense({
      units: 1,
      activation: 'linear',
      kernelInitializer: 'glorotUniform'
    }).apply(x);
    
    // Crear y compilar modelo
    const model = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    return model;
  }
  
  /**
   * Preprocesa la entrada antes de la predicción
   */
  private preprocessInput(input: number[]): tf.Tensor {
    // Asegurar que la entrada tiene el tamaño adecuado
    let processedInput = [...input];
    
    if (processedInput.length < this.inputShape[0]) {
      // Rellenar con ceros
      while (processedInput.length < this.inputShape[0]) {
        processedInput.push(0);
      }
    } else if (processedInput.length > this.inputShape[0]) {
      // Truncar
      processedInput = processedInput.slice(0, this.inputShape[0]);
    }
    
    // Convertir a tensor 3D [1, inputSize, 1]
    return tf.tensor3d(
      [processedInput.map(v => [v])],
      [1, this.inputShape[0], 1]
    );
  }
  
  /**
   * Realiza una predicción de frecuencia cardíaca
   */
  async predict(input: number[]): Promise<number> {
    if (!this.isInitialized || !this.model) {
      await this.initialize();
    }
    
    try {
      // Preprocesar entrada
      const tensorInput = this.preprocessInput(input);
      
      // Realizar predicción
      const prediction = this.model!.predict(tensorInput) as tf.Tensor;
      const value = (await prediction.data())[0];
      
      // Limitar a rango fisiológico (40-200 bpm)
      const heartRate = Math.max(40, Math.min(200, value));
      
      // Limpiar tensores
      tensorInput.dispose();
      prediction.dispose();
      
      return Math.round(heartRate);
    } catch (error) {
      console.error('Error predicting heart rate:', error);
      return 75; // Valor por defecto
    }
  }
  
  /**
   * Libera recursos
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isInitialized = false;
  }
}
