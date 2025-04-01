
import { useState, useCallback } from 'react';

// Define the types for our diagnostics data
interface SignalQualityData {
  current: number;
  status: 'good' | 'moderate' | 'poor' | 'unknown';
  history: number[];
}

interface SignalMetricsData {
  noiseLevel: number;
  stabilityScore: number;
}

interface HeartbeatMetricsData {
  currentBPM: number;
  confidence: number;
  arrhythmiaDetected: boolean;
  signalStrength: number; // Will be converted to 'strong' | 'moderate' | 'weak' | 'unknown' in component
  rrIntervalQuality: number;
}

interface CalibrationData {
  active: boolean;
  status: 'calibrated' | 'calibrating' | 'uncalibrated'; // Will be mapped to allowed values in component
  progress: number;
  lastCalibrated: Date | null;
}

interface ChannelInfo {
  quality: number;
  active: boolean;
}

interface ChannelsData {
  cardiac: ChannelInfo;
  spo2: ChannelInfo;
  glucose: ChannelInfo;
  lipids: ChannelInfo;
  bloodPressure: ChannelInfo;
}

interface ProcessingPipelineData {
  framesProcessed: number;
  framesPerSecond: number;
  activeProcessors: string[];
}

interface SignalHistoryData {
  raw: number[];
  filtered: number[];
  amplified: number[];
}

interface FeedbackSystemData {
  bidirectionalActive: boolean;
  lastFeedbackTime: Date | null;
  feedbackQueue: number;
  adaptations: {component: string, timestamp: Date, adaptation: string}[];
}

interface SystemStatusData {
  isMonitoring: boolean;
  fingerDetected: boolean;
  batteryLevel: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface DiagnosticsData {
  signalQuality: SignalQualityData;
  signalMetrics: SignalMetricsData;
  heartbeatMetrics: HeartbeatMetricsData;
  calibration: CalibrationData;
  channels: ChannelsData;
  processingPipeline: ProcessingPipelineData;
  signalHistory: SignalHistoryData;
  feedbackSystem: FeedbackSystemData;
  systemStatus: SystemStatusData;
}

// Mock data generator for demonstration
const generateMockData = (): DiagnosticsData => {
  const randomQuality = (min = 30, max = 100) => Math.floor(Math.random() * (max - min) + min);
  const randomBoolean = () => Math.random() > 0.5;
  
  const now = new Date();
  const lastCalibrated = new Date();
  lastCalibrated.setHours(lastCalibrated.getHours() - 2);
  
  const lastFeedbackTime = new Date();
  lastFeedbackTime.setMinutes(lastFeedbackTime.getMinutes() - 5);
  
  return {
    signalQuality: {
      current: randomQuality(60, 100),
      status: Math.random() > 0.7 ? 'good' : Math.random() > 0.4 ? 'moderate' : 'poor',
      history: Array.from({ length: 20 }, () => randomQuality()),
    },
    signalMetrics: {
      noiseLevel: Math.random() * 0.5,
      stabilityScore: randomQuality(50, 100),
    },
    heartbeatMetrics: {
      currentBPM: Math.floor(Math.random() * 40) + 60,
      confidence: Math.random() * 0.7 + 0.3,
      arrhythmiaDetected: Math.random() > 0.9,
      signalStrength: randomQuality(60, 100),
      rrIntervalQuality: randomQuality(50, 100),
    },
    calibration: {
      active: randomBoolean(),
      status: Math.random() > 0.7 ? 'calibrated' : Math.random() > 0.4 ? 'calibrating' : 'uncalibrated',
      progress: Math.random() * 100,
      lastCalibrated,
    },
    channels: {
      cardiac: { quality: randomQuality(70, 100), active: true },
      spo2: { quality: randomQuality(60, 100), active: true },
      glucose: { quality: randomQuality(30, 90), active: randomBoolean() },
      lipids: { quality: randomQuality(20, 80), active: randomBoolean() },
      bloodPressure: { quality: randomQuality(60, 90), active: true },
    },
    processingPipeline: {
      framesProcessed: Math.floor(Math.random() * 10000) + 5000,
      framesPerSecond: Math.floor(Math.random() * 20) + 10,
      activeProcessors: [
        'PPGExtractor',
        'HeartbeatDetector',
        'SpO2Calculator',
        ...(randomBoolean() ? ['GlucoseEstimator'] : []),
        ...(randomBoolean() ? ['LipidAnalyzer'] : []),
        'BloodPressureEstimator',
      ],
    },
    signalHistory: {
      raw: Array.from({ length: 100 }, () => Math.sin(Math.random() * Math.PI) * 0.5 + Math.random() * 0.2),
      filtered: Array.from({ length: 100 }, () => Math.sin(Math.random() * Math.PI) * 0.4),
      amplified: Array.from({ length: 100 }, () => Math.sin(Math.random() * Math.PI) * 0.8),
    },
    feedbackSystem: {
      bidirectionalActive: randomBoolean(),
      lastFeedbackTime,
      feedbackQueue: Math.floor(Math.random() * 5),
      adaptations: [
        { component: 'PPGProcessor', timestamp: new Date(now.getTime() - 30000), adaptation: 'Adjusted amplification factor to 1.2' },
        { component: 'FilterChain', timestamp: new Date(now.getTime() - 120000), adaptation: 'Increased filter strength to reduce noise' },
        { component: 'HeartbeatDetector', timestamp: new Date(now.getTime() - 300000), adaptation: 'Optimized threshold for better peak detection' },
      ],
    },
    systemStatus: {
      isMonitoring: randomBoolean(),
      fingerDetected: randomBoolean(),
      batteryLevel: randomQuality(50, 100),
      cpuUsage: randomQuality(10, 50),
      memoryUsage: randomQuality(20, 60),
    },
  };
};

export const useDiagnostics = () => {
  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticsData>(generateMockData());

  const updateDiagnosticsData = useCallback(() => {
    // In a real app, you would fetch actual data from your processing pipeline
    // For demo purposes, we're generating mock data
    setDiagnosticsData(generateMockData());
  }, []);

  return {
    diagnosticsData,
    updateDiagnosticsData,
  };
};
