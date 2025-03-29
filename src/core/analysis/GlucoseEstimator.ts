
import { ProcessorConfig } from '../config/ProcessorConfig';
import { UserProfile } from './BloodPressureAnalyzer';

export class GlucoseEstimator {
  private dataPoints: number[] = [];
  private readonly MIN_DATA_POINTS = 120;
  
  constructor(config?: ProcessorConfig, userProfile?: UserProfile) {}
  
  public reset(): void {
    this.dataPoints = [];
  }
}
