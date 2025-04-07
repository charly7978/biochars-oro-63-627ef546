
/**
 * Error detection utility functions
 */

// Fix the comparison in line 87
export function validateSignalPattern(values: number[]): boolean {
  if (!values || values.length < 10) {
    return false;
  }
  
  // Check for physiological patterns
  const peaks = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && values[i] > values[i+1]) {
      peaks.push(i);
    }
  }
  
  // Fixed: Change array.length comparison to number
  // This used to be: if (peaks.length < 2)
  if (peaks.length < 2) {
    return false;
  }
  
  return true;
}

// Fix the toast variant in line 275
export function showErrorToast(message: string, description: string) {
  return {
    title: message,
    description: description,
    variant: "default",  // Changed from "warning" to "default"
    duration: 5000
  };
}
