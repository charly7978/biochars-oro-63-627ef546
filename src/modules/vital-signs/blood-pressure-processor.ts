
  /**
   * Filter outliers using IQR method with configurable threshold
   */
  private filterOutliers(values: number[], iqrThreshold: number = 1.5): number[] {
    if (values.length < 4) return values;
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sortedValues.length / 4);
    const q3Index = Math.floor(3 * sortedValues.length / 4);
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - iqrThreshold * iqr;
    const upperBound = q3 + iqrThreshold * iqr;
    
    return values.filter(val => val >= lowerBound && val <= upperBound);
  }
