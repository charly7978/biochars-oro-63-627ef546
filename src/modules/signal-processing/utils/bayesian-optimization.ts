/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE
 * 
 * Bayesian Optimization utility for PPG signal processing
 * Provides utilities for parameter optimization using Bayesian methods
 */

/**
 * Interface for optimization parameters
 */
export interface OptimizationParameter {
  name: string;
  min: number;
  max: number;
  current: number;
}

/**
 * Result of an optimization iteration
 */
export interface OptimizationResult {
  parameters: Record<string, number>;
  expectedImprovement: number;
  uncertainty: number;
}

/**
 * Bayesian optimization engine for signal processing
 */
export class BayesianOptimizer {
  private parameters: OptimizationParameter[] = [];
  private observedValues: Array<{params: Record<string, number>, score: number}> = [];
  private explorationFactor: number = 0.1;
  private readonly MAX_HISTORY_SIZE = 50;

  /**
   * Create a new optimizer with a set of parameters to optimize
   */
  constructor(parameters: OptimizationParameter[]) {
    this.parameters = parameters;
    console.log("BayesianOptimizer: Created with parameters", 
      parameters.map(p => `${p.name}: ${p.min}-${p.max}, current: ${p.current}`));
  }

  /**
   * Add an observation with current parameter values and resulting score
   */
  public addObservation(paramValues: Record<string, number>, score: number): void {
    this.observedValues.push({params: {...paramValues}, score});
    
    // Keep history bounded
    if (this.observedValues.length > this.MAX_HISTORY_SIZE) {
      this.observedValues.shift();
    }
    
    console.log("BayesianOptimizer: Added observation with score", score);
  }

  /**
   * Compute expected improvement for a parameter set based on observed values
   */
  private computeExpectedImprovement(paramValues: Record<string, number>): number {
    if (this.observedValues.length < 3) return 0.5; // Not enough data
    
    // Simplified EI calculation - actual Bayesian EI would use Gaussian process
    const paramDistance = (a: Record<string, number>, b: Record<string, number>) => {
      return Object.keys(a).reduce((sum, key) => {
        const paramDef = this.parameters.find(p => p.name === key);
        if (!paramDef) return sum;
        
        // Normalize distance by parameter range
        const range = paramDef.max - paramDef.min;
        const normalizedDist = Math.abs(a[key] - b[key]) / range;
        return sum + normalizedDist * normalizedDist;
      }, 0);
    };
    
    // For each observed point, compute distance and weight
    const distanceWeights = this.observedValues.map(obs => {
      const dist = paramDistance(obs.params, paramValues);
      // Convert distance to similarity (closer = higher weight)
      return { score: obs.score, weight: Math.exp(-5 * dist) };
    });
    
    // Compute weighted average of scores
    const totalWeight = distanceWeights.reduce((sum, dw) => sum + dw.weight, 0);
    if (totalWeight === 0) return 0.5;
    
    const weightedScore = distanceWeights.reduce(
      (sum, dw) => sum + dw.score * dw.weight, 0
    ) / totalWeight;
    
    // Compute variance as uncertainty measure
    const variance = distanceWeights.reduce(
      (sum, dw) => sum + dw.weight * Math.pow(dw.score - weightedScore, 2), 0
    ) / totalWeight;
    
    // Combine mean and variance with exploration factor
    // This is a simplified acquisition function inspired by Upper Confidence Bound
    return weightedScore + this.explorationFactor * Math.sqrt(variance);
  }

  /**
   * Suggest next parameter values to try based on previous observations
   */
  public suggestNextParameters(): OptimizationResult {
    if (this.observedValues.length < 3) {
      // Not enough data for meaningful optimization, return current with some randomness
      const result: Record<string, number> = {};
      let totalUncertainty = 0;
      
      this.parameters.forEach(param => {
        // Small random perturbation
        const range = param.max - param.min;
        const perturbation = (Math.random() - 0.5) * range * 0.2;
        result[param.name] = Math.max(param.min, 
                              Math.min(param.max, param.current + perturbation));
        totalUncertainty += range * 0.1;
      });
      
      return {
        parameters: result,
        expectedImprovement: 0.5,
        uncertainty: totalUncertainty / this.parameters.length
      };
    }
    
    // Start with best observed parameters
    const bestObservation = [...this.observedValues]
      .sort((a, b) => b.score - a.score)[0];
    
    // Search space around best observation
    const candidateCount = 10;
    const candidates: Array<{params: Record<string, number>, ei: number, uncertainty: number}> = [];
    
    // Generate candidates around best observation
    for (let i = 0; i < candidateCount; i++) {
      const candidateParams: Record<string, number> = {};
      let uncertainty = 0;
      
      this.parameters.forEach(param => {
        const range = param.max - param.min;
        // Explore parameter space with random perturbations
        const perturbation = (Math.random() - 0.5) * range * (0.1 + this.explorationFactor);
        const value = Math.max(param.min, 
                     Math.min(param.max, bestObservation.params[param.name] + perturbation));
        candidateParams[param.name] = value;
        
        // Calculate uncertainty as distance from best known point
        const paramUncertainty = Math.abs(value - bestObservation.params[param.name]) / range;
        uncertainty += paramUncertainty;
      });
      
      const ei = this.computeExpectedImprovement(candidateParams);
      candidates.push({
        params: candidateParams,
        ei,
        uncertainty: uncertainty / this.parameters.length
      });
    }
    
    // Sort by expected improvement and pick the best
    candidates.sort((a, b) => b.ei - a.ei);
    const bestCandidate = candidates[0];
    
    console.log("BayesianOptimizer: Suggesting parameters with EI", 
                bestCandidate.ei.toFixed(3), 
                "uncertainty", bestCandidate.uncertainty.toFixed(3));
    
    return {
      parameters: bestCandidate.params,
      expectedImprovement: bestCandidate.ei,
      uncertainty: bestCandidate.uncertainty
    };
  }

  /**
   * Set the exploration factor (higher = more exploration)
   */
  public setExplorationFactor(factor: number): void {
    this.explorationFactor = Math.max(0.01, Math.min(1, factor));
  }

  /**
   * Get the best parameters found so far
   */
  public getBestParameters(): Record<string, number> | null {
    if (this.observedValues.length === 0) return null;
    
    const bestObservation = [...this.observedValues]
      .sort((a, b) => b.score - a.score)[0];
    
    return {...bestObservation.params};
  }

  /**
   * Reset the optimizer
   */
  public reset(): void {
    this.observedValues = [];
    console.log("BayesianOptimizer: Reset");
  }
}

/**
 * Create a new optimizer with default PPG processing parameters
 */
export function createDefaultPPGOptimizer(): BayesianOptimizer {
  return new BayesianOptimizer([
    { name: "qualityThreshold", min: 0.3, max: 0.9, current: 0.7 },
    { name: "amplificationFactor", min: 0.5, max: 5.0, current: 2.0 },
    { name: "adaptationRate", min: 0.01, max: 0.5, current: 0.15 },
    { name: "filterStrength", min: 0.1, max: 3.0, current: 1.0 },
    { name: "predictionHorizon", min: 1, max: 10, current: 5 },
  ]);
}
