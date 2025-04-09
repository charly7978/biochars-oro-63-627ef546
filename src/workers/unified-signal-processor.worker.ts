
/**
 * Unified Signal Processor Web Worker
 * Handles signal processing, TensorFlow.js operations, and calibration
 * offloaded from the main thread
 */

import * as tf from '@tensorflow/tfjs';
import { ProcessorConfig } from '../core/config/ProcessorConfig';
import { TensorFlowService } from '../core/ml/tensorflow-service';
import { NeuralNetworkProcessor } from '../core/ml/neural-network-processor';
import { FilterPipeline } from '../core/signal/filter-pipeline';

// Import types for worker messages
interface WorkerRequest {
  type: 'INITIALIZE' | 'PROCESS_SIGNAL' | 'PROCESS_FRAME' | 'RESET' | 'CALIBRATE' | 'UPDATE_CONFIG';
  payload?: any;
  config?: Partial<ProcessorConfig>;
}

interface WorkerResponse {
  type: 'INITIALIZED' | 'SIGNAL_PROCESSED' | 'FRAME_PROCESSED' | 'ERROR' | 'CALIBRATION_COMPLETE' | 'RESET_COMPLETE' | 'CONFIG_UPDATED';
  payload?: any;
  error?: string;
  processingTime?: number;
}

// Default configuration
const DEFAULT_CONFIG: ProcessorConfig = {
  useWebGPU: true,
  bufferSize: 300,
  sampleRate: 30,
  filterSettings: {
    useLowPass: true,
    useHighPass: false,
    lowPassCutoff: 8,
    highPassCutoff: 0.5
  },
  neuralNetworks: {
    heartRateModelUrl: '/models/heart-rate-model/model.json',
    spo2ModelUrl: '/models/spo2-model/model.json',
    bloodPressureModelUrl: '/models/blood-pressure-model/model.json',
    arrhythmiaModelUrl: '/models/arrhythmia-model/model.json',
    glucoseModelUrl: '/models/glucose-model/model.json'
  },
  calibration: {
    requiredSamples: 100,
    durationMs: 10000
  }
};

// Core processing components
let config: ProcessorConfig = { ...DEFAULT_CONFIG };
let tfService: TensorFlowService;
let nnProcessor: NeuralNetworkProcessor;
let filterPipeline: FilterPipeline;
let isInitialized = false;
let signalBuffer: number[] = [];
let lastProcessedValue = 0;
let isCalibrating = false;
let calibrationSamples = 0;
let calibrationStartTime = 0;

/**
 * Initialize the worker with provided configuration
 */
async function initialize(workerConfig?: Partial<ProcessorConfig>): Promise<boolean> {
  try {
    // Merge configurations
    if (workerConfig) {
      config = { ...config, ...workerConfig };
    }
    
    console.log('[Worker] Initializing with configuration:', config);
    
    // Initialize TensorFlow
    tfService = new TensorFlowService(config);
    await tfService.initialize();
    
    // Initialize neural network processor
    nnProcessor = new NeuralNetworkProcessor(tfService, config);
    await nnProcessor.initialize();
    
    // Initialize filter pipeline
    filterPipeline = new FilterPipeline(config.filterSettings);
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[Worker] Initialization error:', error);
    return false;
  }
}

/**
 * Process a single PPG signal value
 */
async function processSignal(value: number): Promise<any> {
  try {
    const startTime = performance.now();
    
    // Apply filtering
    const filtered = filterPipeline.process(value);
    
    // Add to buffer
    signalBuffer.push(filtered);
    if (signalBuffer.length > config.bufferSize) {
      signalBuffer.shift();
    }
    
    // Update neural network buffers
    nnProcessor.updateSignalBuffer('heartRate', filtered);
    nnProcessor.updateSignalBuffer('spo2', filtered);
    nnProcessor.updateSignalBuffer('bloodPressure', filtered);
    nnProcessor.updateSignalBuffer('arrhythmia', filtered);
    
    // Process vital signs
    const heartRatePromise = nnProcessor.processSignal('heartRate', filtered);
    const spo2Promise = nnProcessor.processSignal('spo2', filtered);
    const bpPromise = nnProcessor.processSignal('bloodPressure', filtered);
    const arrhythmiaPromise = nnProcessor.processSignal('arrhythmia', filtered);
    
    // Wait for all processing to complete
    const [heartRate, spo2, bloodPressure, arrhythmia] = await Promise.all([
      heartRatePromise,
      spo2Promise,
      bpPromise,
      arrhythmiaPromise
    ]);
    
    // Check for calibration status
    if (isCalibrating) {
      updateCalibration();
    }
    
    const processingTime = performance.now() - startTime;
    
    // Return processed results
    return {
      filtered,
      heartRate: heartRate ? {
        bpm: Math.round(heartRate[0]),
        confidence: heartRate[1]
      } : null,
      spo2: spo2 ? Math.round(spo2[0]) : null,
      bloodPressure: bloodPressure ? {
        systolic: Math.round(bloodPressure[0]),
        diastolic: Math.round(bloodPressure[1])
      } : null,
      arrhythmia: arrhythmia ? arrhythmia[0] > 0.5 : false,
      calibration: isCalibrating ? {
        isCalibrating: true,
        progress: Math.min(100, (calibrationSamples / config.calibration.requiredSamples) * 100),
        remainingTime: Math.max(0, (config.calibration.durationMs - (Date.now() - calibrationStartTime)) / 1000)
      } : null,
      processingTime
    };
  } catch (error) {
    console.error('[Worker] Signal processing error:', error);
    throw error;
  }
}

