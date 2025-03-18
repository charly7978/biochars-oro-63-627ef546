
/**
 * Signal processing utilities index
 * Direct measurement only - no simulation
 */

export * from './signal-quality';
export * from './result-processor';
// Export peak-detection functions individually to avoid conflicts
export { handlePeakDetection } from './peak-detection';

// Add missing signal processing functions
export const processSignalResult = (
  data: Uint8ClampedArray,
  width: number,
  height: number
) => {
  // Process red channel values in center area
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const radius = Math.min(width, height) / 4;
  
  let redSum = 0;
  let pixelCount = 0;
  let maxValue = 0;
  
  // Sample central region for better finger detection
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= radius) {
        const i = (y * width + x) * 4;
        const red = data[i]; // Red channel
        
        redSum += red;
        pixelCount++;
        maxValue = Math.max(maxValue, red);
      }
    }
  }
  
  const value = pixelCount > 0 ? redSum / pixelCount : 0;
  const quality = maxValue > 100 ? Math.min(100, maxValue / 2.55) : 0;
  const isPeak = false; // Peak detection happens in the signal processor
  
  return { value, quality, isPeak };
};
