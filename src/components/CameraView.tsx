
import React, { useRef, useEffect, useState } from 'react';

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
  const [cameraReady, setCameraReady] = useState(false);
  const [actualResolution, setActualResolution] = useState<{width: number, height: number} | null>(null);
  const streamErrorCount = useRef(0);

  const stopCamera = async () => {
    if (stream) {
      console.log("CameraView: Stopping camera stream and turning off torch");
      try {
        stream.getTracks().forEach(track => {
          // Turn off torch if it's available
          if (track.kind === 'video' && track.getCapabilities()?.torch) {
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error desactivando linterna:", err));
          }
          
          // Stop the track
          track.stop();
        });
      } catch (err) {
        console.error("Error stopping tracks:", err);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      setCameraReady(false);
      setActualResolution(null);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);

      // FIXED: Request higher resolution to ensure we get the best available
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1920 }, // Request full HD resolution if available
        height: { ideal: 1080 }
      };

      if (isAndroid) {
        // Ajustes para mejorar la extracción de señal en Android
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 60 }, // Increased frame rate for better signal
          resizeMode: 'crop-and-scale'
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Attempting to get user media with constraints:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: User media obtained successfully");
      
      if (!newStream || newStream.getVideoTracks().length === 0) {
        throw new Error("No se pudo obtener video track");
      }
      
      const videoTrack = newStream.getVideoTracks()[0];
      console.log("CameraView: Video track obtained:", videoTrack.label);

      // FIXED: Log and store the actual resolution we got
      const settings = videoTrack.getSettings();
      const actualWidth = settings.width || 0;
      const actualHeight = settings.height || 0;
      console.log(`CameraView: Actual camera resolution: ${actualWidth}x${actualHeight}`);
      setActualResolution({width: actualWidth, height: actualHeight});

      // FIXED: Try to set the highest resolution available
      if (videoTrack && videoTrack.getCapabilities) {
        const capabilities = videoTrack.getCapabilities();
        console.log("CameraView: Track capabilities:", capabilities);
        
        // If width/height capabilities are available, try to set the maximum
        if (capabilities.width && capabilities.height) {
          const maxWidth = capabilities.width.max || 1920;
          const maxHeight = capabilities.height.max || 1080;
          console.log(`CameraView: Attempting to set maximum resolution: ${maxWidth}x${maxHeight}`);
          
          try {
            await videoTrack.applyConstraints({
              width: maxWidth,
              height: maxHeight
            });
            
            // Update actual resolution after applying constraints
            const newSettings = videoTrack.getSettings();
            setActualResolution({
              width: newSettings.width || 0,
              height: newSettings.height || 0
            });
            console.log(`CameraView: Applied resolution: ${newSettings.width}x${newSettings.height}`);
          } catch (err) {
            console.error("CameraView: Failed to set maximum resolution:", err);
          }
        }
        
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
          await videoTrack.applyConstraints({
            advanced: advancedConstraints
          });
          console.log("CameraView: Applied advanced constraints successfully");
        }

        if (videoRef.current) {
          videoRef.current.style.transform = 'translateZ(0)';
          videoRef.current.style.backfaceVisibility = 'hidden';
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        if (isAndroid) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
        }
      }

      setStream(newStream);
      
      // Wait for the video to be ready before notifying
      setTimeout(() => {
        setCameraReady(true);
        console.log("CameraView: Camera ready state set to true");
        
        // Try to activate torch with appropriate error handling
        if (videoTrack && videoTrack.getCapabilities()?.torch) {
          console.log("CameraView: Attempting to enable torch");
          videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          }).then(() => {
            console.log("CameraView: Torch enabled successfully");
            setTorchEnabled(true);
          }).catch(err => {
            console.error("CameraView: Error enabling torch:", err);
          });
        }
        
        // Only notify once camera is fully ready
        if (onStreamReady) {
          console.log("CameraView: Notifying stream ready");
          onStreamReady(newStream);
        }
      }, 1000); // Give the camera a second to stabilize
      
    } catch (err) {
      console.error("CameraView: Error starting camera:", err);
      streamErrorCount.current += 1;
      
      // If we've tried more than twice, use lower resolution
      if (streamErrorCount.current > 2) {
        console.log("CameraView: Multiple failures, trying with lower resolution");
        try {
          // FIXED: Increased fallback resolution
          const fallbackConstraints = {
            video: {
              facingMode: 'environment',
              width: { ideal: 640 },  // Increased from 320 to 640
              height: { ideal: 480 }, // Increased from 240 to 480
              frameRate: { ideal: 15 }
            }
          };
          
          const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          
          setStream(fallbackStream);
          
          // Set actual resolution for fallback
          const fallbackTrack = fallbackStream.getVideoTracks()[0];
          const fallbackSettings = fallbackTrack.getSettings();
          setActualResolution({
            width: fallbackSettings.width || 0,
            height: fallbackSettings.height || 0
          });
          
          setTimeout(() => {
            setCameraReady(true);
            if (onStreamReady) {
              onStreamReady(fallbackStream);
            }
          }, 1000);
        } catch (finalErr) {
          console.error("CameraView: Final error starting camera:", finalErr);
        }
      }
    }
  };

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("CameraView: Starting camera because isMonitoring=true");
      streamErrorCount.current = 0;
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("CameraView: Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView: Component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring]);

  useEffect(() => {
    // More robust torch handling
    if (stream && isFingerDetected && !torchEnabled && cameraReady) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === 'live' && videoTrack.getCapabilities()?.torch) {
        console.log("CameraView: Activating torch because finger detected");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          setTorchEnabled(true);
        }).catch(err => {
          console.error("CameraView: Error activating torch:", err);
        });
      }
    }
    
    // Check camera and torch every 5 seconds
    const interval = setInterval(() => {
      if (stream && cameraReady) {
        const videoTrack = stream.getVideoTracks()[0];
        // First verify the track is still valid
        if (!videoTrack || videoTrack.readyState !== 'live') {
          console.log("CameraView: Track no longer valid, restarting camera");
          stopCamera();
          setTimeout(() => {
            if (isMonitoring) {
              startCamera();
            }
          }, 500);
        } 
        // Then check if torch should be enabled
        else if (isFingerDetected && !torchEnabled && videoTrack.getCapabilities()?.torch) {
          videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          }).then(() => setTorchEnabled(true))
            .catch(err => console.error("CameraView: Error reactivating torch:", err));
        }
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [stream, isFingerDetected, torchEnabled, cameraReady, isMonitoring]);

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
      {/* Display camera resolution for debugging */}
      {actualResolution && (
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
          {actualResolution.width}×{actualResolution.height}
        </div>
      )}
    </>
  );
};

export default CameraView;
