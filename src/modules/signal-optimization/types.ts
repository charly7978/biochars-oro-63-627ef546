
export interface OptimizedSignal {
  channel: VitalSignChannel;
  timestamp: number;
  value: number;
  quality: number;
  optimizedValue: number;
  parameters: OptimizationParameters;
  metadata?: {
    rrIntervals?: number[];
    lastPeakTime?: number | null;
    isPeak?: boolean;
    [key: string]: any;
  };
}
