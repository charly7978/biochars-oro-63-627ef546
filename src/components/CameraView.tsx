
import React, { useEffect } from 'react';
import { useCamera } from '@/hooks/useCamera';
import VideoStream from '@/components/camera/VideoStream';
import CameraError from '@/components/camera/CameraError';
import FingerDetector from '@/components/camera/FingerDetector';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
}: CameraViewProps) => {
  const {
    stream,
    cameraError,
    startCamera,
    stopCamera,
    cleanupCamera,
    setCameraError
  } = useCamera({ onStreamReady });

  // Handle starting/stopping camera based on isMonitoring
  useEffect(() => {
    console.log("CameraView: isMonitoring changed:", isMonitoring);
    
    if (isMonitoring && !stream) {
      console.log("CameraView: Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("CameraView: Stopping camera because isMonitoring=false");
      stopCamera();
    }
  }, [isMonitoring, stream, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("CameraView: Component unmounting");
      cleanupCamera();
    };
  }, [cleanupCamera]);

  const handleRetry = () => {
    setCameraError(null);
    startCamera();
  };

  return (
    <>
      <VideoStream stream={stream} />
      
      {cameraError && (
        <CameraError 
          errorMessage={cameraError} 
          onRetry={handleRetry} 
        />
      )}
      
      {isMonitoring && (
        <FingerDetector 
          isFingerDetected={isFingerDetected} 
          signalQuality={signalQuality} 
        />
      )}
    </>
  );
};

export default CameraView;
