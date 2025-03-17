
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
  const [isFocusing, setIsFocusing] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const iOSDetected = /ipad|iphone|ipod/i.test(userAgent);
    
    console.log("Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isIOS: iOSDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsIOS(iOSDetected);
  }, []);

  const stopCamera = useCallback(async () => {
    console.log("CameraView: stopCamera called, current stream:", !!streamRef.current);
    
    if (streamRef.current) {
      try {
        // First attempt to turn off the torch if it's enabled
        const videoTrack = streamRef.current.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities()?.torch && torchEnabled) {
          try {
            console.log("CameraView: Attempting to turn off torch before stopping stream");
            await videoTrack.applyConstraints({
              advanced: [{ torch: false }]
            });
            setTorchEnabled(false);
          } catch (err) {
            console.error("CameraView: Error turning off torch:", err);
          }
        }
        
        // Small delay to allow torch to turn off
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now stop all tracks
        streamRef.current.getTracks().forEach(track => {
          console.log(`CameraView: Stopping track: ${track.kind}`, {
            readyState: track.readyState,
            enabled: track.enabled
          });
          track.stop();
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        
        streamRef.current = null;
        setStream(null);
        retryAttemptsRef.current = 0;
        console.log("CameraView: Camera stream stopped successfully");
      } catch (err) {
        console.error("CameraView: Error stopping camera:", err);
      }
    } else {
      console.log("CameraView: No stream to stop");
    }
  }, [torchEnabled]);

  const startCamera = useCallback(async () => {
    console.log("CameraView: startCamera called, isMonitoring:", isMonitoring);
    
    if (!isMonitoring) {
      console.log("CameraView: Not monitoring, skipping camera start");
      return;
    }
    
    try {
      // Clean up any existing stream first
      await stopCamera();
      
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("getUserMedia no está soportado en este navegador");
        throw new Error("getUserMedia no está soportado");
      }

      // Configure camera based on device type
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 640 },  // Reduced for better performance
        height: { ideal: 480 }  // Reduced for better performance
      };

      if (isAndroid) {
        console.log("CameraView: Configurando para Android");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 15, max: 30 },  // Reduced for stability
        });
      } else if (isIOS) {
        console.log("CameraView: Configurando para iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
        });
      } else {
        console.log("CameraView: Configurando para escritorio");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Requesting camera with constraints:", JSON.stringify(constraints));
      
      // Request camera permission and stream
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: Camera stream obtained successfully");
      
      // Store the stream in ref to ensure we always have access to the current stream
      streamRef.current = newStream;
      setStream(newStream);
      
      const videoTrack = newStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error("No video track available");
      }

      console.log("CameraView: Video track details:", {
        label: videoTrack.label,
        constraints: videoTrack.getConstraints(),
        settings: videoTrack.getSettings()
      });

      // Wait for camera to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Apply optimizations after a brief delay to allow camera to stabilize
      setTimeout(async () => {
        if (!streamRef.current || !isMonitoring) return;
        
        const currentTrack = streamRef.current.getVideoTracks()[0];
        if (currentTrack) {
          try {
            const capabilities = currentTrack.getCapabilities();
            console.log("CameraView: Camera capabilities:", capabilities);
            
            // Only try to enable torch if it's available and monitoring is active
            if (capabilities.torch && isMonitoring) {
              try {
                console.log("CameraView: Attempting to enable torch");
                await currentTrack.applyConstraints({
                  advanced: [{ torch: true }]
                });
                setTorchEnabled(true);
                console.log("CameraView: Torch enabled successfully");
              } catch (torchErr) {
                console.error("CameraView: Error enabling torch:", torchErr);
                setTorchEnabled(false);
              }
            }
            
            // Apply other camera optimizations
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
              console.log("CameraView: Applying advanced camera constraints");
              await currentTrack.applyConstraints({
                advanced: advancedConstraints
              });
            }
          } catch (err) {
            console.error("CameraView: Error optimizing camera:", err);
          }
        }
      }, 1000);

      // Set video element properties
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.backfaceVisibility = 'hidden';
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.imageRendering = 'crisp-edges';
      }
      
      // Notify parent component that stream is ready
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      retryAttemptsRef.current = 0;
      setError(null);
      
    } catch (err) {
      console.error("CameraView: Error starting camera:", err);
      setError(`Error: ${err.message || "No se puede iniciar la cámara"}`);
      
      // Retry logic
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts && isMonitoring) {
        console.log(`CameraView: Retrying camera start (attempt ${retryAttemptsRef.current}/${maxRetryAttempts})`);
        setTimeout(startCamera, 1000);
      }
    }
  }, [isMonitoring, isAndroid, isIOS, stopCamera, onStreamReady]);

  // Monitor brightness to help with finger detection verification
  useEffect(() => {
    if (!stream || !videoRef.current || !isMonitoring) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 50;
    canvas.height = 50;

    const checkBrightness = () => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;
      
      try {
        ctx.drawImage(
          videoRef.current,
          0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight,
          0, 0, 50, 50
        );
        
        const imageData = ctx.getImageData(0, 0, 50, 50);
        const data = imageData.data;
        
        let totalBrightness = 0;
        // Sample every 16th pixel to improve performance
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalBrightness += (r + g + b) / 3;
        }
        
        const avgBrightness = totalBrightness / (data.length / 16);
        setBrightness(avgBrightness);
        
        if (Math.random() < 0.1) { // Log less frequently to reduce console spam
          console.log("CameraView: Brightness check", { 
            brightness: avgBrightness,
            fingerDetected: isFingerDetected,
            signalQuality,
            torchEnabled
          });
        }
      } catch (err) {
        console.error("CameraView: Error checking brightness:", err);
      }
    };

    const interval = setInterval(checkBrightness, 1000);
    return () => clearInterval(interval);
  }, [stream, isMonitoring, isFingerDetected, signalQuality]);

  // Handle monitoring state changes
  useEffect(() => {
    console.log("CameraView: Monitoring state changed:", { 
      isMonitoring, 
      hasStream: !!stream
    });
    
    if (isMonitoring && !stream) {
      startCamera();
    } else if (!isMonitoring && stream) {
      stopCamera();
    }
    
    // Clean up when component unmounts
    return () => {
      console.log("CameraView: Component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring, stream, startCamera, stopCamera]);

  // Determine if finger is likely present using both signal quality and brightness
  const isFingerLikelyPresent = isFingerDetected && (
    brightness < 60 || // Dark means finger is likely present
    signalQuality > 40 // Good quality signal confirms finger
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
          backfaceVisibility: 'hidden',
          imageRendering: 'crisp-edges'
        }}
      />
      
      {isMonitoring && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
          <Fingerprint
            size={48}
            className={`transition-colors duration-300 ${
              !isFingerLikelyPresent ? 'text-gray-400' :
              signalQuality > 75 ? 'text-green-500' :
              signalQuality > 50 ? 'text-yellow-500' :
              'text-red-500'
            }`}
          />
          <span className={`text-xs mt-2 transition-colors duration-300 ${
            isFingerLikelyPresent ? 'text-green-500' : 'text-gray-400'
          }`}>
            {isFingerLikelyPresent ? "dedo detectado" : "ubique su dedo en el lente"}
          </span>
          
          {error && (
            <div className="mt-2 text-red-500 text-xs max-w-[200px] text-center">
              {error}
            </div>
          )}
          
          <div className="mt-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
            {torchEnabled ? "📸 Flash ON" : "📸 Flash OFF"} • Q: {signalQuality}
          </div>
        </div>
      )}
    </>
  );
};

export default CameraView;
