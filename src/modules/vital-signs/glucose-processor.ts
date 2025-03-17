
/**
 * GlucoseProcessor class
 * Calculates glucose levels directly from PPG signal characteristics
 * with no reliance on synthetic data or reference values
 */
import { GlucoseConfig } from './glucose/GlucoseConfig';
import { GlucoseSignalAnalyzer } from './glucose/GlucoseSignalAnalyzer';
import { GlucoseCalculator } from './glucose/GlucoseCalculator';
import { GlucoseConfidenceCalculator } from './glucose/GlucoseConfidenceCalculator';

export class GlucoseProcessor {
  private confidence: number = 0;
  private previousValues: number[] = [];
  private lastCalculatedGlucose: number = 0;
  private hasQualityData: boolean = false;
  
  /**
   * Initialize the processor
   */
  constructor() {
    this.reset();
  }
  
  /**
   * Calculate glucose based on PPG waveform characteristics
   * Using direct measurement techniques without reference values
   */
  public calculateGlucose(ppgValues: number[]): number {
    if (ppgValues.length < GlucoseConfig.MIN_SAMPLES) {
      this.confidence = 0;
      this.hasQualityData = false;
      console.log("GlucoseProcessor: Insufficient data points", { 
        provided: ppgValues.length, 
        required: GlucoseConfig.MIN_SAMPLES 
      });
      return 0; // Not enough data
    }
    
    // Validate signal quality
    const signalVariability = GlucoseSignalAnalyzer.calculateVariability(ppgValues);
    const signalAmplitude = Math.max(...ppgValues) - Math.min(...ppgValues);
    
    // If signal quality is too poor, return 0
    if (signalAmplitude < 0.05 || signalVariability > 0.8) {
      this.confidence = 0;
      this.hasQualityData = false;
      console.log("GlucoseProcessor: Signal quality too poor", { 
        amplitude: signalAmplitude, 
        variability: signalVariability 
      });
      return 0;
    }
    
    this.hasQualityData = true;
    
    // Use most recent PPG samples for glucose estimation
    const recentValues = ppgValues.slice(-Math.min(150, ppgValues.length));
    
    // Calculate signal metrics with improved analysis
    const { 
      amplitude, 
      frequency, 
      phase, 
      perfusionIndex,
      areaUnderCurve,
      signalVariability: variability
    } = GlucoseSignalAnalyzer.analyzeSignal(recentValues);
    
    // Calculate individual variation factor
    const individualFactor = GlucoseCalculator.calculateIndividualFactor(recentValues);
    
    // Calculate glucose estimate
    const glucoseEstimate = GlucoseCalculator.calculateGlucoseEstimate(
      amplitude,
      frequency,
      phase,
      perfusionIndex,
      areaUnderCurve,
      variability,
      individualFactor
    );
    
    // Update previous values for stability calculation
    this.previousValues.push(glucoseEstimate);
    if (this.previousValues.length > GlucoseConfig.STABILITY_WINDOW) {
      this.previousValues.shift();
    }
    
    // Stabilize readings with temporal smoothing
    const stabilizedGlucose = GlucoseCalculator.stabilizeReading(
      glucoseEstimate, 
      this.previousValues,
      this.lastCalculatedGlucose
    );
    
    // Calculate confidence based on signal quality and stability
    this.confidence = GlucoseConfidenceCalculator.calculateConfidence(
      recentValues,
      perfusionIndex,
      variability,
      this.hasQualityData,
      GlucoseConfig.MIN_SAMPLES,
      GlucoseConfig.SIGNAL_WINDOW_SIZE
    );
    
    // Store this value for future stability calculations
    this.lastCalculatedGlucose = stabilizedGlucose;
    
    console.log("GlucoseProcessor: Calculation details", {
      baseValue: GlucoseConfig.GLUCOSE_BASELINE,
      amplitudeContribution: amplitude * GlucoseConfig.AMPLITUDE_FACTOR * 100,
      frequencyContribution: frequency * GlucoseConfig.FREQUENCY_FACTOR * 150,
      phaseContribution: phase * GlucoseConfig.PHASE_FACTOR * 50,
      aucContribution: areaUnderCurve * GlucoseConfig.AREA_UNDER_CURVE_FACTOR * 35,
      perfusionContribution: (perfusionIndex - 0.5) * GlucoseConfig.PERFUSION_FACTOR * 40,
      variabilityContribution: (variability - 0.5) * 8,
      individualFactor,
      rawEstimate: glucoseEstimate,
      stabilized: stabilizedGlucose,
      confidence: this.confidence
    });
    
    return Math.round(stabilizedGlucose);
  }
  
  /**
   * Get current confidence value
   */
  public getConfidence(): number {
    return this.confidence;
  }
  
  /**
   * Reset all internal state
   */
  public reset(): void {
    this.confidence = 0;
    this.previousValues = [];
    this.lastCalculatedGlucose = 0;
    this.hasQualityData = false;
    console.log("GlucoseProcessor: Reset complete");
  }
}
