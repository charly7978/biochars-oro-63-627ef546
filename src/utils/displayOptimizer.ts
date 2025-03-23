
/**
 * Display optimizer utilities for better rendering performance
 * across different devices and environments.
 */

export const optimizeDisplayRendering = (): void => {
  // Enable hardware acceleration if available
  document.body.style.transform = 'translateZ(0)';
  
  // Optimize animations
  document.body.style.willChange = 'transform';
  
  // Set animation preferences for reduced motion if user prefers it
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.style.setProperty('--animation-duration', '0ms');
  }
  
  // Force GPU rendering on mobile devices
  if (isMobileDevice()) {
    document.documentElement.classList.add('force-gpu');
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no';
    document.head.appendChild(meta);
  }
  
  console.log('Display optimizations applied');
};

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
};

export const setOptimalFrameRate = (canvas: HTMLCanvasElement): void => {
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Optimize canvas for high DPI displays
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  ctx.scale(ratio, ratio);
  
  // Use optimized rendering settings
  (ctx as any).imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';
};

export const applyTextOptimizations = (): void => {
  const style = document.createElement('style');
  style.textContent = `
    * {
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  `;
  
  document.head.appendChild(style);
};

export const optimizeHeartbeatVisualization = (element: HTMLElement): void => {
  if (!element) return;
  
  // Set CSS properties for smooth animations
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
  element.style.transformStyle = 'preserve-3d';
  
  // Add animation optimizations with lower latency
  element.style.transition = 'transform 0.08s ease-out';
};

export const setupLowLatencyAudio = (): AudioContext | null => {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  
  try {
    // Create audio context with low latency hint
    const audioContext = new AudioContext({
      latencyHint: 'interactive'
    });
    
    // Immediately resume to prevent auto-suspension issues
    audioContext.resume().catch(err => {
      console.warn('Error resuming AudioContext:', err);
    });
    
    // Set optimal buffer size for low latency
    if (audioContext && (audioContext as any).createScriptProcessor) {
      const bufferSize = 256; // Lower values reduce latency but increase CPU usage
      const processor = (audioContext as any).createScriptProcessor(bufferSize, 1, 1);
      processor.connect(audioContext.destination);
    }
    
    return audioContext;
  } catch (error) {
    console.error('Error setting up low latency audio:', error);
    return null;
  }
};

export const optimizeForTouchDevices = (): void => {
  if (!isMobileDevice()) return;
  
  // Disable default touch actions to prevent delays
  document.body.style.touchAction = 'none';
  
  // Add touch-specific event listeners with passive option for better scrolling
  document.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('touchmove', () => {}, { passive: true });
};

/**
 * Optimizes a canvas element for the current device's display
 * @param canvas The canvas element to optimize
 */
export const optimizeCanvas = (canvas: HTMLCanvasElement): void => {
  if (!canvas) return;
  
  // Optimize canvas for high DPI displays
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(ratio, ratio);
    
    // Use optimized rendering settings
    (ctx as any).imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = 'high';
  }
};

/**
 * Optimizes a DOM element for better performance
 * @param element The element to optimize
 */
export const optimizeElement = (element: HTMLElement): void => {
  if (!element) return;
  
  // Set CSS properties for smooth animations and better performance
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
  element.style.transformStyle = 'preserve-3d';
  element.style.willChange = 'transform, opacity';
  
  // Add animation optimizations
  element.style.transition = 'transform 0.1s ease-out';
};

/**
 * Gets the appropriate signal color based on arrhythmia status
 * @param isArrhythmia Whether the signal point represents an arrhythmia
 * @returns The color to use for the signal
 */
export const getSignalColor = (isArrhythmia: boolean): string => {
  return isArrhythmia ? '#FF2E2E' : '#0EA5E9';
};

/**
 * Checks if a point falls within an arrhythmia window
 * @param pointTime The timestamp of the point
 * @param arrhythmiaWindows Array of arrhythmia time windows
 * @returns Whether the point is in an arrhythmia window
 */
export const isPointInArrhythmiaWindow = (
  pointTime: number, 
  arrhythmiaWindows: Array<{start: number, end: number}>
): boolean => {
  return arrhythmiaWindows.some(window => 
    pointTime >= window.start && pointTime <= window.end
  );
};

/**
 * Auto-calibrates heartbeat processor settings based on device capabilities and signal quality
 * @param processor The HeartBeatProcessor instance to calibrate
 * @returns Configuration object with optimal settings
 */
