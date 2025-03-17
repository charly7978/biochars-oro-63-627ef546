
// Signal quality constants extracted from the main useSignalQuality hook
export const QUALITY_HISTORY_SIZE = 30; // Increased for better smoothing
export const QUALITY_DECAY_RATE = 0.9; // Less aggressive decay
export const AMPLITUDE_HISTORY_SIZE = 30; // Increased for trend detection
export const MIN_AMPLITUDE_THRESHOLD = 0.6; // Lowered for more sensitivity
export const NOISE_BUFFER_SIZE = 30; // Increased for better analysis
export const MAX_NOISE_RATIO = 0.4; // More permissive noise tolerance
export const MIN_DERIVATIVE_THRESHOLD = 0.25; // Lowered for more sensitivity
export const REQUIRED_STABILITY_FRAMES = 3; // Reduced for faster detection
export const STABILITY_TIMEOUT_MS = 5000; // Increased timeout
export const REQUIRED_FINGER_FRAMES = 6; // Reduced for faster detection
