
export declare class SignalProcessor {
  processSignal(ppgValue: number): number;
  getRecentValues(count?: number): number[];
  reset(): void;
}