export const autoCalibrate = (processor: any): any => {
  if (!processor) return null;
  
  try {
    // Get device information for calibration
    const isMobile = isMobileDevice();
    const isLowPowerDevice = isMobile && isLowPerformanceDevice();
    const isHighEnd = !isMobile && isHighPerformanceDevice();
    
    // Establish base values based on device
    const baseConfig = {
      SIGNAL_THRESHOLD: isMobile ? 0.15 : 0.18,
      DERIVATIVE_THRESHOLD: isMobile ? -0.015 : -0.02,
      MIN_PEAK_TIME_MS: isLowPowerDevice ? 400 : 350,
      MEDIAN_FILTER_WINDOW: isLowPowerDevice ? 3 : 5,
      MOVING_AVERAGE_WINDOW: isLowPowerDevice ? 3 : 5,
      EMA_ALPHA: isHighEnd ? 0.2 : 0.15,
      BASELINE_FACTOR: isHighEnd ? 0.998 : 0.997,
      MIN_BEEP_INTERVAL_MS: 300 // Natural minimum time between heartbeats
    };
    
    // Try to detect current signal patterns if we have data
    if (processor.signalBuffer && processor.signalBuffer.length > 10) {
      // Analyze current signal for guidance
      const values = processor.signalBuffer;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      
      // Adjust thresholds based on actual signal
      if (range > 0) {
        baseConfig.SIGNAL_THRESHOLD = Math.max(0.1, Math.min(0.25, range * 0.3));
        
        // Calculate noise level and adjust filter settings
        const noiseLevel = calculateNoiseLevel(values);
        if (noiseLevel > 0.2) {
          // High noise = more filtering
          baseConfig.MEDIAN_FILTER_WINDOW = Math.min(7, baseConfig.MEDIAN_FILTER_WINDOW + 2);
          baseConfig.MOVING_AVERAGE_WINDOW = Math.min(7, baseConfig.MOVING_AVERAGE_WINDOW + 2);
          baseConfig.EMA_ALPHA = Math.max(0.1, baseConfig.EMA_ALPHA - 0.05);
        } else if (noiseLevel < 0.05) {
          // Low noise = less filtering for better response
          baseConfig.MEDIAN_FILTER_WINDOW = Math.max(3, baseConfig.MEDIAN_FILTER_WINDOW - 1);
          baseConfig.MOVING_AVERAGE_WINDOW = Math.max(3, baseConfig.MOVING_AVERAGE_WINDOW - 1);
          baseConfig.EMA_ALPHA = Math.min(0.25, baseConfig.EMA_ALPHA + 0.05);
        }
      }
    }
    
    console.log('HeartBeatProcessor auto-calibration completed', baseConfig);
    return baseConfig;
  } catch (error) {
    console.error('Error during auto-calibration:', error);
    return null;
  }
};

/**
 * Checks if the device is a low performance device
 * @returns Whether the device is a low performance device
 */
export const isLowPerformanceDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check for hardware concurrency
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
    return true;
  }
  
  // Low memory devices
  if ((navigator as any).deviceMemory && (navigator as any).deviceMemory < 4) {
    return true;
  }
  
  // Assume mobile devices are lower performance unless proven otherwise
  if (isMobileDevice()) {
    // Check if it's a high-end mobile device
    const userAgent = navigator.userAgent.toLowerCase();
    const highEndMobilePatterns = ['iphone 12', 'iphone 13', 'iphone 14', 'iphone 15', 'galaxy s20', 'galaxy s21', 'galaxy s22', 'pixel 6'];
    const isHighEndMobile = highEndMobilePatterns.some(pattern => userAgent.includes(pattern));
    return !isHighEndMobile;
  }
  
  return false;
};

/**
 * Checks if the device is a high performance device
 * @returns Whether the device is a high performance device
 */
export const isHighPerformanceDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check for high hardware concurrency
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency >= 8) {
    return true;
  }
  
  // High memory devices
  if ((navigator as any).deviceMemory && (navigator as any).deviceMemory >= 8) {
    return true;
  }
  
  return false;
};

/**
 * Calculates the noise level in a signal
 * @param values The signal values
 * @returns The noise level as a value between 0 and 1
 */
export const calculateNoiseLevel = (values: number[]): number => {
  if (!values || values.length < 3) return 0;
  
  let differenceSum = 0;
  for (let i = 1; i < values.length; i++) {
    differenceSum += Math.abs(values[i] - values[i-1]);
  }
  
  const averageDifference = differenceSum / (values.length - 1);
  
  // Normalize to 0-1 range
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  return range > 0 ? (averageDifference / range) : 0;
};

/**
 * Adapts processor settings based on real-time signal quality
 * @param processor The HeartBeatProcessor instance
 * @param signalQuality Signal quality between 0 and 1
 */
export const adaptProcessorToSignalQuality = (processor: any, signalQuality: number): void => {
  if (!processor) return;
  
  try {
    // Scale thresholds based on quality (lower quality = more tolerant thresholds)
    if (signalQuality < 0.3) {
      // Low quality - make detection more tolerant but add stronger filtering
      processor.SIGNAL_THRESHOLD = Math.max(0.12, processor.SIGNAL_THRESHOLD * 0.9);
      processor.MEDIAN_FILTER_WINDOW = Math.min(7, processor.MEDIAN_FILTER_WINDOW + 1);
      processor.EMA_ALPHA = Math.max(0.1, processor.EMA_ALPHA - 0.02);
    } else if (signalQuality > 0.7) {
      // High quality - make detection more precise with less filtering
      processor.SIGNAL_THRESHOLD = Math.min(0.25, processor.SIGNAL_THRESHOLD * 1.05);
      processor.MEDIAN_FILTER_WINDOW = Math.max(3, processor.MEDIAN_FILTER_WINDOW - 1);
      processor.EMA_ALPHA = Math.min(0.25, processor.EMA_ALPHA + 0.02);
    }
    
    // Adjust minimum peak time threshold based on quality
    processor.MIN_PEAK_TIME_MS = signalQuality > 0.6 ? 350 : 400;
  } catch (error) {
    console.error('Error adapting processor settings:', error);
  }
};
