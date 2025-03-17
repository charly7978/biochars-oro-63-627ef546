/**
 * Extracts the red channel value from image data for PPG analysis
 */
export class RedChannelExtractor {
  private previousValues: number[] = [];
  private readonly HISTORY_SIZE = 5;
  private readonly ANOMALY_THRESHOLD = 30; // For detecting outliers
  
  /**
   * Extract the red channel average value from image data
   * @param imageData - The raw image data from camera
   * @returns Average red channel value
   */
  public extractRedValue(imageData: ImageData): number {
    const { data, width, height } = imageData;
    
    // Get center region of the image with larger ROI
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const regionSize = Math.min(width, height) / 2.5; // Larger region (was /3)
    
    const startX = Math.max(0, Math.floor(centerX - regionSize));
    const endX = Math.min(width, Math.floor(centerX + regionSize));
    const startY = Math.max(0, Math.floor(centerY - regionSize));
    const endY = Math.min(height, Math.floor(centerY + regionSize));
    
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Process center region with optimized sampling for better performance
    const sampleRate = Math.max(1, Math.floor((endX - startX) / 50)); // Adaptive sampling rate
    
    for (let y = startY; y < endY; y += sampleRate) {
      for (let x = startX; x < endX; x += sampleRate) {
        const pixelIndex = (y * width + x) * 4;
        redSum += data[pixelIndex]; // Red channel
        greenSum += data[pixelIndex + 1]; // Green channel
        blueSum += data[pixelIndex + 2]; // Blue channel
        pixelCount++;
      }
    }
    
    if (pixelCount === 0) {
      console.warn("RedChannelExtractor: No pixels sampled");
      return 0;
    }
    
    // Use weighted red value with subtracted green/blue to emphasize blood volume changes
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Enhanced red with subtracted green and blue to improve blood volume signal
    // Low-pass filter - less subtraction to keep more of the red signal
    const enhancedRed = avgRed - ((avgGreen + avgBlue) / 4);
    
    // Anomaly detection to prevent spikes
    const normalizedValue = this.handleAnomalies(enhancedRed);
    
    // Occasionally log analysis details
    if (Math.random() < 0.05) {
      console.log("RedChannelExtractor: Analysis", {
        avgRed,
        avgGreen,
        avgBlue,
        enhancedRed,
        normalizedValue,
        pixelCount,
        sampleRate,
        roiWidth: endX - startX,
        roiHeight: endY - startY,
        imageWidth: width,
        imageHeight: height
      });
    }
    
    return normalizedValue;
  }
  
  /**
   * Handle anomalies and outliers in the extracted values
   */
  private handleAnomalies(value: number): number {
    if (this.previousValues.length === 0) {
      this.previousValues.push(value);
      return value;
    }
    
    // Calculate average of previous values
    const avgPrevious = this.previousValues.reduce((sum, v) => sum + v, 0) / 
                       this.previousValues.length;
    
    // Check if current value is an anomaly
    const diff = Math.abs(value - avgPrevious);
    
    if (diff > this.ANOMALY_THRESHOLD && this.previousValues.length >= 3) {
      // If anomaly detected, use smoothed value instead
      const smoothedValue = (avgPrevious * 0.7) + (value * 0.3);
      
      // Update history with smoothed value
      this.previousValues.push(smoothedValue);
      
      console.log("RedChannelExtractor: Anomaly detected and smoothed", {
        originalValue: value,
        smoothedValue,
        avgPrevious,
        diff
      });
      
      return smoothedValue;
    }
    
    // Update history
    this.previousValues.push(value);
    if (this.previousValues.length > this.HISTORY_SIZE) {
      this.previousValues.shift();
    }
    
    return value;
  }
}
