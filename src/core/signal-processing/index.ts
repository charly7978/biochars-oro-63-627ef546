
/**
 * Signal Processing Core Module
 * Centralized signal processing system with specialized channels for vital signs
 */

export * from './SignalCoreProcessor';
export * from './SignalChannel';
export * from './filters/SignalFilter';

// Create a default instance for simpler usage
import { SignalCoreProcessor, SignalProcessingConfig } from './SignalCoreProcessor';

const defaultConfig: SignalProcessingConfig = {
  bufferSize: 300,
  sampleRate: 30,
  channels: ['heartbeat', 'spo2', 'arrhythmia', 'bloodPressure']
};

// Export default processor instance
export const createSignalProcessor = (config?: Partial<SignalProcessingConfig>) => {
  return new SignalCoreProcessor({
    ...defaultConfig,
    ...config
  });
};
