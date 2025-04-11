
import * as tf from '@tensorflow/tfjs';
import { TFBaseModel } from './TFBaseModel';
import { TensorUtils } from '../TensorAdapter';

/**
 * Modelo de ritmo cardíaco basado en TensorFlow.js
 * Implementa una red neural convolucional con mecanismo de atención
 */
export class TFHeartRateModel extends TFBaseModel {
  private modelReady: boolean = false;
  private modelLoading: boolean = false;
  private modelLoadPromise: Promise<void> | null = null;
  
  constructor() {
    super(
      'TFHeartRateModel',
      [300], // Ventana de entrada - 300 muestras de PPG
      [1],   // Salida - ritmo cardíaco (BPM)
      '3.0.0'
    );
  }
  
  /**
   * Inicializa el modelo, intentando cargarlo desde IndexedDB primero
   */
  protected async initModel(): Promise<void> {
    if (this.modelReady || this.modelLoading) {
      if (this.modelLoading && this.modelLoadPromise) {
        await this.modelLoadPromise;
      }
      return;
    }
    
    this.modelLoading = true;
    
    try {
      this.modelLoadPromise = (async () => {
        try {
          // Intentar cargar el modelo guardado
          const modelUrl = 'indexeddb://heartrate-model';
          this.tfModel = await tf.loadLayersModel(modelUrl)
            .catch(() => null);
          
          // Si no existe, crear uno nuevo
          if (!this.tfModel) {
            console.log('TFHeartRateModel: Creando modelo nuevo');
            this.tfModel = this.createModel();
            
            // Guardar para uso futuro
            await this.tfModel.save('indexeddb://heartrate-model');
          } else {
            console.log('TFHeartRateModel: Modelo cargado desde IndexedDB');
          }
          
          this.modelReady = true;
        } catch (error) {
          console.error('TFHeartRateModel: Error inicializando modelo:', error);
          
          // Crear modelo en memoria como fallback
          this.tfModel = this.createModel();
          this.modelReady = true;
        }
      })();
      
      await this.modelLoadPromise;
    } finally {
      this.modelLoading = false;
      this.modelLoadPromise = null;
    }
  }
  
  /**
   * Crea un modelo de red neural convolucional para detección de ritmo cardíaco
   */
  protected createModel(): tf.LayersModel {
    // Crear un modelo secuencial
    const inputShape = [this.inputShape[0], 1];
    const input = tf.input({shape: inputShape});
    
    // Capa convolucional 1D para extraer características
    let x = tf.layers.conv1d({
      filters: 16,
      kernelSize: 5,
      strides: 1,
      padding: 'same',
      activation: 'relu',
      kernelInitializer: 'heNormal'
    }).apply(input);
    
    // Normalización por lotes
    x = tf.layers.batchNormalization().apply(x);
    
    // Pooling para reducir dimensionalidad
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
    
    // Capa convolucional 2
    x = tf.layers.conv1d({
      filters: 32,
      kernelSize: 5,
      padding: 'same',
      activation: 'relu',
      kernelInitializer: 'heNormal'
    }).apply(x);
    
    x = tf.layers.batchNormalization().apply(x);
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
    
    // Capa convolucional 3
    x = tf.layers.conv1d({
      filters: 64,
      kernelSize: 3,
      padding: 'same',
      activation: 'relu',
      kernelInitializer: 'heNormal'
    }).apply(x);
    
    x = tf.layers.batchNormalization().apply(x);
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
    
    // Mecanismo de atención simplificado
    const attentionOutput = this.createAttentionMechanism(x);
    
    // Aplanar para capas densas
    x = tf.layers.flatten().apply(attentionOutput);
    
    // Capas densas para predicción final
    x = tf.layers.dense({
      units: 64, 
      activation: 'relu',
      kernelInitializer: 'heNormal'
    }).apply(x);
    
    x = tf.layers.dropout({rate: 0.3}).apply(x);
    
    x = tf.layers.dense({
      units: 32, 
      activation: 'relu',
      kernelInitializer: 'heNormal'
    }).apply(x);
    
    // Capa de salida para BPM
    const output = tf.layers.dense({
      units: 1,
      activation: 'linear'
    }).apply(x);
    
    // Construir y compilar modelo
    const model = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    return model;
  }
  
