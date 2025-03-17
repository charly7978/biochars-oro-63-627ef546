
/**
 * Extracts the red channel from camera image data for PPG processing
 */
export class RedChannelExtractor {
  /**
   * Extract average red channel value from the central region of an image
   * @param imageData - Raw image data from camera
   * @returns Average red channel value from the central region
   */
  public extractRedValue(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Analyze the center of the image (30% central region)
    // This focuses on the most relevant part of the finger/sensor
    const startX = Math.floor(imageData.width * 0.35);
    const endX = Math.floor(imageData.width * 0.65);
    const startY = Math.floor(imageData.height * 0.35);
    const endY = Math.floor(imageData.height * 0.65);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];  // Red channel (first component of RGBA)
        count++;
      }
    }
    
    return count > 0 ? redSum / count : 0;
  }
}
