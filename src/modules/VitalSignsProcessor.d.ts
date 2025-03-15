
export declare class VitalSignsProcessor {
  constructor();
  processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): {
    spo2: number;
    pressure: string;
    arrhythmiaStatus: string;
  };
  reset(): void;
}
