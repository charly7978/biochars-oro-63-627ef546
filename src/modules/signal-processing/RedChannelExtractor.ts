
/**
 * Extracts red channel values from camera image data
 */
export class RedChannelExtractor {
  /**
   * Extract average red channel value from the center of the image
   * @param imageData - Raw image data from camera
   * @returns Average red channel value
   */
  public extractRedValue(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let pixelCount = 0;
    
    // Debug values - more frequent logging
    console.log("RedChannelExtractor: Processing image", {
      width: imageData.width,
      height: imageData.height,
      dataLength: data.length,
      timestamp: Date.now()
    });
    
    if (imageData.width === 0 || imageData.height === 0 || data.length === 0) {
      console.warn("RedChannelExtractor: Invalid image data");
      return 0;
    }
    
    // Analyze the ENTIRE image area for maximum sensitivity
    const centerRegionSize = 1.0; // Use 100% of the image
    const startX = 0;
    const endX = imageData.width;
    const startY = 0;
    const endY = imageData.height;
    
    console.log("RedChannelExtractor: Analysis region", {
      startX, endX, startY, endY,
      regionWidth: endX - startX,
      regionHeight: endY - startY
    });
    
    // Extract red channel from each pixel with NO SAMPLING - check every pixel
    // This ensures we don't miss any signal
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        
        // Ensure index is within bounds
        if (i >= 0 && i < data.length) {
          redSum += data[i]; // Red channel (R in RGBA)
          pixelCount++;
        }
      }
    }
    
    if (pixelCount === 0) {
      console.warn("RedChannelExtractor: No pixels analyzed");
      return 0;
    }
    
    const avgRed = redSum / pixelCount;
    
    // Report values for debugging - much more frequent
    console.log("RedChannelExtractor: Extracted value", {
      avgRed,
      pixelsAnalyzed: pixelCount,
      timestamp: Date.now()
    });
    
    return avgRed;
  }
}
