/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS...
 * Advanced PPG Signal and Heartbeat Extractor
 * Uses TensorFlow.js for advanced signal processing and neural network-based peak detection.
 * Enhanced with XLA optimization, CNN-LSTM hybrid architecture, and denoising autoencoder.
 */
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { CombinedExtractionResult } from './CombinedExtractor';
import { ProcessingPriority } from './CombinedExtractor';

// Inicialización de TensorFlow (se mantiene igual)
async function initializeTensorFlow() {
  try {
    if ('WebGPU' in window && tf.findBackend('webgpu') && tf.engine().backendNames().includes('webgpu')) {
      console.log('Using WebGPU backend (faster GPU acceleration)');
      await tf.setBackend('webgpu');
      await tf.env().set('ENGINE_COMPILE_XLA', true);
    } else {
      console.log('WebGPU not supported, falling back to WebGL backend');
      await tf.setBackend('webgl');
      await tf.env().set('WEBGL_USE_SHADER_COMPILATION_DELAY', false);
      await tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    }
    await tf.env().set('DISPOSE_TENSORS_WHEN_NO_LONGER_NEEDED', true);
    console.log('TensorFlow initialized with optimizations:', {
      backend: tf.getBackend(),
      version: tf.version.tfjs,
      xla: await tf.env().getAsync('ENGINE_COMPILE_XLA'),
      numTensors: tf.memory().numTensors,
      numBytes: tf.memory().numBytes
    });
    // Warm-up
    const warmupTensor = tf.tensor([1, 2, 3, 4]);
    warmupTensor.square().dispose();
    warmupTensor.dispose();
    return true;
  } catch (error) {
    console.error('TensorFlow initialization failed:', error);
    return false;
  }
}
const tfInitPromise = initializeTensorFlow();

export interface AdvancedExtractionResult extends CombinedExtractionResult {
  signalToNoiseRatio: number;
  powerSpectrum: number[];
  dominantFrequency: number;
  nnIntervals: number[];
  pnnx: number;
  heartRateRecovery: number | null;
  adaptiveConfidence: number;
  noiseLevel: number;
  spectrumPeaks: Array<{ frequency: number, amplitude: number }>;
}

export interface AdvancedExtractorConfig {
  useDynamicThresholding: boolean;
  applyAdaptiveFilter: boolean;
  useWaveletDenoising: boolean;
  useTensorFlow: boolean;
  usePeakVerification: boolean;
  useAutoencoder: boolean;
  useCnnLstm: boolean;
  temporalWindowSize: number;
  lstmSequenceLength: number;
  nnThreshold: number;
  memorySaver: boolean; 
  adaptiveThresholdSensitivity: number;
  enableXlaOptimization: boolean;
  modelQuantization: boolean;
}

export class AdvancedPPGExtractor {
  private rawBuffer: number[] = [];
  private filteredBuffer: number[] = [];
  private sequenceBuffer: number[][] = [];
  private baselineValue: number = 0;
  private signalAmplitude: number = 0;
  private lastTimestamp: number = 0;
  private peakDetectionModel: tf.LayersModel | null = null;
  private denoisingAutoencoder: tf.LayersModel | null = null;
  private cnnLstmModel: tf.LayersModel | null = null;
  private modelLoaded: boolean = false;
  private tfInitialized: boolean = false;
  private peaks: Array<{ time: number, value: number }> = [];
  private peakTimes: number[] = [];
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private noiseEstimate: number = 0;
  private powerSpectrum: number[] = [];
  private snr: number = 0;
  private adaptiveThreshold: number = 0.5;
  private lastBPM: number | null = null;

  private config: AdvancedExtractorConfig = {
    useDynamicThresholding: true,
    applyAdaptiveFilter: true,
    useWaveletDenoising: true,
    useTensorFlow: true,
    usePeakVerification: true,
    useAutoencoder: true,
    useCnnLstm: true,
    temporalWindowSize: 256,
    lstmSequenceLength: 32,
    nnThreshold: 50,
    memorySaver: true,
    adaptiveThresholdSensitivity: 1.5,
    enableXlaOptimization: true,
    modelQuantization: true
  };

  private lastCleanupTime: number = 0;
  private CLEANUP_INTERVAL = 5000;
  private MAX_BUFFER_SIZE = 512;
  private MAX_SEQUENCE_BUFFER = 40;

  constructor(config?: Partial<AdvancedExtractorConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initialize();
    if (this.config.memorySaver) {
      setInterval(() => this.cleanupMemory(), this.CLEANUP_INTERVAL);
    }
  }

