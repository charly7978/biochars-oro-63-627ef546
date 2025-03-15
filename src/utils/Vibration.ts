
/**
 * Utility for vibration feedback on devices that support it
 */
export const vibrate = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.error("Failed to vibrate", e);
    }
  }
};

/**
 * Vibration patterns for different scenarios
 */
export const VIBRATION_PATTERNS = {
  SUCCESS: [100, 50, 100],
  WARNING: [200, 100, 200],
  ERROR: [400, 200, 400],
  SIGNAL_QUALITY: {
    EXCELLENT: [50],
    GOOD: [50, 100, 50],
    FAIR: [100, 100, 100],
    POOR: [200, 200, 200]
  }
};