/**
 * Update calibration status
 */
function updateCalibration(): void {
  calibrationSamples++;
  const now = Date.now();
  
  // Check if calibration should complete
  if (calibrationSamples >= config.calibration.requiredSamples || 
      now - calibrationStartTime >= config.calibration.durationMs) {
    completeCalibration();
  }
}

/**
 * Start calibration process
 */
function startCalibration(): void {
  console.log('[Worker] Starting calibration');
  isCalibrating = true;
  calibrationSamples = 0;
  calibrationStartTime = Date.now();
}

/**
 * Complete calibration process
 */
function completeCalibration(): void {
  console.log('[Worker] Calibration complete');
  isCalibrating = false;
}

/**
 * Reset the processor state
 */
function reset(): void {
  console.log('[Worker] Resetting processor');
  signalBuffer = [];
  lastProcessedValue = 0;
  isCalibrating = false;
  calibrationSamples = 0;
  
  if (nnProcessor) {
    nnProcessor.reset();
  }
  
  if (filterPipeline) {
    filterPipeline.reset();
  }
}

/**
 * Process an image frame for PPG extraction
 */
async function processFrame(imageData: ImageData): Promise<any> {
  try {
    // Extract PPG signal from frame
    // This is a simplified implementation
    let redSum = 0;
    let pixelCount = 0;
    
    // Process the raw pixel data
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Extract red channel (index 0)
      const red = imageData.data[i];
      redSum += red;
      pixelCount++;
    }
    
    // Calculate average red value (simple PPG value)
    const ppgValue = redSum / pixelCount / 255;
    
    // Process the extracted PPG value
    return await processSignal(ppgValue);
  } catch (error) {
    console.error('[Worker] Frame processing error:', error);
    throw error;
  }
}

// Register message handler for worker
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const { type, payload, config: requestConfig } = event.data;
    
    switch (type) {
      case 'INITIALIZE':
        const success = await initialize(requestConfig);
        postMessage({
          type: 'INITIALIZED',
          payload: { success }
        } as WorkerResponse);
        break;
        
      case 'PROCESS_SIGNAL':
        if (!isInitialized) {
          await initialize();
        }
        
        if (typeof payload === 'number') {
          const result = await processSignal(payload);
          postMessage({
            type: 'SIGNAL_PROCESSED',
            payload: result,
            processingTime: result.processingTime
          } as WorkerResponse);
        }
        break;
        
      case 'PROCESS_FRAME':
        if (!isInitialized) {
          await initialize();
        }
        
        if (payload && payload.data) {
          const result = await processFrame(payload);
          postMessage({
            type: 'FRAME_PROCESSED',
            payload: result,
            processingTime: result.processingTime
          } as WorkerResponse);
        }
        break;
        
      case 'CALIBRATE':
        if (!isInitialized) {
          await initialize();
        }
        
        startCalibration();
        postMessage({
          type: 'CALIBRATION_COMPLETE',
          payload: { started: true }
        } as WorkerResponse);
        break;
        
      case 'RESET':
        reset();
        postMessage({
          type: 'RESET_COMPLETE'
        } as WorkerResponse);
        break;
        
      case 'UPDATE_CONFIG':
        if (requestConfig) {
          config = { ...config, ...requestConfig };
          
          // Update components with new config
          if (filterPipeline) {
            filterPipeline.updateConfig(config.filterSettings);
          }
          
          postMessage({
            type: 'CONFIG_UPDATED',
            payload: { success: true }
          } as WorkerResponse);
        }
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    } as WorkerResponse);
  }
};

// Notify that worker is initialized
postMessage({
  type: 'INITIALIZED',
  payload: { workerStarted: true }
} as WorkerResponse);