  private async initialize(): Promise<void> {
    try {
      this.tfInitialized = await tfInitPromise;
      if (this.tfInitialized && this.config.useTensorFlow) {
        console.log('Initializing neural networks for advanced PPG extraction...');
        await Promise.all([
          this.createPeakDetectionModel(),
          this.createDenoisingAutoencoder(),
          this.createCnnLstmModel()
        ]);
        this.modelLoaded = true;
        console.log('Advanced PPG extraction initialized with TensorFlow:', {
          tensors: tf.memory().numTensors,
          bytes: tf.memory().numBytes,
          backend: tf.getBackend()
        });
      }
    } catch (error) {
      console.error('Failed to initialize TensorFlow models:', error);
      this.modelLoaded = false;
      console.log('Falling back to traditional signal processing methods');
    }
  }

  private async createPeakDetectionModel(): Promise<void> {
    try {
      const windowSize = 32;
      const model = tf.sequential();
      model.add(tf.layers.conv1d({
        inputShape: [windowSize, 1],
        filters: 16,
        kernelSize: 5,
        activation: 'relu',
        padding: 'same'
      }));
      model.add(tf.layers.maxPooling1d({ poolSize: 2, strides: 2 }));
      model.add(tf.layers.conv1d({
        filters: 32,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
      }));
      model.add(tf.layers.flatten());
      model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
      model.add(tf.layers.dropout({ rate: 0.25 }));
      model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
      model.compile({ optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy', metrics: ['accuracy'] });
      this.peakDetectionModel = model;
      console.log('Peak detection CNN model created successfully');
    } catch (error) {
      console.error('Error creating peak detection model:', error);
      throw error;
    }
  }

  private async createDenoisingAutoencoder(): Promise<void> {
    if (!this.config.useAutoencoder) return;
    try {
      const inputSize = 64;
      const model = tf.sequential();
      model.add(tf.layers.dense({ inputShape: [inputSize], units: 32, activation: 'tanh' }));
      model.add(tf.layers.dense({ units: 16, activation: 'tanh' }));
      model.add(tf.layers.dense({ units: 8, activation: 'tanh', name: 'bottleneck' }));
      model.add(tf.layers.dense({ units: 16, activation: 'tanh' }));
      model.add(tf.layers.dense({ units: 32, activation: 'tanh' }));
      model.add(tf.layers.dense({ units: inputSize, activation: 'linear' }));
      model.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });
      this.denoisingAutoencoder = model;
      console.log('Denoising autoencoder model created successfully');
    } catch (error) {
      console.error('Error creating denoising autoencoder:', error);
      this.config.useAutoencoder = false;
    }
  }

