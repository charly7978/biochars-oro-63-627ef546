
export declare class ArrhythmiaProcessor {
  detectArrhythmia(): void;
  updateRRIntervals(rrData: { intervals: number[]; lastPeakTime: number | null }): void;
  getArrhythmiaStatus(): string;
  isInLearningPhase(): boolean;
  hasArrhythmia(): boolean;
  reset(): void;
}
