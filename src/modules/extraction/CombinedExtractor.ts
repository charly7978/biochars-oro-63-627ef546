/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION...
 * Extractor combinado que integra la extracción de latidos y señal PPG.
 * Versión mejorada con tecnología TensorFlow y procesamiento avanzado.
 * Ahora con sistema de priorización de datos y canal de diagnóstico.
 */
import { HeartbeatExtractor, HeartbeatExtractionResult, createHeartbeatExtractor } from './HeartbeatExtractor';
import { PPGSignalExtractor, PPGSignalExtractionResult, createPPGSignalExtractor } from './PPGSignalExtractor';
import { AdvancedPPGExtractor, AdvancedExtractionResult, createAdvancedPPGExtractor, AdvancedExtractorConfig } from './AdvancedPPGExtractor';

export enum ProcessingPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface DiagnosticsEntry {
  timestamp: number;
  extractorType: 'combined' | 'ppg' | 'heartbeat' | 'advanced';
  processingTime: number;
  inputAmplitude: number;
  priority: ProcessingPriority;
  memoryUsage?: number;
  queueLength?: number;
}

export interface CombinedExtractionResult {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  amplitude: number;
  baseline: number;
  hasPeak: boolean;
  peakTime: number | null;
  peakValue: number | null;
  confidence: number;
  instantaneousBPM: number | null;
  rrInterval: number | null;
  averageBPM: number | null;
  heartRateVariability: number | null;
  priority: ProcessingPriority;
}

export interface CombinedExtractorOptions {
  useAdvancedExtractor: boolean;
  advancedConfig?: Partial<AdvancedExtractorConfig>;
  enableDiagnostics?: boolean;
  prioritizationThresholds?: {
    highPriorityConfidence: number;
    mediumPriorityConfidence: number;
  };
}

export class CombinedExtractor {
  private ppgExtractor: PPGSignalExtractor;
  private heartbeatExtractor: HeartbeatExtractor;
  private advancedExtractor: AdvancedPPGExtractor | null = null;
  private useAdvanced: boolean;
  private diagnosticsBuffer: DiagnosticsEntry[] = [];
  private readonly maxDiagnosticsEntries: number = 100;
  private enableDiagnostics: boolean;
  private highPriorityConfidence: number;
  private mediumPriorityConfidence: number;
  
  constructor(options?: CombinedExtractorOptions) {
    this.useAdvanced = options?.useAdvancedExtractor !== false;
    this.enableDiagnostics = options?.enableDiagnostics !== false;
    this.highPriorityConfidence = options?.prioritizationThresholds?.highPriorityConfidence || 0.7;
    this.mediumPriorityConfidence = options?.prioritizationThresholds?.mediumPriorityConfidence || 0.4;
    this.ppgExtractor = createPPGSignalExtractor();
    this.heartbeatExtractor = createHeartbeatExtractor();
    if (this.useAdvanced) {
      console.log("CombinedExtractor: Creating advanced extractor with TensorFlow");
      this.advancedExtractor = createAdvancedPPGExtractor(options?.advancedConfig);
    }
    console.log(`CombinedExtractor initialized. Using advanced extractor: ${this.useAdvanced}`);
    console.log(`Diagnostics enabled: ${this.enableDiagnostics}`);
    console.log(`Prioritization thresholds - High: ${this.highPriorityConfidence}, Medium: ${this.mediumPriorityConfidence}`);
  }
  
  private determinePriority(confidence: number, amplitude: number): ProcessingPriority {
    if (confidence >= this.highPriorityConfidence) return ProcessingPriority.HIGH;
    else if (confidence >= this.mediumPriorityConfidence) return ProcessingPriority.MEDIUM;
    if (amplitude > 0.3) return ProcessingPriority.MEDIUM;
    return ProcessingPriority.LOW;
  }
  