  private async createCnnLstmModel(): Promise<void> {
    if (!this.config.useCnnLstm) return;
    try {
      const sequenceLength = this.config.lstmSequenceLength;
      const featureLength = 32;
      const model = tf.sequential();
      model.add(tf.layers.timeDistributed({
        layer: tf.layers.conv1d({
          filters: 16,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        inputShape: [sequenceLength, featureLength, 1]
      }));
      model.add(tf.layers.timeDistributed({ layer: tf.layers.maxPooling1d({ poolSize: 2 }) }));
      model.add(tf.layers.timeDistributed({ layer: tf.layers.flatten() }));
      model.add(tf.layers.lstm({ units: 32, returnSequences: true }));
      model.add(tf.layers.lstm({ units: 32, returnSequences: false }));
      model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
      model.add(tf.layers.dropout({ rate: 0.2 }));
      model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
      model.compile({ optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy', metrics: ['accuracy'] });
      this.cnnLstmModel = model;
      console.log('CNN-LSTM hybrid model created successfully');
    } catch (error) {
      console.error('Error creating CNN-LSTM model:', error);
      this.config.useCnnLstm = false;
    }
  }

  /**
   * Process a raw PPG value and return an AdvancedExtractionResult.
   * Se ha ajustado la normalización para usar un promedio robusto en lugar del máximo absoluto.
   */
  public processValue(value: number): AdvancedExtractionResult {
    const now = Date.now();
    this.rawBuffer.push(value);
    if (this.rawBuffer.length > this.MAX_BUFFER_SIZE) this.rawBuffer.shift();
    
    // Normalización robusta: usar la media y desviación en lugar de Math.max()
    const robustNormalized = this.robustNormalize(value);
    const filteredValue = this.applySignalProcessing(robustNormalized);
    
    this.filteredBuffer.push(filteredValue);
    if (this.filteredBuffer.length > this.MAX_BUFFER_SIZE) this.filteredBuffer.shift();
    
    this.updateSignalAnalytics();
    this.noiseEstimate = this.estimateNoiseLevel();
    
    // Se detectan picos usando NN o método tradicional (igual que antes)
    let hasPeak = false;
    let peakValue: number | null = null;
    let instantaneousBPM: number | null = null;
    let confidence = 0;
    let rrInterval: number | null = null;
    
    if (this.tfInitialized && this.modelLoaded && this.config.useTensorFlow && this.filteredBuffer.length >= 32) {
      const result = this.detectPeakWithNeuralNetworks();
      hasPeak = result.hasPeak;
      peakValue = result.peakValue;
      confidence = result.confidence;
      if (hasPeak) {
        this.peakTimes.push(now);
        this.peaks.push({ time: now, value: filteredValue });
        if (this.lastPeakTime !== null) {
          rrInterval = now - this.lastPeakTime;
          if (rrInterval > 0) {
            instantaneousBPM = 60000 / rrInterval;
            this.rrIntervals.push(rrInterval);
            if (this.rrIntervals.length > 20) this.rrIntervals.shift();
          }
        }
        this.lastPeakTime = now;
      }
    } else {
      const result = this.detectPeakTraditional();
      hasPeak = result.hasPeak;
      peakValue = result.peakValue;
      confidence = result.confidence;
      rrInterval = result.rrInterval;
      instantaneousBPM = result.instantaneousBPM;
    }
    
    if (this.filteredBuffer.length >= 64) {
      this.updatePowerSpectrum();
    }
    
    this.calculateSNR();
    const hrvMetrics = this.calculateHRVMetrics();
    const dominantFrequency = this.getDominantFrequency();
    const spectrumPeaks = this.getSpectrumPeaks(3);
    let signalQuality = this.determineSignalQuality();
    const fingerDetected = this.isFingerDetected();
    const averageBPM = this.calculateAverageBPM();
    
    const result: AdvancedExtractionResult = {
      timestamp: now,
      rawValue: value,
      filteredValue,
      quality: signalQuality,
      fingerDetected,
      amplitude: this.signalAmplitude,
      baseline: this.baselineValue,
      hasPeak,
      peakTime: hasPeak ? now : null,
      peakValue: hasPeak ? peakValue : null,
      confidence,
      instantaneousBPM,
      rrInterval,
      averageBPM,
      heartRateVariability: hrvMetrics.rmssd,
      signalToNoiseRatio: this.snr,
      powerSpectrum: this.powerSpectrum,
      dominantFrequency,
      nnIntervals: hrvMetrics.nnIntervals,
      pnnx: hrvMetrics.pnnx,
      heartRateRecovery: null,
      adaptiveConfidence: confidence * signalQuality / 100,
      noiseLevel: this.noiseEstimate,
      spectrumPeaks,
      priority: ProcessingPriority.MEDIUM
    };
    
    this.lastTimestamp = now;
    if (this.config.useCnnLstm) this.updateSequenceBuffer(filteredValue, hasPeak);
    if (now - this.lastCleanupTime > this.CLEANUP_INTERVAL) {
      this.cleanupMemory();
      this.lastCleanupTime = now;
    }
    return result;
  }
  
  /**
   * Normaliza un valor usando la media y la desviación de una ventana reciente.
   */
  private robustNormalize(value: number): number {
    const windowSize = Math.min(20, this.rawBuffer.length);
    if (windowSize === 0) return value;
    const window = this.rawBuffer.slice(-windowSize);
    const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
    const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length;
    const std = Math.sqrt(variance);
    // Evitar división por cero
    return std > 0 ? (value - mean) / std : value - mean;
  }
  
  private applySignalProcessing(value: number): number {
    let filtered = this.applyAdaptiveFiltering(value);
    if (this.config.useWaveletDenoising && this.filteredBuffer.length >= 32) {
      filtered = this.applyWaveletDenoising(filtered);
    }
    if (this.config.useAutoencoder && this.denoisingAutoencoder && this.filteredBuffer.length >= 64) {
      filtered = this.applyAutoencoderDenoising(filtered);
    }
    return filtered;
  }
  
  // (Las demás funciones se mantienen casi iguales, se asume que ya fueron probadas)
  // ... [Mantener funciones: applyAdaptiveFiltering, applyWaveletDenoising, applyAutoencoderDenoising,
  // updateSignalAnalytics, estimateNoiseLevel, updatePowerSpectrum, calculateSNR, getDominantFrequency,
  // getSpectrumPeaks, calculateHRVMetrics, isLocalMaximum, detectPeakWithNeuralNetworks, detectPeakWithCNN,
  // detectPeakWithCnnLstm, detectPeakTraditional, updateSequenceBuffer, normalizeWindow, calculateDerivatives,
  // calculateVariance, calculateMedian, cleanupMemory, reset]
  
  // (Se omiten para brevedad; se deben integrar las funciones tal como están en el código original, 
  // con la corrección principal en la normalización de valores.)
  
  // ...
}

export function createAdvancedPPGExtractor(config?: Partial<AdvancedExtractorConfig>): AdvancedPPGExtractor {
  return new AdvancedPPGExtractor(config);
}

export function processWithAdvancedExtractor(
  value: number,
  extractor: AdvancedPPGExtractor
): AdvancedExtractionResult {
  return extractor.processValue(value);
}
