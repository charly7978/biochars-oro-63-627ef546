
/**
 * Extracts the red channel value from image data for PPG analysis
 */
export class RedChannelExtractor {
  /**
   * Extract the red channel average value from image data
   * @param imageData - The raw image data from camera
   * @returns Average red channel value
   */
  public extractRedValue(imageData: ImageData): number {
    const { data, width, height } = imageData;
    
    // Get center region of the image
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const regionSize = Math.min(width, height) / 3;
    
    const startX = Math.max(0, Math.floor(centerX - regionSize));
    const endX = Math.min(width, Math.floor(centerX + regionSize));
    const startY = Math.max(0, Math.floor(centerY - regionSize));
    const endY = Math.min(height, Math.floor(centerY + regionSize));
    
    let redSum = 0;
    let pixelCount = 0;
    
    // Process only center region for efficiency
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const pixelIndex = (y * width + x) * 4;
        redSum += data[pixelIndex]; // Red channel is at index 0
        pixelCount++;
      }
    }
    
    return pixelCount > 0 ? redSum / pixelCount : 0;
  }
}
