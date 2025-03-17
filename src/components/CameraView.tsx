
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Fingerprint } from 'lucide-react';
import { toast } from 'sonner';

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
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 5;
  const streamRef = useRef<MediaStream | null>(null);
  const activeImageCaptureRef = useRef<ImageCapture | null>(null);
  const cameraStartTimeoutRef = useRef<number | null>(null);
  const permissionRequestedRef = useRef<boolean>(false);
  const permissionRequestInProgressRef = useRef<boolean>(false);
  const cameraStartAttemptedRef = useRef<boolean>(false);

  // Request permissions explicitly before accessing the camera
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    if (permissionRequestInProgressRef.current) {
      console.log("CameraView: Permission request already in progress");
      return false;
    }
    
    permissionRequestInProgressRef.current = true;
    console.log("CameraView: Starting permission request");
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Tu navegador no soporta acceso a la cámara");
      permissionRequestInProgressRef.current = false;
      return false;
    }

    try {
      console.log("CameraView: Requesting camera permission explicitly");
      
      // Try to get a minimal video stream just to trigger the permission dialog
      const permissionStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      
      console.log("CameraView: Permission granted, obtained test stream");
      
      // Stop the permission test stream immediately
      permissionStream.getTracks().forEach(track => track.stop());
      permissionRequestedRef.current = true;
      permissionRequestInProgressRef.current = false;
      return true;
    } catch (err) {
      console.error("Error requesting camera permission:", err);
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setCameraError(`No se pudo acceder a la cámara: ${errorMessage}`);
      toast.error(`Error de cámara: ${errorMessage}`);
      permissionRequestInProgressRef.current = false;
      return false;
    }
  }, []);

  // Robust camera stopping
  const stopCamera = useCallback(async () => {
    console.log("CameraView: Stopping camera stream");
    
    // Clear any pending timeouts
    if (cameraStartTimeoutRef.current) {
      clearTimeout(cameraStartTimeoutRef.current);
      cameraStartTimeoutRef.current = null;
    }
    
    // Clear the ImageCapture reference first
    activeImageCaptureRef.current = null;
    
    if (streamRef.current) {
      console.log("CameraView: Stopping stream tracks");
      streamRef.current.getTracks().forEach(track => {
        try {
          if (track.kind === 'video' && track.readyState === 'live') {
            console.log("CameraView: Stopping video track", track.label);
            
            // Try to turn off torch before stopping
            if ('getCapabilities' in track && track.getCapabilities()?.torch) {
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
    cameraStartAttemptedRef.current = false;
    
  }, []);

  // Optimized camera startup with fallbacks
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      console.log("CameraView: Camera already started");
      return;
    }
    
    if (cameraStartAttemptedRef.current) {
      console.log("CameraView: Camera start already attempted");
      return;
    }
    
    cameraStartAttemptedRef.current = true;
    
    setCameraError(null);
    console.log("CameraView: Starting camera with optimized settings");
    
    // Request permissions first if not already requested
    if (!permissionRequestedRef.current) {
      const permissionGranted = await requestCameraPermission();
      if (!permissionGranted) {
        toast.error("No se pudo acceder a la cámara. Por favor, verifica los permisos.");
        cameraStartAttemptedRef.current = false;
        return;
      }
    }
    
    // Set a timeout to prevent hanging
    if (cameraStartTimeoutRef.current) {
      clearTimeout(cameraStartTimeoutRef.current);
    }
    
    cameraStartTimeoutRef.current = window.setTimeout(() => {
      if (!streamRef.current) {
        console.error("CameraView: Camera request timed out");
        setCameraError("Tiempo de espera agotado. Por favor intente de nuevo.");
        cameraStartAttemptedRef.current = false;
        retryCamera();
      }
    }, 10000) as unknown as number;
    
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado en este dispositivo");
      }

      // Try different configurations in sequence if needed
      const configurations = [
        // First try: Basic configuration with environment camera
        {
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        },
        // Second try: Environment camera with lower resolution
        {
          video: {
            facingMode: 'environment',
            width: { ideal: 320 },
            height: { ideal: 240 }
          },
          audio: false
        },
        // Third try: User camera (front)
        {
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        },
        // Last resort: Just any video
        {
          video: true,
          audio: false
        }
      ];
      
      // Try each configuration until one works
      let newStream: MediaStream | null = null;
      let error: Error | null = null;
      
      for (const config of configurations) {
        try {
          console.log("CameraView: Trying camera configuration:", JSON.stringify(config));
          newStream = await navigator.mediaDevices.getUserMedia(config);
          console.log("CameraView: Configuration succeeded:", JSON.stringify(config));
          break;
        } catch (err) {
          error = err as Error;
          console.log("CameraView: Configuration failed:", JSON.stringify(config), err);
          // Continue to next configuration
        }
      }
      
      if (!newStream) {
        throw error || new Error("No se pudo acceder a la cámara con ninguna configuración");
      }
      
      // Clear the timeout as we've succeeded
      if (cameraStartTimeoutRef.current) {
        clearTimeout(cameraStartTimeoutRef.current);
        cameraStartTimeoutRef.current = null;
      }
      
      // Store in both state and ref for consistent access
      setStream(newStream);
      streamRef.current = newStream;
      
      const videoTrack = newStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error("No se encontró ninguna pista de video");
      }

      console.log("CameraView: Got video track:", videoTrack.label);
      
      // Create ImageCapture once and store in ref - with error checking
      try {
        if (videoTrack.readyState === 'live') {
          activeImageCaptureRef.current = new ImageCapture(videoTrack);
          console.log("CameraView: ImageCapture created successfully");
        } else {
          console.warn("CameraView: Video track not in live state, cannot create ImageCapture");
        }
      } catch (imageCaptureErr) {
        console.error("CameraView: Failed to create ImageCapture:", imageCaptureErr);
        // Continue even if ImageCapture fails
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Add event listeners for video playback
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .catch(err => console.error("Error playing video:", err));
          }
        };
      }
      
      // Try to enable torch for better visibility after a short delay
      setTimeout(() => {
        if (!streamRef.current) return;
        
        const currentVideoTrack = streamRef.current.getVideoTracks()[0];
        if (currentVideoTrack && currentVideoTrack.readyState === 'live' && 
            'getCapabilities' in currentVideoTrack && 
            currentVideoTrack.getCapabilities()?.torch) {
          console.log("CameraView: Enabling torch");
          try {
            currentVideoTrack.applyConstraints({
              advanced: [{ torch: true }]
            }).then(() => {
              setTorchEnabled(true);
              console.log("CameraView: Torch enabled successfully");
            }).catch(torchErr => {
              console.log("CameraView: Error enabling torch:", torchErr);
            });
          } catch (torchErr) {
            console.log("CameraView: Error enabling torch:", torchErr);
            // Continue even if torch fails
          }
        }
      }, 1000);
      
      // Notify parent that stream is ready
      if (onStreamReady && streamRef.current) {
        console.log("CameraView: Calling onStreamReady callback");
        onStreamReady(streamRef.current);
      }
      
      retryAttemptsRef.current = 0;
      toast.success("Cámara iniciada correctamente");
      
    } catch (err) {
      console.error("CameraView: Error starting camera:", err);
      
      if (cameraStartTimeoutRef.current) {
        clearTimeout(cameraStartTimeoutRef.current);
        cameraStartTimeoutRef.current = null;
      }
      
      const errorMessage = err instanceof Error ? err.message : "Error de cámara desconocido";
      setCameraError(`Error de cámara: ${errorMessage}`);
      toast.error(`Error de cámara: ${errorMessage}`);
      
      // Set flag to false so we can retry
      cameraStartAttemptedRef.current = false;
      
      // Implement retry logic
      retryCamera();
    }
  }, [onStreamReady, requestCameraPermission]);
  
  // Retry camera startup
  const retryCamera = useCallback(() => {
    retryAttemptsRef.current++;
    if (retryAttemptsRef.current <= maxRetryAttempts) {
      console.log(`CameraView: Retrying camera start (${retryAttemptsRef.current}/${maxRetryAttempts})...`);
      
      // Reset the permission flag to try requesting permission again
      permissionRequestedRef.current = false;
      cameraStartAttemptedRef.current = false;
      
      setTimeout(startCamera, 1000);
    } else {
      console.error(`CameraView: Failed to start camera after ${maxRetryAttempts} attempts`);
      toast.error(`No se pudo iniciar la cámara después de ${maxRetryAttempts} intentos`);
    }
  }, [startCamera, maxRetryAttempts]);

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
      
      {cameraError && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white p-4 z-10">
          <div className="max-w-md text-center">
            <h3 className="text-xl font-bold mb-2">Error de cámara</h3>
            <p>{cameraError}</p>
            <button 
              onClick={() => {
                setCameraError(null);
                permissionRequestedRef.current = false; // Reset permission flag to try again
                cameraStartAttemptedRef.current = false; // Reset start attempt flag
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
