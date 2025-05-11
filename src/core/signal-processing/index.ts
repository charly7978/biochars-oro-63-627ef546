
/**
 * Signal Processing module - exports core functionality
 */
import { SignalCoreProcessor, VITAL_SIGN_CHANNELS, SignalProcessingConfig } from './SignalCoreProcessor';
import { SignalChannel } from './SignalChannel';

/**
 * Create signal processor with optimized architecture
 * Multiple exclusive channels with bidirectional feedback
 */
export function createSignalProcessor(config: Partial<SignalProcessingConfig> = {}): SignalCoreProcessor {
  const defaultConfig: SignalProcessingConfig = {
    bufferSize: 300,
    sampleRate: 30,
    channels: Object.values(VITAL_SIGN_CHANNELS)
  };
  
  const finalConfig: SignalProcessingConfig = {
    ...defaultConfig,
    ...config,
    channels: [
      ...(defaultConfig.channels || []),
      ...(config.channels || [])
    ]
  };
  
  return new SignalCoreProcessor(finalConfig);
}

// Export key classes and types
export { SignalChannel, VITAL_SIGN_CHANNELS };
export type { SignalProcessingConfig };
