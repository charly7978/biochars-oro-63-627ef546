
import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

interface UseCameraOptions {
  onStreamReady?: (stream: MediaStream) => void;
}

export const useCamera = ({ onStreamReady }: UseCameraOptions = {}) => {
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
    console.log("useCamera: Stopping camera");
    
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
        console.log(`useCamera: Stopping ${tracks.length} tracks`);
        
        for (const track of tracks) {
          try {
            if (track.readyState === 'live') {
              // Turn off torch before stopping if possible
              if (track.kind === 'video') {
                try {
                  const capabilities = 'getCapabilities' in track ? track.getCapabilities() : {};
                  if (capabilities?.torch) {
                    console.log("useCamera: Turning off torch before stopping");
                    track.applyConstraints({
                      advanced: [{ torch: false }]
                    }).catch(err => console.log("Error turning off torch:", err));
                  }
                } catch (torchErr) {
                  console.log("useCamera: Error with torch constraints:", torchErr);
                }
              }
              console.log(`useCamera: Stopping ${track.kind} track`);
              track.stop();
            } else {
              console.log(`useCamera: Track ${track.kind} already stopped (${track.readyState})`);
            }
          } catch (trackErr) {
            console.error("useCamera: Error stopping track:", trackErr);
          }
        }
      } catch (err) {
        console.error("useCamera: Error stopping stream tracks:", err);
      }
      
      streamRef.current = null;
    } else {
      console.log("useCamera: No stream to stop");
    }
    
    setStream(null);
    setTorchEnabled(false);
    cameraStartingRef.current = false;
    retryAttemptsRef.current = 0;
    
  }, []);

  // Check permission without starting the camera
  const checkPermissionOnly = useCallback(async (): Promise<boolean> => {
    console.log("useCamera: Checking camera permission only");
    
    if (permissionGrantedRef.current) {
      console.log("useCamera: Permission already granted");
      return true;
    }
    
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log("useCamera: Permission query result:", result.state);
          
          if (result.state === 'granted') {
            permissionGrantedRef.current = true;
            return true;
          } else if (result.state === 'denied') {
            return false;
          }
          // For 'prompt' we'll continue to getUserMedia
        } catch (err) {
          console.log("useCamera: Error using permissions API:", err);
          // Continue to getUserMedia
        }
      }
      
      return true; // Assume we can try getUserMedia if permissions API not available
    } catch (err) {
      console.error("useCamera: Error in permission check:", err);
      return false;
    }
  }, []);

  // Simplified camera startup with better error handling
  const startCamera = useCallback(async () => {
    // Prevent multiple simultaneous start attempts or starting when we already have a stream
    if (cameraStartingRef.current || streamRef.current) {
      console.log("useCamera: Camera already starting or started, ignoring request");
      return;
    }

    // Mark that we're starting the camera and reset errors
    cameraStartingRef.current = true;
    setCameraError(null);
    console.log("useCamera: Starting camera");

    // Set a timeout to prevent hanging
    if (cameraStartTimeoutRef.current) {
      window.clearTimeout(cameraStartTimeoutRef.current);
    }
    
    cameraStartTimeoutRef.current = window.setTimeout(() => {
      if (!streamRef.current && cameraStartingRef.current) {
        console.error("useCamera: Camera start timed out");
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
        console.log("useCamera: Startup cancelled (unmounting or no longer starting)");
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
      
      console.log("useCamera: Requesting camera with constraints:", JSON.stringify(constraints));
      
      // Request the camera stream
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Only proceed if we're still supposed to be starting (could have been cancelled)
      if (isUnmountingRef.current || !cameraStartingRef.current) {
        console.log("useCamera: Stream obtained but startup was cancelled, cleaning up");
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
      console.log("useCamera: Stream obtained successfully");
      permissionGrantedRef.current = true;
      setStream(newStream);
      streamRef.current = newStream;
      
      // Verify we have video tracks
      const videoTracks = newStream.getVideoTracks();
      if (!videoTracks || videoTracks.length === 0) {
        throw new Error("No se encontraron pistas de video en la cámara");
      }
      
      const videoTrack = videoTracks[0];
      console.log("useCamera: Video track obtained:", videoTrack.label, "Ready state:", videoTrack.readyState);
      
      if (videoTrack.readyState !== 'live') {
        console.error("useCamera: Video track not live:", videoTrack.readyState);
        throw new Error("La pista de video no está activa");
      }
      
      // Try to create ImageCapture for the track safely
      if (videoTrack.readyState === 'live' && !isUnmountingRef.current) {
        try {
          activeImageCaptureRef.current = new ImageCapture(videoTrack);
          console.log("useCamera: ImageCapture created successfully");
        } catch (err) {
          console.error("useCamera: Failed to create ImageCapture:", err);
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
              console.log("useCamera: Enabling torch");
              currentVideoTrack.applyConstraints({
                advanced: [{ torch: true }]
              }).then(() => {
                setTorchEnabled(true);
                console.log("useCamera: Torch enabled successfully");
              }).catch(err => {
                console.log("useCamera: Error enabling torch:", err);
              });
            }
          }
        } catch (torchErr) {
          console.log("useCamera: Error checking torch capabilities:", torchErr);
        }
      }, 1000);
      
      // Notify parent component of stream
      if (onStreamReady && streamRef.current && !isUnmountingRef.current) {
        console.log("useCamera: Calling onStreamReady");
        onStreamReady(streamRef.current);
      }
      
      retryAttemptsRef.current = 0;
      cameraStartingRef.current = false;
      
    } catch (err) {
      console.error("useCamera: Camera start error:", err);
      
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
      console.log(`useCamera: Retrying camera start (${retryAttemptsRef.current}/${maxRetryAttempts})...`);
      
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
      console.error(`useCamera: Failed to start camera after ${maxRetryAttempts} attempts`);
      setCameraError(`No se pudo iniciar la cámara después de ${maxRetryAttempts} intentos. Por favor, recargue la página.`);
      toast.error(`Fallo al iniciar la cámara después de varios intentos`);
    }
  }, [maxRetryAttempts, startCamera]);

  // Cleanup function for unmounting
  const cleanupCamera = useCallback(() => {
    console.log("useCamera: Cleanup called");
    isUnmountingRef.current = true;
    stopCamera();
  }, [stopCamera]);

  return {
    stream,
    torchEnabled,
    cameraError,
    startCamera,
    stopCamera,
    retryCamera,
    cleanupCamera,
    setCameraError
  };
};
