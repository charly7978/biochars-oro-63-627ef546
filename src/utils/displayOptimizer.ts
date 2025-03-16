
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
  
  // Add animation optimizations
  element.style.transition = 'transform 0.1s ease-out';
};

export const setupLowLatencyAudio = (): AudioContext | null => {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  
  try {
    const audioContext = new AudioContext();
    
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
