
export declare class SignalMetrics {
  storeValue(value: number): void;
  getRecentValues(count?: number): number[];
  detectPeak(value: number, lastPeakTime: number | null): { 
    detected: boolean; 
    timestamp: number | null;
  };
  calculateStandardDeviation(values: number[]): number;
  reset(): void;
}
