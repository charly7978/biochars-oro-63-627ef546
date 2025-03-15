
/**
 * Configuration settings for the advanced signal processor
 */
export interface ProcessorConfig {
  lowPowerMode: boolean;
  bufferSize: number;
  calibrationEnabled: boolean;
}

/**
 * Default configuration for the advanced signal processor
 */
export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  lowPowerMode: false,
  bufferSize: 300,
  calibrationEnabled: true
};
