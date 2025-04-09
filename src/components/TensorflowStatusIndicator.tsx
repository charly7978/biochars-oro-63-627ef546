
import React, { useEffect, useState } from 'react';
import { Cpu, Activity, AlertCircle } from 'lucide-react';
import { tensorflowService } from '../core/tensorflow/TensorflowService';

interface TensorflowStatusIndicatorProps {
  className?: string;
}

const TensorflowStatusIndicator: React.FC<TensorflowStatusIndicatorProps> = ({ 
  className = "" 
}) => {
  const [backendInfo, setBackendInfo] = useState({
    initialized: false,
    backend: 'none',
    memoryInfo: null
  });
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    
    const initialize = async () => {
      setIsLoading(true);
      try {
        await tensorflowService.initialize();
        if (mounted) {
          setBackendInfo(tensorflowService.getBackendInfo());
        }
      } catch (error) {
        console.error('Failed to initialize TensorFlow', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    initialize();
    
    const intervalId = setInterval(() => {
      if (mounted) {
        setBackendInfo(tensorflowService.getBackendInfo());
      }
    }, 5000);
    
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);
  
  const getStatusColor = () => {
    if (isLoading) return 'text-yellow-500';
    if (!backendInfo.initialized) return 'text-red-500';
    
    switch (backendInfo.backend) {
      case 'webgl':
      case 'webgpu':
        return 'text-green-500';
      case 'cpu':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };
  
  const getStatusIcon = () => {
    if (isLoading) return <Activity className="h-4 w-4 animate-pulse" />;
    if (!backendInfo.initialized) return <AlertCircle className="h-4 w-4" />;
    
    return <Cpu className="h-4 w-4" />;
  };
  
  const getStatusText = () => {
    if (isLoading) return 'Initializing...';
    if (!backendInfo.initialized) return 'Not available';
    
    return `${backendInfo.backend.toUpperCase()}`;
  };
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs ${getStatusColor()} bg-gray-800/50 ${className}`}>
      {getStatusIcon()}
      <span>TF: {getStatusText()}</span>
    </div>
  );
};

export default TensorflowStatusIndicator;
