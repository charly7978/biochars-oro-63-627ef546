
/**
 * Utility for tracking and updating signal statistics
 */
export interface SignalStats {
  minValue: number;
  maxValue: number;
  avgValue: number;
  totalValues: number;
}

/**
 * Updates signal statistics with a new value
 */
export const updateSignalStats = (
  stats: SignalStats,
  newValue: number
): SignalStats => {
  return {
    minValue: Math.min(stats.minValue, newValue),
    maxValue: Math.max(stats.maxValue, newValue),
    avgValue: (stats.avgValue * stats.totalValues + newValue) / (stats.totalValues + 1),
    totalValues: stats.totalValues + 1
  };
};

/**
 * Creates initial empty signal statistics
 */
export const createEmptySignalStats = (): SignalStats => ({
  minValue: Infinity,
  maxValue: -Infinity,
  avgValue: 0,
  totalValues: 0
});