  private logDiagnostics(entry: DiagnosticsEntry): void {
    if (!this.enableDiagnostics) return;
    this.diagnosticsBuffer.push(entry);
    if (this.diagnosticsBuffer.length > this.maxDiagnosticsEntries) this.diagnosticsBuffer.shift();
  }
  
  public processValue(value: number): CombinedExtractionResult {
    const startTime = performance.now();
    if (this.useAdvanced && this.advancedExtractor) {
      const result = this.advancedExtractor.processValue(value);
      const priority = this.determinePriority(result.confidence, result.amplitude);
      if (this.enableDiagnostics) {
        this.logDiagnostics({
          timestamp: Date.now(),
          extractorType: 'advanced',
          processingTime: performance.now() - startTime,
          inputAmplitude: Math.abs(value),
          priority,
          memoryUsage: this.estimateMemoryUsage()
        });
      }
      return { ...result, priority };
    }
    
    const ppgStartTime = performance.now();
    const ppgResult = this.ppgExtractor.processValue(value);
    const ppgProcessingTime = performance.now() - ppgStartTime;
    
    const heartbeatStartTime = performance.now();
    const heartbeatResult = this.heartbeatExtractor.processValue(ppgResult.filteredValue);
    const heartbeatProcessingTime = performance.now() - heartbeatStartTime;
    
    const priority = this.determinePriority(heartbeatResult.confidence, ppgResult.amplitude);
    
    if (this.enableDiagnostics) {
      this.logDiagnostics({
        timestamp: Date.now(),
        extractorType: 'ppg',
        processingTime: ppgProcessingTime,
        inputAmplitude: Math.abs(value),
        priority
      });
      this.logDiagnostics({
        timestamp: Date.now(),
        extractorType: 'heartbeat',
        processingTime: heartbeatProcessingTime,
        inputAmplitude: Math.abs(ppgResult.filteredValue),
        priority
      });
      this.logDiagnostics({
        timestamp: Date.now(),
        extractorType: 'combined',
        processingTime: performance.now() - startTime,
        inputAmplitude: Math.abs(value),
        priority,
        memoryUsage: this.estimateMemoryUsage(),
        queueLength: this.diagnosticsBuffer.length
      });
    }
    
    return {
      timestamp: ppgResult.timestamp,
      rawValue: ppgResult.rawValue,
      filteredValue: ppgResult.filteredValue,
      quality: ppgResult.quality,
      fingerDetected: ppgResult.fingerDetected,
      amplitude: ppgResult.amplitude,
      baseline: ppgResult.baseline,
      hasPeak: heartbeatResult.hasPeak,
      peakTime: heartbeatResult.peakTime,
      peakValue: heartbeatResult.hasPeak ? heartbeatResult.peakValue : null,
      confidence: heartbeatResult.confidence,
      instantaneousBPM: heartbeatResult.instantaneousBPM,
      rrInterval: heartbeatResult.rrInterval,
      averageBPM: this.heartbeatExtractor.getAverageBPM(),
      heartRateVariability: this.heartbeatExtractor.getHeartRateVariability(),
      priority
    };
  }
  
  private estimateMemoryUsage(): number {
    return this.diagnosticsBuffer.length * 200;
  }
  
  public getDiagnosticsData(): DiagnosticsEntry[] {
    return [...this.diagnosticsBuffer];
  }
  
  public clearDiagnostics(): void {
    this.diagnosticsBuffer = [];
  }
  
  public reset(): void {
    this.ppgExtractor.reset();
    this.heartbeatExtractor.reset();
    if (this.advancedExtractor) this.advancedExtractor.reset();
    this.clearDiagnostics();
    console.log("CombinedExtractor: All extractors reset");
  }
}

export const createCombinedExtractor = (options?: CombinedExtractorOptions): CombinedExtractor => {
  return new CombinedExtractor(options);
};

export const extractCombinedData = (
  value: number,
  extractor: CombinedExtractor
): CombinedExtractionResult => {
  return extractor.processValue(value);
};
