
/**
 * Type definitions for processors in the vital-signs module
 * This helps centralize processor interfaces and avoid circular dependencies
 */

export interface BaseProcessorInterface {
  reset(): void;
  getPPGValues(): number[];
}

export interface FilterProcessorInterface extends BaseProcessorInterface {
  applySMAFilter(value: number, values?: number[]): number;
  applyEMAFilter(value: number, values?: number[], alpha?: number): number;
  applyMedianFilter(value: number, values?: number[]): number;
}

export interface QualityProcessorInterface extends BaseProcessorInterface {
  updateNoiseLevel(rawValue: number, filteredValue: number): void;
  calculateSignalQuality(ppgValues: number[]): number;
}

export interface HeartRateProcessorInterface extends BaseProcessorInterface {
  calculateHeartRate(values: number[], sampleRate?: number): number;
}
