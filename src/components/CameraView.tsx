
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
  const streamRef = useRef<MediaStream | null>(null);
  const activeImageCaptureRef = useRef<ImageCapture | null>(null);

  // Tracking refs for permission and camera state
  const permissionRequestedRef = useRef<boolean>(false);
  const permissionCheckInProgressRef = useRef<boolean>(false);
  const cameraStartTimeoutRef = useRef<number | null>(null);
  const cameraStartingRef = useRef<boolean>(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 5;

  // Use this function to check for camera permissions directly
  const checkCameraPermission = useCallback(async (): Promise<string> => {
    console.log("CameraView: Checking camera permission");
    
    if (permissionCheckInProgressRef.current) {
      console.log("CameraView: Permission check already in progress");
      return "pending";
    }
    
    permissionCheckInProgressRef.current = true;
    
    try {
      // Use feature detection
      if (!navigator.mediaDevices) {
        permissionCheckInProgressRef.current = false;
        return "unsupported";
      }
      
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log("CameraView: Permission status:", result.state);
          
          permissionCheckInProgressRef.current = false;
          return result.state; // "granted", "denied", or "prompt"
        } catch (err) {
          console.log("CameraView: Error checking permissions API:", err);
          // Fall through to the alternative method
        }
      }
      
      // Alternative: try to get a minimal stream just to check permission
      try {
        console.log("CameraView: Checking permission via minimal getUserMedia");
        const checkStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1, height: 1 },
          audio: false
        });
        
        // We got a stream, so permission is granted
        checkStream.getTracks().forEach(track => track.stop());
        permissionCheckInProgressRef.current = false;
        return "granted";
      } catch (err) {
        const error = err as Error;
        console.log("CameraView: Error in permission check via getUserMedia:", error);
        
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          permissionCheckInProgressRef.current = false;
          return "denied";
        } else {
          permissionCheckInProgressRef.current = false;
          return "unknown";
        }
      }
    } catch (err) {
      console.error("CameraView: Unexpected error in permission check:", err);
      permissionCheckInProgressRef.current = false;
      return "error";
    }
  }, []);

  // Robust camera stopping function
  const stopCamera = useCallback(() => {
    console.log("CameraView: Stopping camera");
    
    // Clear any pending timeouts
    if (cameraStartTimeoutRef.current) {
      clearTimeout(cameraStartTimeoutRef.current);
      cameraStartTimeoutRef.current = null;
    }
    
    // Clear the ImageCapture reference
    activeImageCaptureRef.current = null;
    
    // Stop all tracks
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          try {
            if (track.readyState === 'live') {
              // Turn off torch before stopping if possible
              if (track.kind === 'video' && 'getCapabilities' in track && track.getCapabilities()?.torch) {
                try {
                  track.applyConstraints({
                    advanced: [{ torch: false }]
                  }).catch(err => console.log("Error turning off torch:", err));
                } catch (torchErr) {
                  console.log("Error with torch constraints:", torchErr);
                }
              }
              track.stop();
            }
          } catch (trackErr) {
            console.error("Error stopping track:", trackErr);
          }
        });
      } catch (err) {
        console.error("Error stopping stream tracks:", err);
      }
      
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setStream(null);
    setTorchEnabled(false);
    cameraStartingRef.current = false;
    retryAttemptsRef.current = 0;
    
  }, []);

  // Simplified camera startup that focuses on permissions first
  const startCamera = useCallback(async () => {
    // Prevent multiple simultaneous start attempts
    if (cameraStartingRef.current || streamRef.current) {
      console.log("CameraView: Camera already starting or started");
      return;
    }

    cameraStartingRef.current = true;
    setCameraError(null);
    console.log("CameraView: Starting camera");

    // Set a timeout to prevent hanging
    if (cameraStartTimeoutRef.current) {
      clearTimeout(cameraStartTimeoutRef.current);
    }
    
    cameraStartTimeoutRef.current = window.setTimeout(() => {
      if (!streamRef.current) {
        console.error("CameraView: Camera start timed out");
        setCameraError("La cámara tardó demasiado en iniciarse. Por favor, inténtelo de nuevo.");
        toast.error("Tiempo agotado al abrir la cámara");
        cameraStartingRef.current = false;
        retryCamera();
      }
    }, 10000) as unknown as number;

    try {
      // First check permission status
      const permissionStatus = await checkCameraPermission();
      console.log("CameraView: Permission status:", permissionStatus);
      
      if (permissionStatus === "denied") {
        throw new Error("Permiso de cámara denegado. Por favor, habilítelo en la configuración de su navegador.");
      } else if (permissionStatus === "unsupported") {
        throw new Error("Su navegador no soporta acceso a la cámara.");
      }

      // Permission is either granted or we need to ask for it
      const constraints = { 
        video: { 
          facingMode: 'environment',
          width: { ideal: 320 }, // Lower resolution
          height: { ideal: 240 }
        },
        audio: false 
      };
      
      console.log("CameraView: Requesting camera with constraints:", JSON.stringify(constraints));
      
      try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        // Successfully got the stream
        
        // Clear the timeout
        if (cameraStartTimeoutRef.current) {
          clearTimeout(cameraStartTimeoutRef.current);
          cameraStartTimeoutRef.current = null;
        }
        
        // Store stream in state and ref
        permissionRequestedRef.current = true;
        setStream(newStream);
        streamRef.current = newStream;
        
        // Verify we have video tracks
        const videoTracks = newStream.getVideoTracks();
        if (!videoTracks || videoTracks.length === 0) {
          throw new Error("No video tracks found in camera stream");
        }
        
        const videoTrack = videoTracks[0];
        console.log("CameraView: Video track obtained:", videoTrack.label, "Ready state:", videoTrack.readyState);
        
        // Set video source
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(err => {
                console.error("Error playing video:", err);
              });
            }
          };
        }
        
        // Try to create ImageCapture for the track
        if (videoTrack.readyState === 'live') {
          try {
            activeImageCaptureRef.current = new ImageCapture(videoTrack);
            console.log("CameraView: ImageCapture created successfully");
          } catch (err) {
            console.error("CameraView: Failed to create ImageCapture:", err);
            // Continue even if this fails
          }
        }
        
        // Try to enable torch after a short delay
        setTimeout(() => {
          if (!streamRef.current) return;
          
          const currentVideoTrack = streamRef.current.getVideoTracks()[0];
          if (currentVideoTrack && 
              currentVideoTrack.readyState === 'live' && 
              'getCapabilities' in currentVideoTrack && 
              currentVideoTrack.getCapabilities()?.torch) {
            console.log("CameraView: Enabling torch");
            currentVideoTrack.applyConstraints({
              advanced: [{ torch: true }]
            }).then(() => {
              setTorchEnabled(true);
              console.log("CameraView: Torch enabled successfully");
            }).catch(err => {
              console.log("CameraView: Error enabling torch:", err);
            });
          }
        }, 1000);
        
        // Notify parent component
        if (onStreamReady && streamRef.current) {
          console.log("CameraView: Calling onStreamReady");
          onStreamReady(streamRef.current);
        }
        
        retryAttemptsRef.current = 0;
        toast.success("Cámara iniciada correctamente");
        
      } catch (streamErr) {
        const error = streamErr as Error;
        console.error("CameraView: Error getting camera stream:", error);
        
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          throw new Error("Permiso de cámara denegado. Por favor, habilítelo en la configuración de su navegador.");
        } else if (error.name === "NotFoundError") {
          throw new Error("No se encontró ninguna cámara en su dispositivo.");
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error("CameraView: Camera start error:", err);
      
      // Clear timeout
      if (cameraStartTimeoutRef.current) {
        clearTimeout(cameraStartTimeoutRef.current);
        cameraStartTimeoutRef.current = null;
      }
      
      const errorMessage = err instanceof Error ? err.message : "Error desconocido al iniciar la cámara";
      setCameraError(errorMessage);
      toast.error(errorMessage);
      
      // Reset for retry
      cameraStartingRef.current = false;
      retryCamera();
    }
  }, [checkCameraPermission, onStreamReady]);

  // Retry logic
  const retryCamera = useCallback(() => {
    retryAttemptsRef.current++;
    
    if (retryAttemptsRef.current <= maxRetryAttempts) {
      console.log(`CameraView: Retrying camera start (${retryAttemptsRef.current}/${maxRetryAttempts})...`);
      
      // Reset permission flags on retry
      permissionRequestedRef.current = false;
      permissionCheckInProgressRef.current = false;
      cameraStartingRef.current = false;
      
      // Try again after a delay
      setTimeout(startCamera, 1000 * Math.min(retryAttemptsRef.current, 3));
    } else {
      console.error(`CameraView: Failed to start camera after ${maxRetryAttempts} attempts`);
      setCameraError(`No se pudo iniciar la cámara después de ${maxRetryAttempts} intentos. Por favor, recargue la página.`);
      toast.error(`Fallo al iniciar la cámara después de varios intentos`);
    }
  }, [startCamera, maxRetryAttempts]);

  // Start/stop camera based on monitoring state
  useEffect(() => {
    console.log("CameraView: isMonitoring changed:", isMonitoring);
    
    if (isMonitoring && !stream) {
      console.log("CameraView: Starting camera because isMonitoring=true");
      // Reset flags before starting
      cameraStartingRef.current = false;
      permissionRequestedRef.current = false;
      permissionCheckInProgressRef.current = false;
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
                permissionRequestedRef.current = false;
                permissionCheckInProgressRef.current = false;
                cameraStartingRef.current = false;
                retryAttemptsRef.current = 0;
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
