
/**
 * Utilities for optimizing display and immersive experience
 */

/**
 * Optimizes display appearance based on screen resolution
 */
export function optimizeForScreenResolution() {
  const pixelRatio = window.devicePixelRatio || 1;
  
  // Apply high-resolution optimizations
  if (pixelRatio > 1) {
    // Create a CSS variable with the device pixel ratio
    document.documentElement.style.setProperty('--device-pixel-ratio', pixelRatio.toString());
    
    // Add class based on DPI
    document.documentElement.classList.add('high-dpi');
    if (pixelRatio >= 2) {
      document.documentElement.classList.add('retina');
    }
    if (pixelRatio >= 3) {
      document.documentElement.classList.add('ultra-hd');
    }
    
    // Apply better font rendering for high-DPI displays
    const style = document.createElement('style');
    style.textContent = `
      body {
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      .ppg-signal-meter {
        will-change: transform;
        transform: translateZ(0);
      }
      
      canvas, svg {
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Set up resolution-based classes
  const { width, height } = window.screen;
  const minDimension = Math.min(width, height);
  const maxDimension = Math.max(width, height);
  
  if (minDimension >= 768) {
    document.documentElement.classList.add('high-res');
  }
  
  if (maxDimension >= 1920) {
    document.documentElement.classList.add('ultra-wide');
  }
}

/**
 * Enters immersive fullscreen mode
 */
export async function enterImmersiveMode(): Promise<void> {
  try {
    if (!document.fullscreenElement) {
      const docElm = document.documentElement;
      
      // Try standard fullscreen API
      if (docElm.requestFullscreen) {
        await docElm.requestFullscreen();
      } 
      // Handle vendor prefixes for older browsers
      else if (docElm.requestFullscreen) {
        await docElm.requestFullscreen();
      }
      
      // Apply immersive optimizations after entering fullscreen
      if (document.fullscreenElement) {
        // Lock orientation if supported and on mobile
        if (screen.orientation && 'lock' in screen.orientation) {
          try {
            // Lock to current orientation
            await screen.orientation.lock(screen.orientation.type);
          } catch (orientErr) {
            console.error('Orientation lock error:', orientErr);
          }
        }
        
        // Prevent sleep if available
        if (navigator.wakeLock) {
          try {
            const wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
              console.log('Wake Lock was released');
            });
          } catch (wakeErr) {
            console.error('Wake Lock error:', wakeErr);
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to enter immersive fullscreen mode:', err);
  }
}

/**
 * Checks if the device has high-performance capabilities
 */
export function checkHighPerformanceDevice(): boolean {
  const highPerformance = 
    // Check for hardware concurrency (CPU cores)
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency >= 4) || 
    // Check for device memory API
    ('deviceMemory' in navigator && (navigator as any).deviceMemory >= 4) ||
    // Check for high-end GPU (indirect detection)
    checkForHighEndGPU();
  
  if (highPerformance) {
    document.documentElement.classList.add('high-performance-device');
  }
  
  return highPerformance;
}

/**
 * Attempts to detect high-end GPU capabilities
 */
function checkForHighEndGPU(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      return false;
    }
    
    // Check for some advanced WebGL capabilities
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      // Check for high-end GPU keywords
      const highEndGPUKeywords = ['nvidia', 'amd', 'radeon', 'intel iris', 'apple gpu'];
      return highEndGPUKeywords.some(keyword => 
        renderer.toLowerCase().includes(keyword)
      );
    }
    
    // If can't get specific info, check for WebGL2 support as proxy for better hardware
    return !!canvas.getContext('webgl2');
    
  } catch (e) {
    return false;
  }
}
