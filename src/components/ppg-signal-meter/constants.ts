
// Canvas and display constants
export const CANVAS_CENTER_OFFSET = 60;
export const WINDOW_WIDTH_MS = 5000;
export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 720;
export const GRID_SIZE_X = 30;
export const GRID_SIZE_Y = 5;
export const VERTICAL_SCALE = 65.0;
export const SMOOTHING_FACTOR = 1.6;
export const TARGET_FPS = 180;
export const FRAME_TIME = 1000 / TARGET_FPS;
export const BUFFER_SIZE = 600;

// Peak detection constants
export const PEAK_DETECTION_WINDOW = 6;
export const PEAK_THRESHOLD = 2.0;
export const MIN_PEAK_DISTANCE_MS = 200;
export const IMMEDIATE_RENDERING = true;
export const MAX_PEAKS_TO_DISPLAY = 20;

// Finger detection constants
export const REQUIRED_FINGER_FRAMES = 12;
export const QUALITY_HISTORY_SIZE = 20;
export const AMPLITUDE_HISTORY_SIZE = 20;
export const MIN_AMPLITUDE_THRESHOLD = 1.5;
export const REQUIRED_STABILITY_FRAMES = 5;
export const QUALITY_DECAY_RATE = 0.75;
export const NOISE_BUFFER_SIZE = 20;
export const MAX_NOISE_RATIO = 0.2;
export const MIN_PEAK_VARIANCE = 1.2;
export const STABILITY_TIMEOUT_MS = 4000;
export const MIN_DERIVATIVE_THRESHOLD = 0.5;

// Rendering constants
export const USE_OFFSCREEN_CANVAS = true;
export const ARRHYTHMIA_COLOR = '#FF2E2E';
export const NORMAL_COLOR = '#0EA5E9';
export const ARRHYTHMIA_INDICATOR_SIZE = 8;
export const ARRHYTHMIA_PULSE_COLOR = '#FFDA00';
export const ARRHYTHMIA_DURATION_MS = 800;
