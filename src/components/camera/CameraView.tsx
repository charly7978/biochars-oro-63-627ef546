
import React, { useRef, useEffect } from 'react';
import { usePlatformDetection } from './CameraUtils';
import { useCameraStream } from './useCameraStream';
import { CameraVideoElement } from './CameraVideoElement';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isAndroid, isWindows } = usePlatformDetection();
  
  const { 
    stream,
    startCamera, 
    stopCamera, 
    refreshAutoFocus,
    enableTorch
  } = useCameraStream({ onStreamReady, isMonitoring });

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring, stream, startCamera, stopCamera]);

  useEffect(() => {
    if (stream && isFingerDetected) {
      enableTorch();
      
      if (!isAndroid) {
        const focusInterval = setInterval(refreshAutoFocus, 5000);
        return () => clearInterval(focusInterval);
      }
    }
  }, [stream, isFingerDetected, enableTorch, refreshAutoFocus, isAndroid]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      videoRef.current.style.willChange = 'transform';
      videoRef.current.style.transform = 'translateZ(0)';
      videoRef.current.style.imageRendering = 'crisp-edges';
      
      videoRef.current.style.backfaceVisibility = 'hidden';
      videoRef.current.style.perspective = '1000px';
    } else if (videoRef.current && !stream) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  return (
    <CameraVideoElement 
      ref={videoRef} 
      signalQuality={signalQuality} 
      isAndroid={isAndroid} 
    />
  );
};

export default CameraView;
