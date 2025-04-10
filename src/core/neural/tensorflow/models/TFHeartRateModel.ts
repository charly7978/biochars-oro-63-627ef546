import * as tf from '@tensorflow/tfjs';
import { TensorFlowModel } from '../TensorFlowModel';

export class TFHeartRateModel extends TensorFlowModel {
  private readonly INPUT_LENGTH = 128;
  
  constructor(modelPath: string) {
    super(modelPath);
  }
  
  padInput(inputData: number[]): number[] {
    const inputLength = inputData.length;
    
    if (inputLength < this.INPUT_LENGTH) {
      const paddingLength = this.INPUT_LENGTH - inputLength;
      const padding = new Array(paddingLength).fill(0);
      return [...inputData, ...padding];
    } else if (inputLength > this.INPUT_LENGTH) {
      return inputData.slice(inputLength - this.INPUT_LENGTH);
    }
    
    return inputData;
  }

  async predict(inputData: number[]): Promise<number> {
    if (!this.model) {
      throw new Error("Model not loaded");
    }
    
    // Ensure input is appropriate length
    const paddedInput = this.padInput(inputData);
    
    // Convert to 2D tensor with shape [1, INPUT_LENGTH] for model input
    const inputTensor = tf.tensor2d([paddedInput], [1, this.INPUT_LENGTH]);
    
    // Get prediction
    const outputTensor = this.model.predict(inputTensor) as tf.Tensor;
    const prediction = await outputTensor.data();
    
    // Cleanup tensors
    inputTensor.dispose();
    outputTensor.dispose();
    
    // Return first value from prediction array
    return prediction[0];
  }
}
