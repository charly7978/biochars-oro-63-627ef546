
export declare class ArrhythmiaDetector {
  updateRRIntervals(rrData?: { intervals: number[]; lastPeakTime: number | null }): void;
  calculateRRVariation(): number;
  getArrhythmiaStatus(): string;
  hasArrhythmia(): boolean;
  isInLearningPhase(): boolean;
  calculateRMSSD(): number;
  reset(): void;
}
