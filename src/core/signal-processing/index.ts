
import { SignalCoreProcessor } from './SignalCoreProcessor';
import { SignalChannel } from './SignalChannel';
import { signalProcessingService } from './SignalProcessingService';

// Create a factory function to ensure we can create the right type of processor
export const createSignalProcessor = () => {
  return new SignalCoreProcessor({
    bufferSize: 300,
    sampleRate: 30,
    channels: [
      'heartbeat',
      'spo2',
      'bloodPressure',
      'arrhythmia',
      'glucose',
      'lipids',
      'hemoglobin',
      'hydration'
    ]
  });
};

// Export all core signal processing classes
export {
  SignalCoreProcessor,
  SignalChannel,
  signalProcessingService
};

export * from './SignalProcessingService';
