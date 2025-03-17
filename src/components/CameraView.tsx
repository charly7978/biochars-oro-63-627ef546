
import React, { useRef, useEffect, useState, useCallback } from 'react';

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
  const streamRef = useRef<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;

  // Check platform on mount
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsAndroid(/android/i.test(userAgent));
    
    console.log("CameraView: Platform detection", {
      userAgent,
      isAndroid: /android/i.test(userAgent),
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
  }, []);

  // Disable torch when component unmounts
  useEffect(() => {
    return () => {
      console.log("CameraView: Component unmounting, disabling torch");
      disableTorch();
    };
  }, []);

  // Disable torch function
  const disableTorch = useCallback(() => {
    if (!streamRef.current) return;
    
    try {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        if (track.getCapabilities()?.torch) {
          console.log("CameraView: Explicitly turning off torch");
          track.applyConstraints({
            advanced: [{ torch: false }]
          }).catch(err => console.error("Error turning off torch:", err));
        }
      });
      setTorchEnabled(false);
    } catch (err) {
      console.error("Error disabling torch:", err);
    }
  }, []);

  // Enable torch function
  const enableTorch = useCallback(() => {
    if (!streamRef.current) return;
    
    try {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        if (track.getCapabilities()?.torch) {
          console.log("CameraView: Enabling torch");
          track.applyConstraints({
            advanced: [{ torch: true }]
          }).then(() => {
            setTorchEnabled(true);
          }).catch(err => console.error("Error enabling torch:", err));
        }
      });
    } catch (err) {
      console.error("Error enabling torch:", err);
    }
  }, []);

  // Stop camera function
  const stopCamera = useCallback(async () => {
    if (!streamRef.current) return;
    
    console.log("CameraView: Stopping camera");
    
    // First, turn off the torch
    await disableTorch();
    
    // Then stop all tracks
    streamRef.current.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (err) {
        console.error("Error stopping track:", err);
      }
    });
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    streamRef.current = null;
    retryAttemptsRef.current = 0;
  }, [disableTorch]);

  // Start camera function
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      console.log("CameraView: Camera already started");
      return;
    }
    
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia not supported");
      }

      console.log("CameraView: Starting camera");
      
      // Video constraints
      const videoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: isAndroid ? 1280 : 1920 },
        height: { ideal: isAndroid ? 720 : 1080 },
        frameRate: { ideal: isAndroid ? 30 : 60 }
      };

      // Request camera access
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
      
      // Store stream in ref
      streamRef.current = newStream;
      
      // Apply camera optimizations
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("CameraView: Camera capabilities", capabilities);
          
          // Apply advanced constraints
          const advancedConstraints = [];
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ exposureMode: 'continuous' });
          }
          
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
          }
          
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
          }
          
          if (advancedConstraints.length > 0) {
            console.log("CameraView: Applying advanced constraints", advancedConstraints);
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
          }
          
          // Enable torch for better signal
          if (capabilities.torch) {
            await videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            });
            setTorchEnabled(true);
            console.log("CameraView: Torch enabled");
          } else {
            console.log("CameraView: Torch not available");
          }
        } catch (err) {
          console.warn("CameraView: Error applying optimizations", err);
        }
      }

      // Set video source
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.style.transform = 'translateZ(0)';
      }
      
      // Notify parent
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      console.log("CameraView: Camera started successfully");
      retryAttemptsRef.current = 0;
      
    } catch (err) {
      console.error("CameraView: Error starting camera", err);
      
      // Auto-retry
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`CameraView: Retrying (${retryAttemptsRef.current}/${maxRetryAttempts})`);
        setTimeout(startCamera, 1000);
      }
    }
  }, [isAndroid, onStreamReady]);

  // Handle monitoring state changes
  useEffect(() => {
    if (isMonitoring && !streamRef.current) {
      startCamera();
    } else if (!isMonitoring && streamRef.current) {
      stopCamera();
    }
    
    // Clean up on unmount
    return () => {
      if (streamRef.current) {
        stopCamera();
      }
    };
  }, [isMonitoring, startCamera, stopCamera]);

  // Handle finger detection for torch control
  useEffect(() => {
    if (!streamRef.current) return;
    
    if (isFingerDetected && !torchEnabled) {
      enableTorch();
    }
  }, [isFingerDetected, torchEnabled, enableTorch]);

  return (
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
  );
};

export default CameraView;
