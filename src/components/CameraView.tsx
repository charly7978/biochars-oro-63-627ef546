import React, { useRef, useEffect, useState, useCallback } from 'react';

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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;
  const streamRef = useRef<MediaStream | null>(null);
  const activeImageCaptureRef = useRef<ImageCapture | null>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const windowsDetected = /windows nt/i.test(userAgent);
    
    console.log("Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isWindows: windowsDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsWindows(windowsDetected);
  }, []);

  const stopCamera = async () => {
    console.log("CameraView: Stopping camera stream");
    
    // Clear the ImageCapture reference first to prevent future access attempts
    activeImageCaptureRef.current = null;
    
    if (streamRef.current) {
      console.log("CameraView: Stopping stream tracks");
      streamRef.current.getTracks().forEach(track => {
        try {
          if (track.kind === 'video' && track.readyState === 'live') {
            console.log("CameraView: Stopping video track", track.label);
            
            if (track.getCapabilities()?.torch) {
              try {
                track.applyConstraints({
                  advanced: [{ torch: false }]
                }).catch(err => console.log("Error turning off torch:", err));
              } catch (err) {
                console.log("Error with torch constraints:", err);
              }
            }
          }
          
          track.stop();
        } catch (err) {
          console.error("Error stopping track:", err);
        }
      });
      
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setStream(null);
    setTorchEnabled(false);
    retryAttemptsRef.current = 0;
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia not supported");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isWindows = /windows nt/i.test(navigator.userAgent);

      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (isAndroid) {
        console.log("Configuring for Android");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        });
      } else if (isIOS) {
        console.log("Configuring for iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        });
      } else if (isWindows) {
        console.log("Configuring for Windows with reduced resolution");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("Trying to access camera with configuration:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera initialized successfully");
      
      // Store in ref for consistent access
      streamRef.current = newStream;
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Camera capabilities:", capabilities);
          
          // Create ImageCapture once and store in ref
          activeImageCaptureRef.current = new ImageCapture(videoTrack);
          
          // Short delay to let camera initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Apply different optimizations based on platform
          if (isAndroid) {
            try {
              if (capabilities.torch) {
                console.log("Enabling torch on Android");
                await videoTrack.applyConstraints({
                  advanced: [{ torch: true }]
                });
                setTorchEnabled(true);
              }
            } catch (err) {
              console.error("Error enabling torch on Android:", err);
            }
          } else {
            // Apply camera optimizations
            const advancedConstraints: MediaTrackConstraintSet[] = [];
            
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
              console.log("Applying advanced configurations");
              try {
                await videoTrack.applyConstraints({
                  advanced: advancedConstraints
                });
              } catch (err) {
                console.log("Error applying advanced constraints:", err);
              }
            }

            // Enable torch for better PPG signal
            if (capabilities.torch) {
              console.log("Enabling torch for better PPG signal");
              try {
                await videoTrack.applyConstraints({
                  advanced: [{ torch: true }]
                });
                setTorchEnabled(true);
              } catch (err) {
                console.log("Error enabling torch:", err);
              }
            } else {
              console.log("Torch not available on this device");
            }
          }
          
          // Apply performance optimizations to video element
          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
            videoRef.current.style.imageRendering = 'crisp-edges';
          }
          
        } catch (err) {
          console.log("Couldn't apply some optimizations:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      retryAttemptsRef.current = 0;
      
    } catch (err) {
      console.error("Error starting camera:", err);
      
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`Retrying camera start (attempt ${retryAttemptsRef.current} of ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000);
      } else {
        console.error(`Reached maximum ${maxRetryAttempts} attempts without success`);
      }
    }
  };

  // Apply safe torch control with retries
  const ensureTorchEnabled = useCallback(async () => {
    if (!streamRef.current) return false;
    
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities()?.torch) return false;
    
    try {
      if (videoTrack.readyState !== 'live') {
        console.log("Track not live, cannot control torch");
        return false;
      }
      
      console.log("Ensuring torch is enabled");
      await videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      });
      setTorchEnabled(true);
      return true;
    } catch (err) {
      console.error("Error ensuring torch enabled:", err);
      return false;
    }
  }, []);

  // Refresh autofocus periodically
  const refreshAutoFocus = useCallback(async () => {
    if (!streamRef.current || isFocusing || isAndroid) return;
    
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities()?.focusMode) return;
    
    try {
      setIsFocusing(true);
      console.log("Refreshing auto-focus");
      
      await videoTrack.applyConstraints({
        advanced: [{ focusMode: 'manual' }]
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await videoTrack.applyConstraints({
        advanced: [{ focusMode: 'continuous' }]
      });
      
      console.log("Auto-focus refreshed successfully");
    } catch (err) {
      console.error("Error refreshing auto-focus:", err);
    } finally {
      setIsFocusing(false);
    }
  }, [isFocusing, isAndroid]);

  // Start/stop camera based on monitoring state
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
  }, [isMonitoring, stream]);

  // Keep torch enabled and refresh focus when finger is detected
  useEffect(() => {
    // Enable torch if finger detected but torch not enabled
    if (streamRef.current && isFingerDetected && !torchEnabled) {
      ensureTorchEnabled();
    }
    
    // Setup periodic focus refresh
    if (isFingerDetected && !isAndroid) {
      const focusInterval = setInterval(refreshAutoFocus, 5000);
      const torchInterval = setInterval(ensureTorchEnabled, 2000);
      
      return () => {
        clearInterval(focusInterval);
        clearInterval(torchInterval);
      };
    }
  }, [
    isFingerDetected, 
    torchEnabled, 
    refreshAutoFocus, 
    ensureTorchEnabled, 
    isAndroid
  ]);

  // Provide access to the ImageCapture instance for frame grabbing
  useEffect(() => {
    // Expose the ImageCapture accessor through window for emergency access
    (window as any).getActiveImageCapture = () => activeImageCaptureRef.current;
  }, []);

  const targetFrameInterval = isAndroid ? 1000/10 : 
                             signalQuality > 70 ? 1000/30 : 1000/15;

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
