
/**
 * Enhanced RedChannelExtractor that analyzes the entire image for maximum sensitivity
 */
export class RedChannelExtractor {
  private readonly SAMPLE_RATE = 1; // Check every pixel for maximum sensitivity
  
  /**
   * Extract average red channel value from the entire image
   */
  public extractRedValue(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let pixelCount = 0;
    
    // Process the entire image - no sampling regions
    for (let i = 0; i < data.length; i += 4 * this.SAMPLE_RATE) {
      redSum += data[i]; // Red channel (R in RGBA)
      pixelCount++;
    }
    
    if (pixelCount === 0) {
      console.warn("RedChannelExtractor: No pixels analyzed");
      return 0;
    }
    
    const avgRed = redSum / pixelCount;
    
    // Occasional logging to avoid console flooding
    if (Math.random() < 0.01) {
      console.log("RedChannelExtractor: Extracted value", {
        avgRed,
        pixelsAnalyzed: pixelCount,
        width: imageData.width,
        height: imageData.height,
        timestamp: Date.now()
      });
    }
    
    return avgRed;
  }
}
