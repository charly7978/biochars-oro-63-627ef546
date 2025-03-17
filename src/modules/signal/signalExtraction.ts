
/**
 * Utilities for extracting and analyzing PPG signals from image data
 * Extracted from SignalProcessor for better maintainability
 */

import { ProcessedSignal } from '../../types/signal';

/**
 * Extract red channel from an image frame
 * The red channel is most sensitive to blood volume changes
 */
export function extractRedChannel(imageData: ImageData): number {
  const data = imageData.data;
  let redSum = 0;
  let count = 0;
  
  // Analyze a larger portion of the image (40% center)
  const startX = Math.floor(imageData.width * 0.3);
  const endX = Math.floor(imageData.width * 0.7);
  const startY = Math.floor(imageData.height * 0.3);
  const endY = Math.floor(imageData.height * 0.7);
  
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const i = (y * imageData.width + x) * 4;
      redSum += data[i];  // Red channel
      count++;
    }
  }
  
  const avgRed = redSum / count;
  return avgRed;
}

/**
 * Calculate perfusion index from recent values
 */
export function calculatePerfusionIndex(lastValues: number[]): number {
  if (lastValues.length < 5) return 0;
  
  const recent = lastValues.slice(-5);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  
  // PI = (AC/DC)
  const ac = max - min;
  const dc = (max + min) / 2;
  
  return dc > 0 ? ac / dc : 0;
}

/**
 * Detect region of interest
 */
export function detectROI(redValue: number): ProcessedSignal['roi'] {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100
  };
}

/**
 * Analyze signal to determine quality and finger presence
 */
export function analyzeSignal(
  filtered: number, 
  rawValue: number, 
  movementScore: number,
  lastValues: number[],
  stableFrameCount: number,
  lastPeriodicityScore: number,
  config: {
    MIN_RED_THRESHOLD: number;
    MAX_RED_THRESHOLD: number;
    STABILITY_WINDOW: number;
    MIN_STABILITY_COUNT: number;
  }
): { 
  isFingerDetected: boolean; 
  quality: number; 
  updatedStableFrameCount: number;
  lastStableValue: number;
} {
  // Basic threshold verification (more permissive)
  const isInRange = rawValue >= config.MIN_RED_THRESHOLD && 
                   rawValue <= config.MAX_RED_THRESHOLD;
  
  let updatedStableFrameCount = stableFrameCount;
  let lastStableValue = 0;
  
  // If completely out of range, no finger
  if (!isInRange) {
    // Gradually reduce stability counter instead of resetting
    updatedStableFrameCount = Math.max(0, stableFrameCount - 0.5);
    return { 
      isFingerDetected: updatedStableFrameCount > 0, 
      quality: Math.max(0, updatedStableFrameCount * 10),
      updatedStableFrameCount,
      lastStableValue
    };
  }

  // Check if we have enough samples to analyze
  if (lastValues.length < 3) {
    return { 
      isFingerDetected: false, 
      quality: 0,
      updatedStableFrameCount,
      lastStableValue
    };
  }

  // Analyze signal stability (now more permissive)
  const recentValues = lastValues.slice(-config.STABILITY_WINDOW);
  const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  
  // Evaluate variations between consecutive samples
  const variations = recentValues.map((val, i, arr) => {
    if (i === 0) return 0;
    return val - arr[i-1];
  });

  // Detect stability with adaptive threshold
  const maxVariation = Math.max(...variations.map(Math.abs));
  const minVariation = Math.min(...variations);
  
  // Adaptive threshold based on average (more permissive)
  const adaptiveThreshold = Math.max(2.0, avgValue * 0.03);
  
  // More permissive stability detection
  const isStable = maxVariation < adaptiveThreshold * 3 && 
                  minVariation > -adaptiveThreshold * 3;
  
  // Adjust stability counter
  if (isStable) {
    updatedStableFrameCount = Math.min(stableFrameCount + 0.5, config.MIN_STABILITY_COUNT * 2);
    lastStableValue = filtered;
  } else {
    // More gradual reduction
    updatedStableFrameCount = Math.max(0, stableFrameCount - 0.2);
  }
  
  // Movement factor (allows more movement)
  const MAX_MOVEMENT_THRESHOLD = 15;
  const movementFactor = Math.max(0, 1 - (movementScore / MAX_MOVEMENT_THRESHOLD));
  
  // Periodicity factor (look for cardiac patterns)
  const periodicityFactor = Math.max(0.3, lastPeriodicityScore);
  
  // Calculate quality weighting multiple factors
  let quality = 0;
  
  // Always calculate quality, even with low stability
  const stabilityScore = Math.min(updatedStableFrameCount / (config.MIN_STABILITY_COUNT * 1.5), 1);
  const intensityScore = Math.min(
    (rawValue - config.MIN_RED_THRESHOLD) / (config.MAX_RED_THRESHOLD - config.MIN_RED_THRESHOLD), 
    1
  );
  const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 4)));
  
  // Adjusted weighting to be more permissive
  quality = Math.round((
    stabilityScore * 0.4 + 
    intensityScore * 0.3 + 
    variationScore * 0.1 + 
    movementFactor * 0.1 + 
    periodicityFactor * 0.1
  ) * 100);
  
  // More permissive finger detection
  // Allow detection with lower minimum quality
  const minQualityThreshold = 30; // Reduced quality threshold
  const isFingerDetected = updatedStableFrameCount >= config.MIN_STABILITY_COUNT * 0.7 && 
                          quality >= minQualityThreshold;

  return { 
    isFingerDetected, 
    quality,
    updatedStableFrameCount,
    lastStableValue
  };
}
