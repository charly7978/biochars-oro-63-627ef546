
import React, { useEffect, useState } from 'react';
import { Activity, Check, Zap } from 'lucide-react';
import TensorflowStatusIndicator from './TensorflowStatusIndicator';

interface VitalSignsPerformanceMetricsProps {
  className?: string;
  vitalSignsProcessor?: any;
}

const VitalSignsPerformanceMetrics: React.FC<VitalSignsPerformanceMetricsProps> = ({
  className = "",
  vitalSignsProcessor
}) => {
  const [metrics, setMetrics] = useState({
    fps: 0,
    processingTime: 0,
    signalQuality: 0,
    confidence: 0,
    tensorflowEnabled: false
  });
  
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    let frameCount = 0;
    let lastTimestamp = performance.now();
    let frameTimestamps: number[] = [];
    
    const calculateMetrics = () => {
      const now = performance.now();
      const elapsed = now - lastTimestamp;
      
      if (elapsed >= 1000) {
        // Calculate FPS
        const fps = Math.round((frameCount * 1000) / elapsed);
        
        // Calculate average processing time
        const avgProcessingTime = frameTimestamps.length > 0 
          ? frameTimestamps.reduce((sum, time) => sum + time, 0) / frameTimestamps.length 
          : 0;
        
        setMetrics(prev => ({
          ...prev,
          fps,
          processingTime: Math.round(avgProcessingTime * 100) / 100,
        }));
        
        frameCount = 0;
        frameTimestamps = [];
        lastTimestamp = now;
      }
    };
    
    const frameCallback = () => {
      frameCount++;
      
      const start = performance.now();
      // Simulate processing time measurement
      const end = performance.now();
      frameTimestamps.push(end - start);
      
      calculateMetrics();
      
      if (document.visibilityState === 'visible') {
        requestAnimationFrame(frameCallback);
      }
    };
    
    frameCallback();
    
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        lastTimestamp = performance.now();
        requestAnimationFrame(frameCallback);
      }
    };
    
    document.addEventListener('visibilitychange', visibilityHandler);
    
    return () => {
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, []);
  
  useEffect(() => {
    if (vitalSignsProcessor) {
      const tfInfo = vitalSignsProcessor.getTensorflowInfo?.();
      if (tfInfo) {
        setMetrics(prev => ({
          ...prev,
          tensorflowEnabled: tfInfo.initialized
        }));
      }
    }
  }, [vitalSignsProcessor]);
  
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };
  
  return (
    <div className={`fixed bottom-2 right-2 z-50 ${className}`}>
      <div 
        className="bg-gray-900/80 backdrop-blur-md rounded-lg shadow-lg overflow-hidden transition-all duration-300"
        style={{ 
          width: expanded ? '200px' : '48px',
          height: expanded ? 'auto' : '48px'
        }}
      >
        <button 
          className="w-12 h-12 flex items-center justify-center text-green-500"
          onClick={toggleExpanded}
        >
          <Activity className={`h-6 w-6 transition-transform duration-300 ${expanded ? 'rotate-0' : 'rotate-90'}`} />
        </button>
        
        {expanded && (
          <div className="p-3 pt-0">
            <div className="text-xs font-medium text-gray-400 mb-2">Performance</div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-gray-300 text-xs">
                  <Zap className="h-3 w-3 text-yellow-500" />
                  <span>FPS</span>
                </div>
                <div className="text-white text-xs font-medium">{metrics.fps}</div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-gray-300 text-xs">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>Processing</span>
                </div>
                <div className="text-white text-xs font-medium">{metrics.processingTime.toFixed(2)} ms</div>
              </div>
              
              <TensorflowStatusIndicator />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VitalSignsPerformanceMetrics;
