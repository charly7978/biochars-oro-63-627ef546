
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Modular Vital Signs Processor implementation
 */

import { 
  OptimizedSignalDistributor, 
  SignalDistributorConfig,
  VitalSignType,
  CardiacChannel,
  SpO2Channel,
  BloodPressureChannel,
  GlucoseChannel,
  LipidsChannel
} from '../signal-processing';

// Type for processed signal
interface ProcessedSignal {
  value: number;
  timestamp: number;
  quality?: number;
}

// Results interface
export interface ModularVitalSignsResult {
  timestamp: number;
  heartRate: number;
  spo2: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  quality: number;
  isPeak?: boolean;
  rrInterval?: number | null;
}

/**
 * Modular Vital Signs Processor
 * Distributes signal processing across specialized channels
 */
export class ModularVitalSignsProcessor {
  private distributor: OptimizedSignalDistributor;
  private lastResults: Map<VitalSignType, any> = new Map();
  private lastProcessedTime: number = 0;
  private isInitialized: boolean = false;
  
  constructor() {
    console.log("ModularVitalSignsProcessor: Creating new instance");
    this.distributor = new OptimizedSignalDistributor();
    this.isInitialized = false;
  }
  
  /**
   * Initialize the processor
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log("ModularVitalSignsProcessor: Already initialized");
      return;
    }
    
    console.log("ModularVitalSignsProcessor: Initializing");
    
    // Create and register channels
    const cardiacChannel = new CardiacChannel();
    const spo2Channel = new SpO2Channel();
    const bpChannel = new BloodPressureChannel();
    const glucoseChannel = new GlucoseChannel();
    const lipidsChannel = new LipidsChannel();
    
    // Register all channels
    this.distributor.registerChannel(cardiacChannel);
    this.distributor.registerChannel(spo2Channel);
    this.distributor.registerChannel(bpChannel);
    this.distributor.registerChannel(glucoseChannel);
    this.distributor.registerChannel(lipidsChannel);
    
    // Configure distributor
    const config: SignalDistributorConfig = {
      channels: {
        [VitalSignType.CARDIAC]: { enabled: true, adaptationRate: 0.3 },
        [VitalSignType.SPO2]: { enabled: true, adaptationRate: 0.4 },
        [VitalSignType.BLOOD_PRESSURE]: { enabled: true, adaptationRate: 0.2 },
        [VitalSignType.GLUCOSE]: { enabled: true, adaptationRate: 0.1 },
        [VitalSignType.LIPIDS]: { enabled: true, adaptationRate: 0.1 }
      },
      globalAdaptationRate: 0.3,
      calibrationMode: false,
      enableFeedback: true
    };
    
    this.distributor.configure(config);
    this.isInitialized = true;
    
    console.log("ModularVitalSignsProcessor: Initialization complete");
  }
  
  /**
   * Process a signal value
   */
  processSignal(signal: ProcessedSignal): ModularVitalSignsResult {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    const now = Date.now();
    this.lastProcessedTime = now;
    
    // Process signal through distributor
    const result = this.distributor.processSignal(signal.value);
    
    // Store channel results
    if (result.channelResults) {
      for (const [type, channelResult] of result.channelResults.entries()) {
        this.lastResults.set(type, channelResult);
      }
    }
    
    // Assemble final result
    const cardiacResult = this.lastResults.get(VitalSignType.CARDIAC) || { bpm: 0, isPeak: false };
    const spo2Result = this.lastResults.get(VitalSignType.SPO2) || 0;
    const bpResult = this.lastResults.get(VitalSignType.BLOOD_PRESSURE) || { systolic: 0, diastolic: 0 };
    const glucoseResult = this.lastResults.get(VitalSignType.GLUCOSE) || 0;
    const lipidsResult = this.lastResults.get(VitalSignType.LIPIDS) || { totalCholesterol: 0, triglycerides: 0 };
    
    // Calculate overall quality
    const quality = result.diagnostics ? result.diagnostics.quality : 0;
    
    return {
      timestamp: now,
      heartRate: cardiacResult.bpm || 0,
      spo2: typeof spo2Result === 'number' ? spo2Result : 0,
      bloodPressure: {
        systolic: bpResult.systolic || 0,
        diastolic: bpResult.diastolic || 0
      },
      glucose: glucoseResult || 0,
      lipids: {
        totalCholesterol: lipidsResult.totalCholesterol || 0,
        triglycerides: lipidsResult.triglycerides || 0
      },
      quality,
      isPeak: cardiacResult.isPeak || false,
      rrInterval: cardiacResult.rrInterval || null
    };
  }
  
  /**
   * Reset the processor
   */
  reset(): void {
    console.log("ModularVitalSignsProcessor: Resetting");
    
    if (this.distributor) {
      this.distributor.reset();
    }
    
    this.lastResults.clear();
    this.lastProcessedTime = 0;
  }
  
  /**
   * Get last results for a specific vital sign type
   */
  getLastResult(type: VitalSignType): any {
    return this.lastResults.get(type) || null;
  }
  
  /**
   * Get specific cardiac metrics
   */
  getHeartRate(): number {
    const cardiacResult = this.lastResults.get(VitalSignType.CARDIAC);
    return cardiacResult ? cardiacResult.bpm || 0 : 0;
  }
  
  /**
   * Get specific SpO2 value
   */
  getSpO2(): number {
    const spo2Result = this.lastResults.get(VitalSignType.SPO2);
    return typeof spo2Result === 'number' ? spo2Result : 0;
  }
  
  /**
   * Get specific blood pressure values
   */
  getBloodPressure(): { systolic: number; diastolic: number } {
    const bpResult = this.lastResults.get(VitalSignType.BLOOD_PRESSURE);
    return bpResult || { systolic: 0, diastolic: 0 };
  }
  
  /**
   * Get specific glucose value
   */
  getGlucose(): number {
    return this.lastResults.get(VitalSignType.GLUCOSE) || 0;
  }
  
  /**
   * Get specific lipids values
   */
  getLipids(): { totalCholesterol: number; triglycerides: number } {
    return this.lastResults.get(VitalSignType.LIPIDS) || { totalCholesterol: 0, triglycerides: 0 };
  }
}
