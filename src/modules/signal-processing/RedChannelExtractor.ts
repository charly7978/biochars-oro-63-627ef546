
/**
 * Enhanced RedChannelExtractor that analyzes specific regions for maximum sensitivity
 */
export class RedChannelExtractor {
  private readonly SAMPLE_RATE = 2; // Check every 2 pixels for balanced performance
  private readonly THRESHOLD = 20; // Minimum threshold for red channel
  
  /**
   * Extract average red channel value from central region of the image
   */
  public extractRedValue(imageData: ImageData): number {
    if (!imageData || !imageData.data || imageData.data.length === 0) {
      console.warn("RedChannelExtractor: Invalid image data");
      return 0;
    }
    
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Focus on the center 60% of the image where the finger is likely to be
    const startX = Math.floor(width * 0.2);
    const endX = Math.floor(width * 0.8);
    const startY = Math.floor(height * 0.2);
    const endY = Math.floor(height * 0.8);
    
    let redSum = 0;
    let pixelCount = 0;
    
    // Process only the central region with sampling for better performance
    for (let y = startY; y < endY; y += this.SAMPLE_RATE) {
      const rowOffset = y * width * 4;
      for (let x = startX; x < endX; x += this.SAMPLE_RATE) {
        const pixelIndex = rowOffset + x * 4;
        // Red is the first channel (RGBA)
        if (pixelIndex < data.length) {
          redSum += data[pixelIndex];
          pixelCount++;
        }
      }
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
        width,
        height,
        threshold: this.THRESHOLD,
        timestamp: new Date().toISOString()
      });
    }
    
    return avgRed;
  }
}
