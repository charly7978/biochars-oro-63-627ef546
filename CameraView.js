
import React, { useRef, useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  buttonPosition 
}) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null); // Add ref to track stream across renders
  const [brightnessSamples, setBrightnessSamples] = useState([]);
  const [avgBrightness, setAvgBrightness] = useState(0);
  const brightnessSampleLimit = 10;
  const retryAttemptsRef = useRef(0);
  const maxRetryAttempts = 5;
  const torchEnabledRef = useRef(false);

  // Enhanced camera stopping with explicit error handling
  const stopCamera = async () => {
    console.log("CameraView: Stopping camera");
    try {
      if (streamRef.current) {
        console.log("CameraView: Stopping stream tracks");
        
        const tracks = streamRef.current.getTracks();
        for (const track of tracks) {
          try {
            if (track.readyState === 'live') {
              console.log(`CameraView: Stopping track: ${track.kind}`);
              
              // Disable torch before stopping if available
              if (track.kind === 'video' && torchEnabledRef.current) {
                try {
                  console.log("CameraView: Disabling torch before stopping track");
                  await track.applyConstraints({
                    advanced: [{ torch: false }]
                  });
                  torchEnabledRef.current = false;
                } catch (torchErr) {
                  console.log("CameraView: Error disabling torch:", torchErr);
                }
              }
              
              track.stop();
            }
          } catch (trackErr) {
            console.error(`CameraView: Error stopping track ${track.kind}:`, trackErr);
          }
        }
        
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      retryAttemptsRef.current = 0;
    } catch (err) {
      console.error("CameraView: Error in stopCamera:", err);
    }
  };

  // Enhanced camera startup with platform-specific optimizations
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      console.log("CameraView: Attempting to start camera");
      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isWindows = /windows/i.test(navigator.userAgent);

      // Platform-specific configuration
      let baseVideoConstraints = {
        facingMode: 'environment',
        width: { ideal: 640 }, // Lower default resolution
        height: { ideal: 480 }
      };

      if (isAndroid) {
        baseVideoConstraints = {
          ...baseVideoConstraints,
          width: { ideal: 640 }, // Lower resolution for Android
          height: { ideal: 480 },
          frameRate: { ideal: 15 } // Lower framerate for Android
        };
        console.log("CameraView: Using Android configuration");
      } else if (isIOS) {
        baseVideoConstraints = {
          ...baseVideoConstraints,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        };
        console.log("CameraView: Using iOS configuration");
      } else if (isWindows) {
        baseVideoConstraints = {
          ...baseVideoConstraints,
          width: { ideal: 640 }, // Lower resolution for Windows
          height: { ideal: 480 },
          frameRate: { ideal: 15 } // Lower framerate for Windows
        };
        console.log("CameraView: Using Windows configuration");
      }

      const constraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Requesting camera with constraints:", JSON.stringify(constraints));
      
      // Try to get the stream with a timeout
      const streamPromise = navigator.mediaDevices.getUserMedia(constraints);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Camera request timed out")), 10000);
      });
      
      const newStream = await Promise.race([streamPromise, timeoutPromise]);
      console.log("CameraView: Camera access granted");
      
      // Store in both state and ref for consistent access
      setStream(newStream);
      streamRef.current = newStream;
      
      const videoTrack = newStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error("No video track available");
      }

      console.log("CameraView: Got video track:", videoTrack.label);
      
      // Apply platform-specific optimizations
      try {
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          
          // Apply GPU acceleration and other optimizations
          videoRef.current.style.transform = 'translateZ(0)';
          videoRef.current.style.backfaceVisibility = 'hidden';
          videoRef.current.style.willChange = 'transform';
        }
        
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
            torchEnabledRef.current = true;
            console.log("CameraView: Torch enabled successfully");
          } catch (torchErr) {
            console.log("CameraView: Error enabling torch:", torchErr);
          }
        } else {
          console.log("CameraView: Torch not available on this device");
        }
        
        // Try to optimize focus and exposure
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
      
      // Implement retry mechanism
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`CameraView: Retrying camera start (${retryAttemptsRef.current}/${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000);
      } else {
        console.error(`CameraView: Failed to start camera after ${maxRetryAttempts} attempts`);
      }
    }
  };

  // Monitor camera brightness to help with finger detection verification
  useEffect(() => {
    if (!streamRef.current || !videoRef.current || !isMonitoring) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 100;
    canvas.height = 100;

    const checkBrightness = () => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;
      
      try {
        ctx.drawImage(
          videoRef.current,
          0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight,
          0, 0, 100, 100
        );
        
        const imageData = ctx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        
        let brightness = 0;
        // Sample every 4th pixel to improve performance
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          brightness += (r + g + b) / 3;
        }
        
        brightness /= (data.length / 16);
        
        setBrightnessSamples(prev => {
          const newSamples = [...prev, brightness];
          if (newSamples.length > brightnessSampleLimit) {
            newSamples.shift();
          }
          return newSamples;
        });

        const avgBrightness = brightnessSamples.reduce((sum, val) => sum + val, 0) / 
                            Math.max(1, brightnessSamples.length);
        setAvgBrightness(avgBrightness);
        
        // Ensure torch stays on
        if (isMonitoring && streamRef.current) {
          const videoTrack = streamRef.current.getVideoTracks()[0];
          if (videoTrack && videoTrack.getCapabilities?.()?.torch && !torchEnabledRef.current) {
            videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            }).then(() => {
              torchEnabledRef.current = true;
            }).catch(err => {
              console.log("Error re-enabling torch:", err);
            });
          }
        }
      } catch (err) {
        console.error("Error checking brightness:", err);
      }
    };

    const interval = setInterval(checkBrightness, 500);
    return () => clearInterval(interval);
  }, [streamRef.current, isMonitoring, isFingerDetected, signalQuality, brightnessSamples]);

  // Start/stop camera based on monitoring state
  useEffect(() => {
    console.log("CameraView: isMonitoring changed:", isMonitoring);
    
    if (isMonitoring && !stream) {
      startCamera();
    } else if (!isMonitoring && stream) {
      stopCamera();
    }
    
    // Cleanup on unmount
    return () => {
      console.log("CameraView component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring]);

  // Determine actual finger status using both provided detection and brightness
  const actualFingerStatus = isFingerDetected || (
    avgBrightness < 60 // Dark means finger is likely present
  );

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
          backfaceVisibility: 'hidden'
        }}
      />
      {isMonitoring && buttonPosition && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
          <Fingerprint
            size={48}
            className={`transition-colors duration-300 ${
              !actualFingerStatus ? 'text-gray-400' :
              signalQuality > 75 ? 'text-green-500' :
              signalQuality > 50 ? 'text-yellow-500' :
              'text-red-500'
            }`}
          />
          <span className={`text-xs mt-2 transition-colors duration-300 ${
            actualFingerStatus ? 'text-green-500' : 'text-gray-400'
          }`}>
            {actualFingerStatus ? "dedo detectado" : "ubique su dedo en el lente"}
          </span>
        </div>
      )}
    </>
  );
};

export default CameraView;
