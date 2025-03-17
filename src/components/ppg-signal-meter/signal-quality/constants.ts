
// Signal quality constants extracted from the main useSignalQuality hook
export const QUALITY_HISTORY_SIZE = 20;
export const QUALITY_DECAY_RATE = 0.75;
export const AMPLITUDE_HISTORY_SIZE = 20;
export const MIN_AMPLITUDE_THRESHOLD = 1.5;
export const NOISE_BUFFER_SIZE = 20;
export const MAX_NOISE_RATIO = 0.2;
export const MIN_DERIVATIVE_THRESHOLD = 0.5;
export const REQUIRED_STABILITY_FRAMES = 5;
export const STABILITY_TIMEOUT_MS = 4000;
export const REQUIRED_FINGER_FRAMES = 12;
