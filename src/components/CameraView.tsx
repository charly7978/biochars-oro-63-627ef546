
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Fingerprint } from 'lucide-react';

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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 5;
  const streamRef = useRef<MediaStream | null>(null);
  const activeImageCaptureRef = useRef<ImageCapture | null>(null);
  const cameraStartedRef = useRef<boolean>(false);

  // Detect platform on mount
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const windowsDetected = /windows nt/i.test(userAgent);
    
    console.log("CameraView: Detected platform", {
      userAgent,
      isAndroid: androidDetected,
      isWindows: windowsDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsWindows(windowsDetected);
  }, []);

  // Robust camera stopping
  const stopCamera = useCallback(async () => {
    console.log("CameraView: Stopping camera stream");
    
    // Clear the ImageCapture reference first
    activeImageCaptureRef.current = null;
    
    if (streamRef.current) {
      console.log("CameraView: Stopping stream tracks");
      streamRef.current.getTracks().forEach(track => {
        try {
          if (track.kind === 'video' && track.readyState === 'live') {
            console.log("CameraView: Stopping video track", track.label);
            
            // Try to turn off torch before stopping
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
    cameraStartedRef.current = false;
    retryAttemptsRef.current = 0;
    
  }, []);

  // Optimized camera startup with platform-specific settings
  const startCamera = useCallback(async () => {
    if (cameraStartedRef.current) {
      console.log("CameraView: Camera already starting/started");
      return;
    }
    
    cameraStartedRef.current = true;
    setCameraError(null);
    
    try {
      console.log("CameraView: Starting camera");
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia not supported on this device");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isWindows = /windows nt/i.test(navigator.userAgent);

      // Configure constraints based on platform
      let videoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
      };

      if (isAndroid) {
        console.log("CameraView: Using Android configuration");
        videoConstraints = {
          ...videoConstraints,
          width: { ideal: 640 }, // Lower resolution for Android
          height: { ideal: 480 },
          frameRate: { ideal: 15 } // Lower framerate for Android
        };
      } else if (isIOS) {
        console.log("CameraView: Using iOS configuration");
        videoConstraints = {
          ...videoConstraints,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        };
      } else if (isWindows) {
        console.log("CameraView: Using Windows configuration");
        videoConstraints = {
          ...videoConstraints,
          width: { ideal: 640 }, // Lower resolution for Windows
          height: { ideal: 480 },
          frameRate: { ideal: 15 } // Lower framerate for Windows
        };
      } else {
        console.log("CameraView: Using default configuration");
        videoConstraints = {
          ...videoConstraints,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        };
      }

      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: false
      };

      console.log("CameraView: Requesting camera with constraints:", JSON.stringify(constraints));
      
      // Set a timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        if (!streamRef.current) {
          console.error("CameraView: Camera request timed out");
          setCameraError("Camera request timed out. Please check camera permissions and try again.");
          cameraStartedRef.current = false;
          retryCamera();
        }
      }, 10000);
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      clearTimeout(timeoutId);
      
      console.log("CameraView: Camera access granted");
      
      // Store in both state and ref for consistent access
      setStream(newStream);
      streamRef.current = newStream;
      
      const videoTrack = newStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error("No video track available");
      }

      console.log("CameraView: Got video track:", videoTrack.label);
      
      // Apply optimizations once the track is ready
      try {
        // Create ImageCapture once and store in ref
        activeImageCaptureRef.current = new ImageCapture(videoTrack);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          
          // Apply GPU acceleration and other optimizations
          videoRef.current.style.transform = 'translateZ(0)';
          videoRef.current.style.backfaceVisibility = 'hidden';
          videoRef.current.style.willChange = 'transform';
        }
        
        // Short delay to let camera initialize
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get track capabilities for optimization
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        console.log("CameraView: Track capabilities:", capabilities);
        
        // Enable torch for better visibility
        if (capabilities.torch) {
          console.log("CameraView: Enabling torch");
          try {
            await videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            });
            setTorchEnabled(true);
            console.log("CameraView: Torch enabled successfully");
          } catch (torchErr) {
            console.log("CameraView: Error enabling torch:", torchErr);
          }
        } else {
          console.log("CameraView: Torch not available on this device");
        }
        
        // Apply different optimizations based on platform
        if (!isAndroid) {
          // Try to optimize focus and exposure for non-Android
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            try {
              await videoTrack.applyConstraints({
                advanced: [{ focusMode: 'continuous' }]
              });
              console.log("CameraView: Continuous focus applied");
            } catch (focusErr) {
              console.log("CameraView: Error setting focus mode:", focusErr);
            }
          }
          
          if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
            try {
              await videoTrack.applyConstraints({
                advanced: [{ exposureMode: 'continuous' }]
              });
              console.log("CameraView: Continuous exposure applied");
            } catch (expErr) {
              console.log("CameraView: Error setting exposure mode:", expErr);
            }
          }
        }
      } catch (optErr) {
        console.error("CameraView: Error applying optimizations:", optErr);
        // Continue even if optimizations fail
      }
      
      if (onStreamReady) {
        console.log("CameraView: Calling onStreamReady callback");
        onStreamReady(newStream);
      }
      
      retryAttemptsRef.current = 0;
      
    } catch (err) {
      console.error("CameraView: Error starting camera:", err);
      
      const errorMessage = err instanceof Error ? err.message : "Unknown camera error";
      setCameraError(`Camera error: ${errorMessage}`);
      
      // Implement retry logic
      retryCamera();
    }
  }, [onStreamReady]);
  
  // Retry camera startup
  const retryCamera = useCallback(() => {
    cameraStartedRef.current = false;
    retryAttemptsRef.current++;
    if (retryAttemptsRef.current <= maxRetryAttempts) {
      console.log(`CameraView: Retrying camera start (${retryAttemptsRef.current}/${maxRetryAttempts})...`);
      setTimeout(startCamera, 1000);
    } else {
      console.error(`CameraView: Failed to start camera after ${maxRetryAttempts} attempts`);
    }
  }, [startCamera, maxRetryAttempts]);

  // Ensure torch stays on
  const ensureTorchEnabled = useCallback(async () => {
    if (!streamRef.current) return false;
    
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities()?.torch) return false;
    
    try {
      if (videoTrack.readyState !== 'live') {
        console.log("CameraView: Track not live, cannot control torch");
        return false;
      }
      
      console.log("CameraView: Ensuring torch is enabled");
      await videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      });
      setTorchEnabled(true);
      return true;
    } catch (err) {
      console.error("CameraView: Error ensuring torch enabled:", err);
      return false;
    }
  }, []);

  // Start/stop camera based on monitoring state
  useEffect(() => {
    console.log("CameraView: isMonitoring changed:", isMonitoring);
    
    if (isMonitoring && !stream) {
      console.log("CameraView: Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("CameraView: Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    // Cleanup on unmount
    return () => {
      console.log("CameraView: Component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring, stream, startCamera, stopCamera]);

  // Periodic torch check
  useEffect(() => {
    if (!isMonitoring || !streamRef.current) return;
    
    const torchInterval = setInterval(() => {
      ensureTorchEnabled();
    }, 2000);
    
    return () => {
      clearInterval(torchInterval);
    };
  }, [isMonitoring, ensureTorchEnabled]);

  // Provide access to the ImageCapture instance for frame grabbing
  useEffect(() => {
    // Expose the ImageCapture accessor through window for emergency access
    (window as any).getActiveImageCapture = () => activeImageCaptureRef.current;
    
    return () => {
      (window as any).getActiveImageCapture = null;
    };
  }, []);

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
      
      {cameraError && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white p-4 z-10">
          <div className="max-w-md text-center">
            <h3 className="text-xl font-bold mb-2">Error de cámara</h3>
            <p>{cameraError}</p>
            <button 
              onClick={() => {
                setCameraError(null);
                startCamera();
              }}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
      
      {isMonitoring && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
          <Fingerprint
            size={48}
            className={`transition-colors duration-300 ${
              !isFingerDetected ? 'text-gray-400' :
              signalQuality > 75 ? 'text-green-500' :
              signalQuality > 50 ? 'text-yellow-500' :
              'text-red-500'
            }`}
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
