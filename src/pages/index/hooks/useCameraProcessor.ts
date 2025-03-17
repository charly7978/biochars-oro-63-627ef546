
import { useCallback } from 'react';

interface UseCameraProcessorProps {
  isMonitoring: boolean;
  processFrame: (imageData: ImageData) => void;
}

export const useCameraProcessor = ({
  isMonitoring,
  processFrame
}: UseCameraProcessorProps) => {
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
      
      // Forzar activación de la pista de video
      videoTrack.enabled = true;
      
      const imageCapture = new ImageCapture(videoTrack);
      
      // Intentar activar la linterna para mejor señal PPG
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
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
      if (!tempCtx) {
        console.error("DEBUG: Could not get 2D context");
        return;
      }
      
      let lastProcessTime = 0;
      const targetFrameInterval = 1000/15; // Reducido a 15 FPS para procesamiento más estable
      let frameCount = 0;
      let lastFpsUpdateTime = Date.now();
      let processingFps = 0;
      
      const processImage = async () => {
        if (!isMonitoring) {
          console.log("DEBUG: No longer monitoring, stopping image processing");
          return;
        }
        
        const now = Date.now();
        const timeSinceLastProcess = now - lastProcessTime;
        
        if (timeSinceLastProcess >= targetFrameInterval) {
          try {
            const frame = await imageCapture.grabFrame();
            
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
          }
        }
        
        if (isMonitoring) {
          requestAnimationFrame(processImage);
        }
      };

      processImage();
      console.log("DEBUG: Image processing loop started");
    } catch (error) {
      console.error("DEBUG: Error setting up camera processing:", error);
    }
  }, [isMonitoring, processFrame]);
  
  return { handleStreamReady };
};
