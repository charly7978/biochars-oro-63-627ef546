
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
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);

      // Usar resolución más baja para mejor rendimiento
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 }
      };

      if (isAndroid) {
        // Ajustes para mejorar rendimiento en Android
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 15, max: 20 }, // Lower frameRate
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

      if (videoTrack && isAndroid) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("CameraView: Track capabilities:", capabilities);
          
          // Aplicar configuraciones básicas sin auto-calibración
          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
        } catch (err) {
          console.log("CameraView: Could not apply some optimizations:", err);
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
        
        // Try to activate torch immediately
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
      }, 500); // Reduced timeout for faster startup
      
    } catch (err) {
      console.error("CameraView: Error starting camera:", err);
      streamErrorCount.current += 1;
      
      // If we've tried more than twice, use lower resolution
      if (streamErrorCount.current > 2) {
        console.log("CameraView: Multiple failures, trying with lower resolution");
        try {
          const fallbackConstraints = {
            video: {
              facingMode: 'environment',
              width: { ideal: 480 },  // Higher than before but still low
              height: { ideal: 320 },
              frameRate: { ideal: 15 }
            }
          };
          
          const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          
          setStream(fallbackStream);
          
          setTimeout(() => {
            setCameraReady(true);
            if (onStreamReady) {
              onStreamReady(fallbackStream);
            }
          }, 500);
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
    // Simplified torch handling - just ensure it's on when finger detected
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
    
    // Check camera less frequently for better performance
    const interval = setInterval(() => {
      if (stream && cameraReady) {
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState !== 'live') {
          console.log("CameraView: Track no longer valid, restarting camera");
          stopCamera();
          setTimeout(() => {
            if (isMonitoring) {
              startCamera();
            }
          }, 500);
        } 
        else if (isFingerDetected && !torchEnabled && videoTrack.getCapabilities()?.torch) {
          videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          }).then(() => setTorchEnabled(true))
            .catch(err => console.error("CameraView: Error reactivating torch:", err));
        }
      }
    }, 10000); // Check less frequently (10 seconds) for better performance
    
    return () => clearInterval(interval);
  }, [stream, isFingerDetected, torchEnabled, cameraReady, isMonitoring]);

  return (
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
  );
};

export default CameraView;
