
/**
 * Display optimization utilities
 */
import { useEffect, useRef } from 'react';
import { runWithMemoryManagement } from './tfModelInitializer';
import { adaptiveFilter } from './signalNormalization';

/**
 * Apply display optimizations to a value
 * @param value The value to optimize
 * @param options Optimization options
 * @returns Optimized value
 */
export function optimizeDisplayValue(
  value: number,
  options?: {
    range?: [number, number];
    smoothing?: boolean;
    rounding?: boolean;
  }
): number {
  const opts = {
    range: options?.range || [0, 100],
    smoothing: options?.smoothing !== undefined ? options?.smoothing : true,
    rounding: options?.rounding !== undefined ? options?.rounding : true
  };
  
  // Apply range constraints
  let result = Math.max(opts.range[0], Math.min(opts.range[1], value));
  
  // Apply rounding if needed
  if (opts.rounding) {
    result = Math.round(result);
  }
  
  return result;
}

/**
 * Apply visual smoothing to a series of values
 * @param values Array of values to smooth
 * @param alpha Smoothing factor (0-1)
 * @returns Smoothed values
 */
export function applyVisualSmoothing(values: number[], alpha: number = 0.3): number[] {
  if (values.length <= 1) {
    return [...values];
  }
  
  const result: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    result.push(adaptiveFilter(values[i], [result[i-1]], alpha));
  }
  
  return result;
}

/**
 * Optimize a canvas element for the device's pixel ratio
 * @param canvas The canvas element to optimize
 * @param width Desired width in CSS pixels
 * @param height Desired height in CSS pixels
 */
export function optimizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  if (!canvas) return;
  
  const dpr = window.devicePixelRatio || 1;
  
  // Set display size (css pixels)
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  
  // Set actual size in memory (scaled to account for extra pixel density)
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  
  // Get context and scale all drawing operations by the dpr
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
  
  // Apply optimized rendering hints
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
}

/**
 * Optimize an HTML element for better rendering
 * @param element The element to optimize
 */
export function optimizeElement(element: HTMLElement): void {
  if (!element) return;
  
  // Add CSS properties that leverage GPU acceleration
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
  
  // Add class for CSS optimizations
  element.classList.add('optimized-element');
}

/**
 * Detect if the current device is a mobile device
 * @returns Boolean indicating if the device is mobile
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Hook to optimize frame rate for animations
 * @param callback Animation callback
 * @param fps Target frames per second
 */
export function useOptimizedFrameRate(
  callback: (timestamp: number) => void,
  fps: number = 30
): void {
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const interval = 1000 / fps;
  
  useEffect(() => {
    const animate = (time: number) => {
      if (time - lastTimeRef.current >= interval) {
        callback(time);
        lastTimeRef.current = time;
      }
      
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current !== undefined) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [callback, interval]);
}
