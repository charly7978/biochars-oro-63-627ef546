/**
 * Aplica un filtro de Media Móvil Simple (SMA) a datos reales.
 * Mantiene y devuelve el buffer actualizado.
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  // Create a new buffer to avoid modifying the original array directly
  const newBuffer = [...buffer, value];

  // Remove the oldest value if the buffer exceeds the window size
  if (newBuffer.length > windowSize) {
    newBuffer.shift();
  }

  // Calculate the average of the values in the buffer
  const sum = newBuffer.reduce((a, b) => a + b, 0);
  const filteredValue = sum / newBuffer.length;

  return { filteredValue, updatedBuffer: newBuffer };
}

/**
 * Calculates the simple moving average for an array of numbers.
 * Does not manage state (buffer).
 */
export function calculateSMA(values: number[], windowSize: number): number | null {
    if (!values || values.length === 0 || windowSize <= 0) {
        return null;
    }

    const relevantValues = values.slice(-windowSize);
    if (relevantValues.length === 0) {
        return null;
    }

    const sum = relevantValues.reduce((acc, val) => acc + val, 0);
    return sum / relevantValues.length;
} 