export interface SignalChannelConfig {
  bufferSize?: number;
  sampleRate?: number;
  filters?: {
    lowPass?: number;
    highPass?: number;
    notch?: number;
  };
  feedbackEnabled?: boolean;
  optimizationLevel?: 'low' | 'medium' | 'high';
}

export interface SignalFeedback {
  quality: number;
  needsOptimization: boolean;
  optimizationSuggestions?: {
    filters?: {
      lowPass?: number;
      highPass?: number;
      notch?: number;
    };
    gainAdjustment?: number;
    baselineCorrection?: number;
  };
}

export interface ChannelMetadata {
  timestamp: number;
  quality: number;
  rawValue: number;
  timeDelta: number;
}

export type OptimizationLevel = 'low' | 'medium' | 'high';

export interface SignalProcessorConfig {
  bufferSize: number;
  sampleRate: number;
  channels: string[];
  defaultOptimizationLevel?: OptimizationLevel;
} 