
import React, { useEffect } from 'react';
import VideoStream from '@/components/camera/VideoStream';
import CameraError from '@/components/camera/CameraError';
import FingerDetector from '@/components/camera/FingerDetector';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  calibrationProgress?: number;
  isCalibrating?: boolean;
  arrhythmiaCalibrationProgress?: number;
  isArrhythmiaCalibrating?: boolean;
}

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  calibrationProgress = 0,
  isCalibrating = false,
  arrhythmiaCalibrationProgress = 0,
  isArrhythmiaCalibrating = false
}: CameraViewProps) => {
  // Create a state for the stream
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  // Handle starting camera when monitoring changes
  useEffect(() => {
    console.log('CameraView: isMonitoring changed:', isMonitoring);
    
    if (isMonitoring) {
      startCamera();
    } else if (stream) {
      stopCamera();
    }
    
    return () => {
      if (stream) {
        stopCamera();
      }
    };
  }, [isMonitoring]);

  const startCamera = async () => {
    console.log('CameraView: Starting camera');
    setCameraError(null);
    
    try {
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('CameraView: Camera started successfully');
      setStream(mediaStream);
      
      // Enable torch if available
      try {
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities && videoTrack.getCapabilities().torch) {
          await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
          console.log('CameraView: Torch enabled');
        }
      } catch (torchErr) {
        console.log('CameraView: Failed to enable torch:', torchErr);
      }
      
      if (onStreamReady) {
        onStreamReady(mediaStream);
      }
    } catch (err) {
      console.error('CameraView: Error starting camera:', err);
      
      let errorMessage = 'No se pudo acceder a la cámara.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Permiso de cámara denegado. Por favor permita el acceso a la cámara.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No se encontró ninguna cámara en este dispositivo.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'La cámara está siendo utilizada por otra aplicación.';
        }
      }
      
      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    console.log('CameraView: Stopping camera');
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
  };

  const handleRetry = () => {
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
          calibrationProgress={calibrationProgress}
          isCalibrating={isCalibrating}
          arrhythmiaCalibrationProgress={arrhythmiaCalibrationProgress}
          isArrhythmiaCalibrating={isArrhythmiaCalibrating}
        />
      )}
    </>
  );
};

export default CameraView;
