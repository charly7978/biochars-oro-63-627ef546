
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
    
    // Debug values
    console.log("RedChannelExtractor: Processing image", {
      width: imageData.width,
      height: imageData.height,
      dataLength: data.length
    });
    
    if (imageData.width === 0 || imageData.height === 0 || data.length === 0) {
      console.warn("RedChannelExtractor: Invalid image data");
      return 0;
    }
    
    // Analyze a much larger central region (90% of image) for better sensitivity
    const centerRegionSize = 0.9; // Increased from 70% to 90%
    const startX = Math.floor(imageData.width * ((1 - centerRegionSize) / 2));
    const endX = Math.floor(imageData.width * (1 - ((1 - centerRegionSize) / 2)));
    const startY = Math.floor(imageData.height * ((1 - centerRegionSize) / 2));
    const endY = Math.floor(imageData.height * (1 - ((1 - centerRegionSize) / 2)));
    
    console.log("RedChannelExtractor: Analysis region", {
      startX, endX, startY, endY,
      regionWidth: endX - startX,
      regionHeight: endY - startY
    });
    
    // Extract red channel from each pixel in the central region
    // Use a sampling approach for larger images to improve performance
    // Using lower skipFactor to capture more pixels 
    const skipFactor = (imageData.width > 400) ? 1 : 1;
    
    for (let y = startY; y < endY; y += skipFactor) {
      for (let x = startX; x < endX; x += skipFactor) {
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
    
    // Report values for debugging - more frequent reporting
    if (Math.random() < 0.2) { // Increased from 0.1 to 0.2
      console.log("RedChannelExtractor: Extracted value", {
        avgRed,
        pixelsAnalyzed: pixelCount,
        timestamp: Date.now()
      });
    }
    
    return avgRed;
  }
}
