
/**
 * Interface for optimized signal processing channels
 */
export interface OptimizedSignalChannel {
  type: string;
  processSignal(value: number): void;
  getResults(): any;
  reset(): void;
}
