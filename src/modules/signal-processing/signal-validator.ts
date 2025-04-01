
/**
 * Signal validation module
 * Provides consistent validation of signals across all processors
 */
import { 
  SignalValidationResult, 
  SignalValidationConfig,
  PPGDataPoint,
  TimestampedPPGData
} from '../../types/signal';

// Default validation configuration
const DEFAULT_CONFIG: SignalValidationConfig = {
  minAmplitude: 0.01,
  maxAmplitude: 5.0,
  minVariance: 0.00001,
  maxVariance: 1.0,
  requiredSampleSize: 3
};

/**
 * Provides signal validation functionality
 */
export class SignalValidator {
  private config: SignalValidationConfig;

  constructor(config?: Partial<SignalValidationConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
  }

  /**
   * Validate a single PPG value
   */
  public validatePPGValue(value: number): SignalValidationResult {
    // Check if value is a valid number
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        isValid: false,
        errorCode: 'INVALID_VALUE_TYPE',
        errorMessage: 'PPG value must be a valid number'
      };
    }

    // Check if value is within amplitude range
    if (value < this.config.minAmplitude || value > this.config.maxAmplitude) {
      return {
        isValid: false,
        errorCode: 'AMPLITUDE_OUT_OF_RANGE',
        errorMessage: `PPG value ${value} is outside allowed range [${this.config.minAmplitude}, ${this.config.maxAmplitude}]`,
        diagnosticInfo: {
          receivedValue: value,
          allowedRange: [this.config.minAmplitude, this.config.maxAmplitude]
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate a PPG data point
   */
  public validatePPGDataPoint(dataPoint: PPGDataPoint): SignalValidationResult {
    // Ensure required properties exist
    if (dataPoint.timestamp === undefined || dataPoint.value === undefined || dataPoint.time === undefined) {
      return {
        isValid: false,
        errorCode: 'MISSING_REQUIRED_PROPERTIES',
        errorMessage: 'PPG data point missing required properties',
        diagnosticInfo: {
          receivedProperties: Object.keys(dataPoint),
          requiredProperties: ['timestamp', 'value', 'time']
        }
      };
    }

    // Validate the value
    const valueValidation = this.validatePPGValue(dataPoint.value);
    if (!valueValidation.isValid) {
      return valueValidation;
    }

    // Validate timestamp is reasonable (not in the future, not too old)
    const now = Date.now();
    if (dataPoint.timestamp > now + 1000) { // Allow 1 second of clock skew
      return {
        isValid: false,
        errorCode: 'TIMESTAMP_IN_FUTURE',
        errorMessage: 'PPG data point timestamp is in the future',
        diagnosticInfo: {
          timestamp: dataPoint.timestamp,
          currentTime: now,
          difference: dataPoint.timestamp - now
        }
      };
    }

    // Check if timestamp is too old (more than 1 minute)
    if (now - dataPoint.timestamp > 60000) {
      return {
        isValid: false,
        errorCode: 'TIMESTAMP_TOO_OLD',
        errorMessage: 'PPG data point timestamp is too old',
        diagnosticInfo: {
          timestamp: dataPoint.timestamp,
          currentTime: now,
          ageInSeconds: (now - dataPoint.timestamp) / 1000
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate a batch of PPG data
   */
  public validatePPGDataBatch(dataPoints: PPGDataPoint[]): SignalValidationResult {
    // Check if we have enough data points
    if (dataPoints.length < this.config.requiredSampleSize) {
      return {
        isValid: false,
        errorCode: 'INSUFFICIENT_DATA_POINTS',
        errorMessage: `Not enough data points (${dataPoints.length}/${this.config.requiredSampleSize})`,
        diagnosticInfo: {
          receivedCount: dataPoints.length,
          requiredCount: this.config.requiredSampleSize
        }
      };
    }

    // Validate each data point
    for (let i = 0; i < dataPoints.length; i++) {
      const result = this.validatePPGDataPoint(dataPoints[i]);
      if (!result.isValid) {
        return {
          ...result,
          errorMessage: `Data point at index ${i}: ${result.errorMessage}`
        };
      }
    }

    // Check variance of values (to detect constant signals)
    const values = dataPoints.map(p => p.value);
    const variance = this.calculateVariance(values);
    
    if (variance < this.config.minVariance) {
      return {
        isValid: false,
        errorCode: 'VARIANCE_TOO_LOW',
        errorMessage: 'Signal variance is too low, possibly a constant signal',
        diagnosticInfo: {
          variance,
          minAllowedVariance: this.config.minVariance,
          values
        }
      };
    }

    if (variance > this.config.maxVariance) {
      return {
        isValid: false,
        errorCode: 'VARIANCE_TOO_HIGH',
        errorMessage: 'Signal variance is too high, possibly noise',
        diagnosticInfo: {
          variance,
          maxAllowedVariance: this.config.maxVariance,
          values
        }
      };
    }

    // All validations passed
    return {
      isValid: true,
      diagnosticInfo: {
        sampleSize: dataPoints.length,
        variance,
        range: [Math.min(...values), Math.max(...values)]
      }
    };
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return variance;
  }

  /**
   * Update validation configuration
   */
  public updateConfig(config: Partial<SignalValidationConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * Get current configuration
   */
  public getConfig(): SignalValidationConfig {
    return { ...this.config };
  }
}

// Export factory function for easy access
export const createSignalValidator = (config?: Partial<SignalValidationConfig>) => 
  new SignalValidator(config);