  /**
   * Implementa un mecanismo de atención simplificado
   */
  private createAttentionMechanism(input: tf.SymbolicTensor): tf.SymbolicTensor {
    // Transformer-style self attention
    const inputShape = input.shape as tf.Shape;
    const sequenceLength = inputShape[1] as number;
    const featureDimension = inputShape[2] as number;
    
    // Projection for query, key, value
    const query = tf.layers.dense({units: featureDimension}).apply(input);
    const key = tf.layers.dense({units: featureDimension}).apply(input);
    const value = tf.layers.dense({units: featureDimension}).apply(input);
    
    // Calculate attention scores
    const scoreLayer = tf.layers.dot({axes: [2, 2]});
    
    // @ts-ignore: TS doesn't recognize the apply method with multiple inputs
    const scores = scoreLayer.apply([query, key]);
    
    // Scale scores
    const scaled = tf.layers.lambda({
      function: (x: tf.Tensor) => tf.div(x, Math.sqrt(featureDimension))
    }).apply(scores);
    
    // Apply softmax
    const weights = tf.layers.softmax().apply(scaled);
    
    // Apply attention weights
    const weightedLayer = tf.layers.dot({axes: [2, 1]});
    
    // @ts-ignore: TS doesn't recognize the apply method with multiple inputs
    const contextVector = weightedLayer.apply([weights, value]);
    
    // Concatenate with original input (residual connection)
    const concatenateLayer = tf.layers.concatenate({axis: 2});
    
    // @ts-ignore: TS doesn't recognize the apply method with multiple inputs
    const output = concatenateLayer.apply([input, contextVector]);
    
    return output;
  }
  
  /**
   * Preprocesa la entrada para el modelo
   */
  protected applyInputCalibration(input: number[]): number[] {
    // Aplicar normalización
    const normalized = TensorUtils.normalizeInput(input, -1, 1);
    
    // Aplicar suavizado
    const smoothed = TensorUtils.movingAverage(normalized, 5);
    
    return smoothed;
  }
  
  /**
   * Aplica calibración a la salida
   */
  protected applyOutputCalibration(output: number[]): number[] {
    // Aplicar factor de calibración
    const calibrated = output.map(val => val * this.calibrationFactor);
    
    // Limitar a rango fisiológico (30-220 BPM)
    return calibrated.map(val => Math.max(30, Math.min(220, val)));
  }
  
  /**
   * Actualiza el modelo con nuevos datos de entrenamiento (fine-tuning)
   */
  public async updateModel(inputs: number[][], targets: number[][]): Promise<void> {
    if (!this.tfModel) {
      await this.initModel();
    }
    
    try {
      // Convertir datos a tensores
      const xs = tf.tensor3d(inputs.map(input => 
        TensorUtils.padArray(input, this.inputShape[0])
      ), [inputs.length, this.inputShape[0], 1]);
      
      const ys = tf.tensor2d(targets);
      
      // Configurar entrenamiento
      await this.tfModel!.fit(xs, ys, {
        epochs: 5,
        batchSize: 32,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Época ${epoch}: pérdida = ${logs?.loss}`);
          }
        }
      });
      
      // Limpiar tensores
      xs.dispose();
      ys.dispose();
      
      // Guardar modelo actualizado
      await this.tfModel!.save('indexeddb://heartrate-model');
      
      console.log('TFHeartRateModel: Modelo actualizado y guardado');
    } catch (error) {
      console.error('TFHeartRateModel: Error actualizando modelo:', error);
    }
  }
}
