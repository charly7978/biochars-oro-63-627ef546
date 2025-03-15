
/**
 * Utilities for optimizing display and rendering across various device resolutions
 */

/**
 * Optimizes canvas rendering for high-DPI displays
 * @param canvas Canvas element to optimize
 * @param ctx Canvas rendering context
 */
export function optimizeCanvasRendering(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  if (!canvas || !ctx) return;
  
  // Get device pixel ratio
  const dpr = window.devicePixelRatio || 1;
  
  if (dpr > 1) {
    // Get current size
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    
    // Scale canvas by device pixel ratio
    canvas.width = originalWidth * dpr;
    canvas.height = originalHeight * dpr;
    
    // Scale back using CSS
    canvas.style.width = `${originalWidth}px`;
    canvas.style.height = `${originalHeight}px`;
    
    // Scale the context
    ctx.scale(dpr, dpr);
    
    // Set appropriate rendering settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  
  console.log(`Canvas optimized for pixel ratio: ${dpr}`);
}

/**
 * Optimizes a specific canvas element (function needed by GraphGrid component)
 * @param canvas Canvas element to optimize
 */
export function optimizeCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    optimizeCanvasRendering(canvas, ctx);
  }
}

/**
 * Optimizes an HTML element for high DPI displays (function needed by HeartRateDisplay component)
 * @param element Element to optimize
 */
export function optimizeElement(element: HTMLElement): void {
  if (!element) return;
  
  const dpr = window.devicePixelRatio || 1;
  
  if (dpr > 1.5) {
    // For very high DPI displays - use standard CSS properties
    element.style.setProperty('-webkit-font-smoothing', 'antialiased');
    element.style.textRendering = 'optimizeLegibility';
  } else {
    // For standard displays
    element.style.textRendering = 'auto';
  }
}

/**
 * Requests and maintains fullscreen mode (function needed by main.tsx)
 */
export async function enterImmersiveMode(): Promise<void> {
  const elem = document.documentElement;
  
  try {
    if (elem.requestFullscreen) {
      await elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) {
      await (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).mozRequestFullScreen) {
      await (elem as any).mozRequestFullScreen();
    } else if ((elem as any).msRequestFullscreen) {
      await (elem as any).msRequestFullscreen();
    }
    
    // For Android-specific immersive mode
    if (window.navigator.userAgent.match(/Android/i)) {
      if ((window as any).AndroidFullScreen) {
        (window as any).AndroidFullScreen.immersiveMode();
      }
    }
    
    console.log("Fullscreen mode enabled");
  } catch (error) {
    console.error("Error enabling fullscreen mode:", error);
  }
}

/**
 * Optimizes UI elements based on device pixel ratio (function needed by main.tsx)
 */
export function optimizeForScreenResolution(): void {
  // Use CSS transform to counter device pixel ratio for consistent visuals
  if ('devicePixelRatio' in window && window.devicePixelRatio !== 1) {
    // Only adjust for pixel ratios greater than 1 to avoid blurry text on standard screens
    if (window.devicePixelRatio > 1) {
      // Add meta viewport tag programmatically
      let metaViewport = document.querySelector('meta[name="viewport"]');
      if (!metaViewport) {
        metaViewport = document.createElement('meta');
        metaViewport.setAttribute('name', 'viewport');
        document.head.appendChild(metaViewport);
      }
      
      // Set viewport content for high DPI screens
      metaViewport.setAttribute('content', `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`);
      
      console.log(`Screen resolution optimized for pixel ratio: ${window.devicePixelRatio}`);
    }
  }
}

/**
 * Prevents scrolling and pinch zooming on mobile devices
 */
export function preventDefaultTouchBehavior(): void {
  // Prevent scrolling
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  
  // Prevent pinch zoom
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}

/**
 * Checks if the device is currently in fullscreen mode
 */
export function isInFullscreenMode(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

/**
 * Optimizes UI elements based on device pixel ratio
 * @param element Element to optimize
 */
export function optimizeUIForHighDPI(element: HTMLElement): void {
  if (!element) return;
  
  const dpr = window.devicePixelRatio || 1;
  
  if (dpr > 1.5) {
    // For very high DPI displays - use standard CSS properties
    element.style.setProperty('-webkit-font-smoothing', 'antialiased');
    element.style.textRendering = 'optimizeLegibility';
  } else {
    // For standard displays
    element.style.textRendering = 'auto';
  }
}

/**
 * Checks WebGL capabilities for rendering optimization
 */
export function checkWebGLSupport(): { supported: boolean; version: number } {
  let canvas = document.createElement('canvas');
  let gl: WebGLRenderingContext | null = null;
  let gl2: WebGL2RenderingContext | null = null;
  
  // Try WebGL 2 first
  try {
    gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext;
    if (gl2) {
      return { supported: true, version: 2 };
    }
  } catch (e) {
    console.warn('WebGL 2 not supported');
  }
  
  // Fallback to WebGL 1
  try {
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    if (gl) {
      return { supported: true, version: 1 };
    }
  } catch (e) {
    console.warn('WebGL 1 not supported');
  }
  
  return { supported: false, version: 0 };
}

/**
 * Sets optimal screen resolution for the current device
 */
function setOptimalScreenResolution(): void {
  // Use CSS transform to counter device pixel ratio for consistent visuals
  if ('devicePixelRatio' in window && window.devicePixelRatio !== 1) {
    // Only adjust for pixel ratios greater than 1 to avoid blurry text on standard screens
    if (window.devicePixelRatio > 1) {
      // Add meta viewport tag programmatically
      let metaViewport = document.querySelector('meta[name="viewport"]');
      if (!metaViewport) {
        metaViewport = document.createElement('meta');
        metaViewport.setAttribute('name', 'viewport');
        document.head.appendChild(metaViewport);
      }
      
      // Set viewport content for high DPI screens
      metaViewport.setAttribute('content', `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`);
      
      console.log(`Screen resolution optimized for pixel ratio: ${window.devicePixelRatio}`);
    }
  }
}

/**
 * Locks screen orientation to portrait or landscape
 */
function lockScreenOrientation(): void {
  try {
    // Try to lock to portrait mode
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait').catch(error => {
        console.warn('Screen orientation lock not supported:', error);
      });
    }
  } catch (error) {
    console.warn('Screen orientation API not supported');
  }
}

/**
 * Enables fullscreen mode for the document
 */
function enableFullscreenMode(): Promise<void> {
  const elem = document.documentElement;
  
  if (elem.requestFullscreen) {
    return elem.requestFullscreen();
  } else if ((elem as any).webkitRequestFullscreen) {
    return (elem as any).webkitRequestFullscreen();
  } else if ((elem as any).mozRequestFullScreen) {
    return (elem as any).mozRequestFullScreen();
  } else if ((elem as any).msRequestFullscreen) {
    return (elem as any).msRequestFullscreen();
  }
  
  return Promise.resolve();
}

/**
 * Full optimization for all display aspects
 */
export function optimizeDisplay(): void {
  // Apply all optimizations
  setOptimalScreenResolution();
  preventDefaultTouchBehavior();
  lockScreenOrientation();
  
  // Enable fullscreen on first user interaction
  document.addEventListener('click', async () => {
    if (!isInFullscreenMode()) {
      await enableFullscreenMode();
    }
  }, { once: true });
  
  // Continuously check fullscreen status (required for some mobile browsers)
  setInterval(() => {
    if (!isInFullscreenMode()) {
      enableFullscreenMode();
    }
  }, 3000);
  
  console.log('Display optimization complete');
}

// Export a version check function for compatibility
export function getDisplayApiVersion(): string {
  return '2.1.0';
}
