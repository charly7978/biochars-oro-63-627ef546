
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Fingerprint } from 'lucide-react';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  
  // Function to safely disable torch
  const disableTorch = useCallback(async () => {
    if (!stream) return;
    
    try {
      console.log("CameraView: Attempting to disable torch");
      const videoTrack = stream.getVideoTracks()[0];
      
      if (videoTrack && videoTrack.enabled) {
        const capabilities = videoTrack.getCapabilities();
        
        if (capabilities?.torch) {
          await videoTrack.applyConstraints({
            advanced: [{ torch: false }]
          });
          console.log("CameraView: Torch disabled successfully");
        }
        
        setTorchEnabled(false);
      }
    } catch (err) {
      console.error("CameraView: Error disabling torch:", err);
    }
  }, [stream]);
  
  // Function to enable torch only when needed
  const enableTorch = useCallback(async () => {
    if (!stream || !torchAvailable || torchEnabled) return;
    
    try {
      console.log("CameraView: Attempting to enable torch");
      const videoTrack = stream.getVideoTracks()[0];
      
      if (videoTrack && videoTrack.enabled) {
        const capabilities = videoTrack.getCapabilities();
        
        if (capabilities?.torch) {
          await videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          });
          console.log("CameraView: Torch enabled successfully");
          setTorchEnabled(true);
        }
      }
    } catch (err) {
      console.error("CameraView: Error enabling torch:", err);
    }
  }, [stream, torchAvailable, torchEnabled]);
  
  // Stop camera and clean up
  const stopCamera = useCallback(async () => {
    try {
      console.log("CameraView: Stopping camera");
      
      // First explicitly disable torch
      await disableTorch();
      
      // Then stop all tracks
      if (stream) {
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.error("CameraView: Error stopping track:", e);
          }
        });
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      console.log("CameraView: Camera stopped successfully");
    } catch (err) {
      console.error("CameraView: Error stopping camera:", err);
    }
  }, [stream, disableTorch]);
  
  // Start camera and apply optimizations
  const startCamera = useCallback(async () => {
    if (stream) {
      console.log("CameraView: Camera already started");
      return;
    }
    
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia not supported");
      }
      
      console.log("CameraView: Starting camera");
      
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: Camera access granted");
      
      // Check torch capability
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities();
        console.log("CameraView: Camera capabilities", capabilities);
        
        if (capabilities?.torch) {
          setTorchAvailable(true);
          console.log("CameraView: Torch is available");
        } else {
          setTorchAvailable(false);
          console.log("CameraView: Torch is not available");
        }
        
        // Apply advanced constraints for better image
        try {
          const advancedConstraints: any[] = [];
          
          if (capabilities?.exposureMode) {
            advancedConstraints.push({ exposureMode: 'continuous' });
          }
          
          if (capabilities?.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
          }
          
          if (advancedConstraints.length > 0) {
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
          }
        } catch (err) {
          console.warn("CameraView: Error applying camera optimizations:", err);
        }
      }
      
      // Connect video element
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      
      setStream(newStream);
      
      // Notify parent component
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      console.log("CameraView: Camera started successfully");
    } catch (err) {
      console.error("CameraView: Error starting camera:", err);
    }
  }, [stream, onStreamReady]);
  
  // Handle monitoring state changes
  useEffect(() => {
    if (isMonitoring && !stream) {
      startCamera();
    } else if (!isMonitoring && stream) {
      stopCamera();
    }
  }, [isMonitoring, stream, startCamera, stopCamera]);
  
  // Handle finger detection for torch control
  useEffect(() => {
    if (isMonitoring && isFingerDetected && torchAvailable && !torchEnabled) {
      enableTorch();
    } else if ((!isMonitoring || !isFingerDetected) && torchEnabled) {
      disableTorch();
    }
  }, [isMonitoring, isFingerDetected, torchAvailable, torchEnabled, enableTorch, disableTorch]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      console.log("CameraView: Component unmounting, stopping camera");
      stopCamera();
    };
  }, [stopCamera]);
  
  // Determine finger status color
  const getFingerStatusColor = () => {
    if (!isFingerDetected) return 'text-gray-400';
    if (signalQuality > 75) return 'text-green-500';
    if (signalQuality > 50) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover"
        style={{
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          imageRendering: 'crisp-edges'
        }}
      />
      {isMonitoring && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
          <Fingerprint
            size={48}
            className={`transition-colors duration-300 ${getFingerStatusColor()}`}
          />
          <span className={`text-xs mt-2 transition-colors duration-300 ${
            isFingerDetected ? 'text-green-500' : 'text-gray-400'
          }`}>
            {isFingerDetected ? "dedo detectado" : "ubique su dedo en el lente"}
          </span>
        </div>
      )}
    </>
  );
};

export default CameraView;
