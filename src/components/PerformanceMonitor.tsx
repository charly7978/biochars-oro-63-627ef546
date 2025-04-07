import React, { useEffect, useState, useRef } from 'react';

interface PerformanceMonitorProps {
  enabled?: boolean;
  showInUI?: boolean;
}

/**
 * Performance monitoring component to help detect and address performance issues
 */
const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ 
  enabled = true,
  showInUI = false
}) => {
  const [fps, setFps] = useState<number>(0);
  const [memoryUsage, setMemoryUsage] = useState<number>(0);
  const [cpuUsage, setCpuUsage] = useState<number>(0);
  const [performanceIssues, setPerformanceIssues] = useState<string[]>([]);
  
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const animationFrameRef = useRef<number | null>(null);
  
  // Track CPU usage through task duration
  const taskStartTimeRef = useRef<number>(0);
  const taskDurationsRef = useRef<number[]>([]);
  const MAX_TASK_DURATIONS = 20;
  
  // FPS Measurement
  useEffect(() => {
    if (!enabled) return;
    
    const measureFPS = () => {
      const now = performance.now();
      frameCountRef.current++;
      
      const elapsed = now - lastTimeRef.current;
      
      if (elapsed >= 1000) { // Update every second
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(currentFps);
        
        // Detect low FPS
        if (currentFps < 30) {
          setPerformanceIssues(prev => {
            if (!prev.includes('Low FPS')) {
              console.warn(`Performance issue detected: Low FPS (${currentFps})`);
              return [...prev, 'Low FPS'];
            }
            return prev;
          });
        } else {
          setPerformanceIssues(prev => prev.filter(issue => issue !== 'Low FPS'));
        }
        
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
      animationFrameRef.current = requestAnimationFrame(measureFPS);
    };
    
    animationFrameRef.current = requestAnimationFrame(measureFPS);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled]);
  
  // Memory usage measurement
  useEffect(() => {
    if (!enabled) return;
    
    const measureMemory = () => {
      if ('performance' in window && 'memory' in (performance as any)) {
        const memory = (performance as any).memory;
        const usedMemoryMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
        setMemoryUsage(usedMemoryMB);
        
        // Detect high memory usage
        if (usedMemoryMB > 100) {
          setPerformanceIssues(prev => {
            if (!prev.includes('High Memory Usage')) {
              console.warn(`Performance issue detected: High Memory Usage (${usedMemoryMB}MB)`);
              return [...prev, 'High Memory Usage'];
            }
            return prev;
          });
        } else {
          setPerformanceIssues(prev => prev.filter(issue => issue !== 'High Memory Usage'));
        }
      }
    };
    
    const memoryInterval = setInterval(measureMemory, 2000);
    return () => clearInterval(memoryInterval);
  }, [enabled]);
  
  // CPU usage measurement through task duration
  useEffect(() => {
    if (!enabled) return;
    
    const startTask = () => {
      taskStartTimeRef.current = performance.now();
    };
    
    const endTask = () => {
      const duration = performance.now() - taskStartTimeRef.current;
      taskDurationsRef.current.push(duration);
      
      // Keep the array at fixed size
      if (taskDurationsRef.current.length > MAX_TASK_DURATIONS) {
        taskDurationsRef.current.shift();
      }
      
      // Calculate average task duration as a proxy for CPU load
      if (taskDurationsRef.current.length > 5) {
        const avgDuration = taskDurationsRef.current.reduce((sum, val) => sum + val, 0) / 
                           taskDurationsRef.current.length;
        
        // Max frame time at 60fps is ~16.7ms
        // Using this to create a rough CPU usage percentage
        const estimatedCPUUsage = Math.min(100, Math.round((avgDuration / 16.7) * 60));
        setCpuUsage(estimatedCPUUsage);
        
        // Detect high CPU usage
        if (estimatedCPUUsage > 80) {
          setPerformanceIssues(prev => {
            if (!prev.includes('High CPU Usage')) {
              console.warn(`Performance issue detected: High CPU Usage (${estimatedCPUUsage}%)`);
              return [...prev, 'High CPU Usage'];
            }
            return prev;
          });
        } else {
          setPerformanceIssues(prev => prev.filter(issue => issue !== 'High CPU Usage'));
        }
      }
    };
    
    // Setup measurement of main thread task duration
    document.addEventListener('visibilitychange', startTask);
    window.addEventListener('resize', startTask);
    window.addEventListener('scroll', startTask);
    document.addEventListener('click', startTask);
    
    document.addEventListener('visibilitychange', endTask, { capture: true });
    window.addEventListener('resize', endTask, { capture: true });
    window.addEventListener('scroll', endTask, { capture: true });
    document.addEventListener('click', endTask, { capture: true });
    
    return () => {
      document.removeEventListener('visibilitychange', startTask);
      window.removeEventListener('resize', startTask);
      window.removeEventListener('scroll', startTask);
      document.removeEventListener('click', startTask);
      
      document.removeEventListener('visibilitychange', endTask, { capture: true });
      window.removeEventListener('resize', endTask, { capture: true });
      window.removeEventListener('scroll', endTask, { capture: true });
      document.removeEventListener('click', endTask, { capture: true });
    };
  }, [enabled]);
  
  // Log performance issues
  useEffect(() => {
    if (performanceIssues.length > 0) {
      console.warn('Performance issues detected:', performanceIssues);
    }
  }, [performanceIssues]);
  
  if (!enabled || !showInUI) {
    return null;
  }
  
  return (
    <div className="fixed bottom-16 right-2 bg-black/50 text-white p-2 rounded text-xs z-50">
      <div>FPS: {fps}</div>
      {(performance as any).memory && <div>Memory: {memoryUsage}MB</div>}
      <div>CPU: ~{cpuUsage}%</div>
      {performanceIssues.length > 0 && (
        <div className="text-red-300 mt-1">
          Issues: {performanceIssues.join(', ')}
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;
