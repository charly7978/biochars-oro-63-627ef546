
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
