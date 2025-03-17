
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
      trackCount: stream.getTracks().length
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
        hasTorch: !!videoTrack.getCapabilities()?.torch
      });
      
      const imageCapture = new ImageCapture(videoTrack);
      
      if (videoTrack.getCapabilities()?.torch) {
        console.log("DEBUG: Activating torch for better PPG signal");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).catch(err => console.error("DEBUG: Error activating torch:", err));
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
      const targetFrameInterval = 1000/30;
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
            
            const targetWidth = Math.min(320, frame.width);
            const targetHeight = Math.min(240, frame.height);
            
            tempCanvas.width = targetWidth;
            tempCanvas.height = targetHeight;
            
            tempCtx.drawImage(
              frame, 
              0, 0, frame.width, frame.height, 
              0, 0, targetWidth, targetHeight
            );
            
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            processFrame(imageData);
            
            frameCount++;
            lastProcessTime = now;
            
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
