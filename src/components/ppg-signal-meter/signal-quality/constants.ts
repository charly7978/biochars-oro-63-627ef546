
// Signal quality constants extracted from the main useSignalQuality hook
export const QUALITY_HISTORY_SIZE = 25; // Increased for better smoothing
export const QUALITY_DECAY_RATE = 0.85; // Less aggressive decay
export const AMPLITUDE_HISTORY_SIZE = 25; // Increased for trend detection
export const MIN_AMPLITUDE_THRESHOLD = 0.8; // Lowered for more sensitivity
export const NOISE_BUFFER_SIZE = 25; // Increased for better analysis
export const MAX_NOISE_RATIO = 0.3; // More permissive noise tolerance
export const MIN_DERIVATIVE_THRESHOLD = 0.3; // Lowered for more sensitivity
export const REQUIRED_STABILITY_FRAMES = 4; // Reduced for faster detection
export const STABILITY_TIMEOUT_MS = 5000; // Increased timeout
export const REQUIRED_FINGER_FRAMES = 8; // Reduced for faster detection
