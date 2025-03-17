
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
  
  // All refs for tracking state across renders
  const streamRef = useRef<MediaStream | null>(null);
  const activeImageCaptureRef = useRef<ImageCapture | null>(null);
  const cameraStartingRef = useRef<boolean>(false);
  const retryAttemptsRef = useRef<number>(0);
  const cameraStartTimeoutRef = useRef<number | null>(null);
  const isUnmountingRef = useRef<boolean>(false);
  const permissionGrantedRef = useRef<boolean>(false);
  
  const maxRetryAttempts = 3;

  // Simple camera stopping function that guarantees cleanup
  const stopCamera = useCallback(() => {
    console.log("CameraView: Stopping camera");
    
    // Clear any pending timeouts
    if (cameraStartTimeoutRef.current) {
      window.clearTimeout(cameraStartTimeoutRef.current);
      cameraStartTimeoutRef.current = null;
    }
    
    // Clear the ImageCapture reference
    activeImageCaptureRef.current = null;
    
    // Stop all tracks
    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks();
        console.log(`CameraView: Stopping ${tracks.length} tracks`);
        
        for (const track of tracks) {
          try {
            if (track.readyState === 'live') {
              // Turn off torch before stopping if possible
              if (track.kind === 'video') {
                try {
                  const capabilities = 'getCapabilities' in track ? track.getCapabilities() : {};
                  if (capabilities?.torch) {
                    console.log("CameraView: Turning off torch before stopping");
                    track.applyConstraints({
                      advanced: [{ torch: false }]
                    }).catch(err => console.log("Error turning off torch:", err));
                  }
                } catch (torchErr) {
                  console.log("CameraView: Error with torch constraints:", torchErr);
                }
              }
              console.log(`CameraView: Stopping ${track.kind} track`);
              track.stop();
            } else {
              console.log(`CameraView: Track ${track.kind} already stopped (${track.readyState})`);
            }
          } catch (trackErr) {
            console.error("CameraView: Error stopping track:", trackErr);
          }
        }
      } catch (err) {
        console.error("CameraView: Error stopping stream tracks:", err);
      }
      
      streamRef.current = null;
    } else {
      console.log("CameraView: No stream to stop");
    }
    
    // Clear video element source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setStream(null);
    setTorchEnabled(false);
    cameraStartingRef.current = false;
    retryAttemptsRef.current = 0;
    
  }, []);

  // Check permission without starting the camera
  const checkPermissionOnly = useCallback(async (): Promise<boolean> => {
    console.log("CameraView: Checking camera permission only");
    
    if (permissionGrantedRef.current) {
      console.log("CameraView: Permission already granted");
      return true;
    }
    
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log("CameraView: Permission query result:", result.state);
          
          if (result.state === 'granted') {
            permissionGrantedRef.current = true;
            return true;
          } else if (result.state === 'denied') {
            return false;
          }
          // For 'prompt' we'll continue to getUserMedia
        } catch (err) {
          console.log("CameraView: Error using permissions API:", err);
          // Continue to getUserMedia
        }
      }
      
      return true; // Assume we can try getUserMedia if permissions API not available
    } catch (err) {
      console.error("CameraView: Error in permission check:", err);
      return false;
    }
  }, []);

  // Simplified camera startup with better error handling
  const startCamera = useCallback(async () => {
    // Prevent multiple simultaneous start attempts or starting when we already have a stream
    if (cameraStartingRef.current || streamRef.current) {
      console.log("CameraView: Camera already starting or started, ignoring request");
      return;
    }

    // Mark that we're starting the camera and reset errors
    cameraStartingRef.current = true;
    setCameraError(null);
    console.log("CameraView: Starting camera");

    // Set a timeout to prevent hanging
    if (cameraStartTimeoutRef.current) {
      window.clearTimeout(cameraStartTimeoutRef.current);
    }
    
    cameraStartTimeoutRef.current = window.setTimeout(() => {
      if (!streamRef.current && cameraStartingRef.current) {
        console.error("CameraView: Camera start timed out");
        setCameraError("La cámara tardó demasiado en iniciarse. Por favor, inténtelo de nuevo.");
        toast.error("Tiempo agotado al abrir la cámara");
        cameraStartingRef.current = false;
        retryCamera();
      }
    }, 8000) as unknown as number;

    try {
      // First check permission without starting
      const canProceed = await checkPermissionOnly();
      if (!canProceed) {
        throw new Error("Permiso de cámara denegado. Por favor, habilítelo en la configuración de su navegador.");
      }
      
      // Only proceed if we're still supposed to be starting (not unmounting)
      if (isUnmountingRef.current || !cameraStartingRef.current) {
        console.log("CameraView: Startup cancelled (unmounting or no longer starting)");
        if (cameraStartTimeoutRef.current) {
          window.clearTimeout(cameraStartTimeoutRef.current);
          cameraStartTimeoutRef.current = null;
        }
        return;
      }

      // Use a very minimal configuration first to increase chances of success
      const constraints = { 
        video: { 
          facingMode: 'environment',
          width: { ideal: 240 }, // Very low resolution just to get started
          height: { ideal: 180 }
        },
        audio: false 
      };
      
      console.log("CameraView: Requesting camera with constraints:", JSON.stringify(constraints));
      
      // Request the camera stream
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Only proceed if we're still supposed to be starting (could have been cancelled)
      if (isUnmountingRef.current || !cameraStartingRef.current) {
        console.log("CameraView: Stream obtained but startup was cancelled, cleaning up");
        newStream.getTracks().forEach(track => track.stop());
        if (cameraStartTimeoutRef.current) {
          window.clearTimeout(cameraStartTimeoutRef.current);
          cameraStartTimeoutRef.current = null;
        }
        return;
      }
        
      // Clear the timeout since we've successfully got the stream
      if (cameraStartTimeoutRef.current) {
        window.clearTimeout(cameraStartTimeoutRef.current);
        cameraStartTimeoutRef.current = null;
      }
      
      // Store stream in state and ref
      console.log("CameraView: Stream obtained successfully");
      permissionGrantedRef.current = true;
      setStream(newStream);
      streamRef.current = newStream;
      
      // Verify we have video tracks
      const videoTracks = newStream.getVideoTracks();
      if (!videoTracks || videoTracks.length === 0) {
        throw new Error("No se encontraron pistas de video en la cámara");
      }
      
      const videoTrack = videoTracks[0];
      console.log("CameraView: Video track obtained:", videoTrack.label, "Ready state:", videoTrack.readyState);
      
      if (videoTrack.readyState !== 'live') {
        console.error("CameraView: Video track not live:", videoTrack.readyState);
        throw new Error("La pista de video no está activa");
      }
      
      // Set video source only after we've validated the track
      if (videoRef.current) {
        // First remove any existing srcObject to prevent InvalidStateError
        if (videoRef.current.srcObject) {
          videoRef.current.srcObject = null;
        }
        
        try {
          // Set the stream and play
          videoRef.current.srcObject = newStream;
          
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current && !isUnmountingRef.current) {
              videoRef.current.play().catch(err => {
                console.error("Error playing video:", err);
                toast.error("Error al reproducir video");
              });
            }
          };
        } catch (videoErr) {
          console.error("CameraView: Error setting video source:", videoErr);
          // Continue even if this fails, we might still be able to use the stream
        }
      }
      
      // Try to create ImageCapture for the track safely
      if (videoTrack.readyState === 'live' && !isUnmountingRef.current) {
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
        if (isUnmountingRef.current || !streamRef.current) return;
        
        try {
          const currentVideoTrack = streamRef.current.getVideoTracks()[0];
          if (currentVideoTrack && 
              currentVideoTrack.readyState === 'live' && 
              'getCapabilities' in currentVideoTrack) {
            
            const capabilities = currentVideoTrack.getCapabilities();
            if (capabilities?.torch) {
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
          }
        } catch (torchErr) {
          console.log("CameraView: Error checking torch capabilities:", torchErr);
        }
      }, 1000);
      
      // Notify parent component of stream
      if (onStreamReady && streamRef.current && !isUnmountingRef.current) {
        console.log("CameraView: Calling onStreamReady");
        onStreamReady(streamRef.current);
      }
      
      retryAttemptsRef.current = 0;
      cameraStartingRef.current = false;
      
    } catch (err) {
      console.error("CameraView: Camera start error:", err);
      
      // Clear timeout
      if (cameraStartTimeoutRef.current) {
        window.clearTimeout(cameraStartTimeoutRef.current);
        cameraStartTimeoutRef.current = null;
      }
      
      const errorMessage = err instanceof Error 
        ? err.message 
        : "Error desconocido al iniciar la cámara";
      
      setCameraError(errorMessage);
      toast.error(errorMessage);
      
      // Reset for retry
      cameraStartingRef.current = false;
      retryCamera();
    }
  }, [checkPermissionOnly, onStreamReady]);

  // Retry logic with backoff
  const retryCamera = useCallback(() => {
    if (isUnmountingRef.current) return;
    
    retryAttemptsRef.current++;
    
    if (retryAttemptsRef.current <= maxRetryAttempts) {
      console.log(`CameraView: Retrying camera start (${retryAttemptsRef.current}/${maxRetryAttempts})...`);
      
      // Reset permission flags on retry to force a fresh check
      permissionGrantedRef.current = false;
      cameraStartingRef.current = false;
      
      // Use exponential backoff for retries
      const delay = Math.min(1000 * Math.pow(2, retryAttemptsRef.current - 1), 4000);
      setTimeout(() => {
        if (!isUnmountingRef.current) {
          startCamera();
        }
      }, delay);
    } else {
      console.error(`CameraView: Failed to start camera after ${maxRetryAttempts} attempts`);
      setCameraError(`No se pudo iniciar la cámara después de ${maxRetryAttempts} intentos. Por favor, recargue la página.`);
      toast.error(`Fallo al iniciar la cámara después de varios intentos`);
    }
  }, [maxRetryAttempts, startCamera]);

  // Start/stop camera based on monitoring state
  useEffect(() => {
    console.log("CameraView: isMonitoring changed:", isMonitoring);
    
    if (isMonitoring && !stream && !cameraStartingRef.current) {
      console.log("CameraView: Starting camera because isMonitoring=true");
      // Reset before starting
      isUnmountingRef.current = false;
      retryAttemptsRef.current = 0;
      permissionGrantedRef.current = false;
      startCamera();
    } else if (!isMon

itoring && stream) {
      console.log("CameraView: Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
  }, [isMonitoring, stream, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("CameraView: Component unmounting");
      isUnmountingRef.current = true;
      stopCamera();
    };
  }, [stopCamera]);

  // Return the UI part
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
                permissionGrantedRef.current = false;
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
