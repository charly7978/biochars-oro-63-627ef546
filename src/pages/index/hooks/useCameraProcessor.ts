
import { useCallback, useRef } from 'react';

interface UseCameraProcessorProps {
  isMonitoring: boolean;
  processFrame: (imageData: ImageData) => void;
}

export const useCameraProcessor = ({
  isMonitoring,
  processFrame
}: UseCameraProcessorProps) => {
  const streamRef = useRef<MediaStream | null>(null);
  const imageProcessingRef = useRef<boolean>(false);
  const errorCountRef = useRef<number>(0);
  const maxErrors = 5;
  const recoveryTimeoutRef = useRef<number | null>(null);

  const handleStreamReady = useCallback((stream: MediaStream) => {
    console.log("DEBUG: Stream ready event received", {
      isMonitoring,
      trackCount: stream.getTracks().length,
      isActive: stream.active
    });
    
    if (!isMonitoring) {
      console.log("DEBUG: Not monitoring, ignoring stream");
      return;
    }
    
    try {
      streamRef.current = stream;
      errorCountRef.current = 0;
      
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error("DEBUG: No video track available in stream");
        return;
      }
      
      console.log("DEBUG: Video track obtained", {
        label: videoTrack.label,
        hasTorch: !!videoTrack.getCapabilities()?.torch,
        active: videoTrack.enabled,
        settings: JSON.stringify(videoTrack.getSettings()),
        constraints: JSON.stringify(videoTrack.getConstraints())
      });
      
      // Ensure video track is enabled
      videoTrack.enabled = true;
      
      // Create ImageCapture object
      const imageCapture = new ImageCapture(videoTrack);
      
      // Try to activate torch for better PPG signal
      if (videoTrack.getCapabilities()?.torch) {
        console.log("DEBUG: Activating torch for better PPG signal");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          console.log("DEBUG: Torch activated successfully");
        }).catch(err => {
          console.error("DEBUG: Error activating torch:", err);
        });
      } else {
        console.warn("DEBUG: This camera doesn't have torch available, measurement may be less accurate");
      }
      
      // Set up canvas for image processing
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
      if (!tempCtx) {
        console.error("DEBUG: Could not get 2D context");
        return;
      }
      
      let lastProcessTime = 0;
      const targetFrameInterval = 1000/15; // 15 FPS for more stable processing
      let frameCount = 0;
      let lastFpsUpdateTime = Date.now();
      let processingFps = 0;
      
      // Prevent multiple processing loops
      if (imageProcessingRef.current) {
        console.log("DEBUG: Image processing already running, not starting another instance");
        return;
      }
      
      imageProcessingRef.current = true;
      
      const processImage = async () => {
        if (!isMonitoring || !streamRef.current) {
          console.log("DEBUG: No longer monitoring, stopping image processing");
          imageProcessingRef.current = false;
          return;
        }
        
        const now = Date.now();
        const timeSinceLastProcess = now - lastProcessTime;
        
        if (timeSinceLastProcess >= targetFrameInterval) {
          try {
            const track = streamRef.current.getVideoTracks()[0];
            if (!track || !track.enabled || track.readyState === 'ended') {
              throw new Error("Video track is not available or ended");
            }
            
            const imageCapture = new ImageCapture(track);
            const frame = await imageCapture.grabFrame();
            
            // Reset error counter on successful frame capture
            errorCountRef.current = 0;
            
            console.log("DEBUG: Frame captured", { 
              width: frame.width, 
              height: frame.height,
              timestamp: now
            });
            
            const targetWidth = Math.min(320, frame.width);
            const targetHeight = Math.min(240, frame.height);
            
            tempCanvas.width = targetWidth;
            tempCanvas.height = targetHeight;
            
            try {
              tempCtx.drawImage(
                frame, 
                0, 0, frame.width, frame.height, 
                0, 0, targetWidth, targetHeight
              );
              
              const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
              console.log("DEBUG: Image data ready for processing", { 
                width: imageData.width, 
                height: imageData.height, 
                dataSize: imageData.data.length 
              });
              
              processFrame(imageData);
              
              frameCount++;
              lastProcessTime = now;
            } catch (drawError) {
              console.error("DEBUG: Error drawing image to canvas:", drawError);
            }
            
            if (now - lastFpsUpdateTime > 1000) {
              processingFps = frameCount;
              frameCount = 0;
              lastFpsUpdateTime = now;
              console.log(`DEBUG: Processing performance: ${processingFps} FPS`);
            }
          } catch (error) {
            console.error("DEBUG: Error capturing frame:", error);
            
            // Count consecutive errors
            errorCountRef.current++;
            
            // If we've had too many consecutive errors, try to recover
            if (errorCountRef.current >= maxErrors) {
              console.log("DEBUG: Too many consecutive errors, attempting to recover camera");
              
              // Prevent recovery attempts from piling up
              if (recoveryTimeoutRef.current === null) {
                imageProcessingRef.current = false;
                
                recoveryTimeoutRef.current = window.setTimeout(() => {
                  console.log("DEBUG: Attempting camera recovery");
                  
                  // Stop old tracks
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                  }
                  
                  // Reset status
                  streamRef.current = null;
                  errorCountRef.current = 0;
                  recoveryTimeoutRef.current = null;
                  
                  // Request new camera access if still monitoring
                  if (isMonitoring) {
                    requestCameraAccess();
                  }
                }, 1000);
                
                return; // Exit the processing loop
              }
            }
          }
        }
        
        if (isMonitoring) {
          requestAnimationFrame(processImage);
        } else {
          imageProcessingRef.current = false;
        }
      };

      processImage();
      console.log("DEBUG: Image processing loop started");
    } catch (error) {
      console.error("DEBUG: Error setting up camera processing:", error);
      imageProcessingRef.current = false;
    }
  }, [isMonitoring, processFrame]);
  
  const requestCameraAccess = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("DEBUG: getUserMedia not supported in this browser");
      return;
    }
    
    console.log("DEBUG: Requesting camera access");
    
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: false
    };
    
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        console.log("DEBUG: Camera access granted");
        handleStreamReady(stream);
      })
      .catch((error) => {
        console.error("DEBUG: Failed to get camera access:", error);
      });
  }, [handleStreamReady]);
  
  return { 
    handleStreamReady,
    requestCameraAccess 
  };
};
