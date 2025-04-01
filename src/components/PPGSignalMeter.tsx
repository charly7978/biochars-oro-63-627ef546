import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera } from 'react-camera-pro';
import { useInterval } from '@uidotdev/usehooks';
import { useHeartbeatFeedback } from '../hooks/useHeartbeatFeedback';
import { useSignalProcessor } from '../hooks/useSignalProcessor';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { ProcessedSignal } from '../types/signal';
import { calculateSignalQuality } from '../modules/heart-beat/signal-quality';

interface PPGSignalMeterProps {
  isMeasuring: boolean;
  onSignalDetected: (signal: ProcessedSignal | null) => void;
  hapticFeedback: boolean;
  audioFeedback: boolean;
  onCameraError: (error: string) => void;
}

const PPGSignalMeter: React.FC<PPGSignalMeterProps> = ({
  isMeasuring,
  onSignalDetected,
  hapticFeedback,
  audioFeedback,
  onCameraError
}) => {
  const [cameraResolution, setCameraResolution] = useState({ width: 256, height: 256 });
  const camera = useRef<Camera>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [lastImageData, setLastImageData] = useState<ImageData | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  
  const { 
    isProcessing,
    lastSignal: processedSignal,
    error: processingError,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame
  } = useSignalProcessor();
  
  // Fix for feedback trigger error
  const { trigger, updateSignalQuality } = useHeartbeatFeedback({
    enabled: isMeasuring,
    hapticEnabled: hapticFeedback,
    audioEnabled: audioFeedback,
    bpm: processedSignal?.heartRate || 0,
    signalQuality: processedSignal?.quality || 0,
    isFingerDetected: processedSignal?.fingerDetected || false,
    motionDetected: processedSignal?.motionDetected || false,
    motionCompensationActive: processedSignal?.motionCompensated || false
  });
  
  const { playHaptic } = useHapticFeedback();
  const { playAudio } = useAudioFeedback();
  
  // Interval to process camera frames
  useInterval(() => {
    if (isMeasuring && camera.current && isCameraActive) {
      camera.current.takePhoto()
        .then(imageData => {
          setLastImageData(imageData);
          processFrame(imageData);
        })
        .catch(error => {
          console.error("PPGSignalMeter: Error taking photo:", error);
          setCameraError("Error al tomar la foto: " + error.message);
          onCameraError("Error al tomar la foto: " + error.message);
        });
    }
  }, isMeasuring && isCameraActive ? 100 : null);
  
  // Start/stop processing based on isMeasuring prop
  useEffect(() => {
    if (isMeasuring) {
      startProcessing();
      setCameraError(null);
    } else {
      stopProcessing();
    }
  }, [isMeasuring, startProcessing, stopProcessing]);
  
  // Handle camera errors
  const handleCameraError = useCallback((error: string) => {
    console.error("PPGSignalMeter: Camera error:", error);
    setCameraError("Error de cámara: " + error);
    onCameraError("Error de cámara: " + error);
  }, [onCameraError]);
  
  // Camera permission handling
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(permissionStatus.state === 'granted');
        
        if (permissionStatus.state === 'prompt') {
          // If permission is prompt, try to activate the camera to trigger the permission request
          if (camera.current) {
            camera.current.start().then(() => {
              setIsCameraActive(true);
            }).catch(err => {
              console.error("PPGSignalMeter: Camera permission denied or error:", err);
              setCameraPermission(false);
              setCameraError("Permiso de cámara denegado o error: " + err.message);
              onCameraError("Permiso de cámara denegado o error: " + err.message);
            });
          }
        } else if (permissionStatus.state !== 'granted') {
          setCameraError("Permiso de cámara denegado");
          onCameraError("Permiso de cámara denegado");
        }
      } catch (err) {
        console.error("PPGSignalMeter: Error checking camera permission:", err);
        setCameraPermission(false);
        setCameraError("Error al verificar el permiso de la cámara: " + err.message);
        onCameraError("Error al verificar el permiso de la cámara: " + err.message);
      }
    };
    
    checkCameraPermission();
  }, [onCameraError]);
  
  // Pass signal to parent component
  useEffect(() => {
    onSignalDetected(processedSignal);
  }, [processedSignal, onSignalDetected]);

  useEffect(() => {
    // Update signal quality (fix for the error)
    if (processedSignal?.quality !== undefined) {
      updateSignalQuality(processedSignal.quality); // This is now a function call, not a component
    }
    
    // Trigger haptic and audio feedback
    if (processedSignal?.fingerDetected && processedSignal?.quality > 20) {
      trigger();
    }
  }, [processedSignal, trigger, updateSignalQuality]);
  
  return (
    <div style={{ position: 'relative', width: cameraResolution.width, height: cameraResolution.height }}>
      {cameraPermission === false && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 10
        }}>
          <p>Se requiere permiso de cámara. Por favor, habilita el acceso a la cámara en la configuración del navegador.</p>
        </div>
      )}
      
      {cameraError && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 10
        }}>
          <p>{cameraError}</p>
        </div>
      )}
      
      <Camera
        ref={camera}
        resolution={cameraResolution}
        facingMode="environment"
        className="camera-pro"
        onCameraError={handleCameraError}
        onReady={() => setIsCameraActive(true)}
        style={{
          width: cameraResolution.width,
          height: cameraResolution.height,
          objectFit: 'cover',
          display: cameraPermission === false || cameraError ? 'none' : 'block'
        }}
      />
    </div>
  );
};

export default PPGSignalMeter;
