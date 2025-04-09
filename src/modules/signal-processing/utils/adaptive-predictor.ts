
/**
 * Adaptive predictor for signal processing
 */

export interface AdaptivePredictor {
  predict(value: number): number;
  update(actual: number): void;
  reset(): void;
  getState(): { weights: number[], bias: number };
}

/**
 * Create and return an adaptive predictor instance
 */
export function getAdaptivePredictor(windowSize: number = 5, learningRate: number = 0.05): AdaptivePredictor {
  let weights = Array(windowSize).fill(0);
  let bias = 0;
  let history: number[] = [];
  
  return {
    predict(value: number): number {
      history.push(value);
      if (history.length > windowSize) {
        history.shift();
      }
      
      if (history.length < windowSize) {
        return value; // Not enough data for prediction
      }
      
      // Calculate prediction based on weights and history
      let prediction = bias;
      for (let i = 0; i < windowSize; i++) {
        prediction += weights[i] * history[i];
      }
      
      return prediction;
    },
    
    update(actual: number): void {
      if (history.length < windowSize) return;
      
      // Calculate prediction based on current weights
      let prediction = bias;
      for (let i = 0; i < windowSize; i++) {
        prediction += weights[i] * history[i];
      }
      
      // Calculate error
      const error = actual - prediction;
      
      // Update bias
      bias += learningRate * error;
      
      // Update weights
      for (let i = 0; i < windowSize; i++) {
        weights[i] += learningRate * error * history[i];
      }
    },
    
    reset(): void {
      weights = Array(windowSize).fill(0);
      bias = 0;
      history = [];
    },
    
    getState(): { weights: number[], bias: number } {
      return {
        weights: [...weights],
        bias
      };
    }
  };
}
