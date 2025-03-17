
export type SignalValue = number;

export interface SignalData {
  value: SignalValue;
  timestamp: number;
}

export interface FilteredSignalData extends SignalData {
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
}
