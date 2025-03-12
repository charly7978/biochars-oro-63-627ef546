
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
  const [cameraResolution, setCameraResolution] = useState({ width: 0, height: 0 });
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

      // Intentar obtener la resolución máxima disponible de la cámara
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1920 }, // Solicitamos resolución HD o superior
        height: { ideal: 1080 }
      };

      if (isAndroid) {
        // Ajustes para mejorar la extracción de señal en Android
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 15, max: 30 },
          resizeMode: 'crop-and-scale'
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Intentando obtener la cámara con restricciones:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: Stream de cámara obtenido correctamente");
      
      if (!newStream || newStream.getVideoTracks().length === 0) {
        throw new Error("No se pudo obtener video track");
      }
      
      const videoTrack = newStream.getVideoTracks()[0];
      console.log("CameraView: Video track obtenido:", videoTrack.label);

      // Obtener y registrar las capacidades reales del track
      const capabilities = videoTrack.getCapabilities();
      console.log("CameraView: Capacidades del track:", capabilities);
      
      // Obtener settings actuales
      const settings = videoTrack.getSettings();
      console.log("CameraView: Configuración actual de la cámara:", settings);
      
      // Registrar la resolución actual
      setCameraResolution({
        width: settings.width || 0,
        height: settings.height || 0
      });
      
      // Intentar aplicar la mayor resolución disponible
      if (capabilities.width && capabilities.height) {
        const maxWidth = capabilities.width.max || 1920;
        const maxHeight = capabilities.height.max || 1080;
        
        console.log(`CameraView: Intentando aplicar resolución máxima: ${maxWidth}x${maxHeight}`);
        
        try {
          await videoTrack.applyConstraints({
            width: { ideal: maxWidth },
            height: { ideal: maxHeight }
          });
          
          // Verificar configuración después de aplicar restricciones
          const newSettings = videoTrack.getSettings();
          console.log("CameraView: Nueva configuración de cámara después de aplicar restricciones:", newSettings);
          
          setCameraResolution({
            width: newSettings.width || 0,
            height: newSettings.height || 0
          });
        } catch (constraintErr) {
          console.error("CameraView: Error aplicando restricciones de alta resolución:", constraintErr);
        }
      }

      if (isAndroid) {
        try {
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
          console.log(`CameraView: Notifying stream ready con resolución: ${cameraResolution.width}x${cameraResolution.height}`);
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
          const fallbackConstraints = {
            video: {
              facingMode: 'environment',
              width: { ideal: 640 },  // Aumentado de 320 a 640 para mejor calidad
              height: { ideal: 480 }, // Aumentado de 240 a 480
              frameRate: { ideal: 15 }
            }
          };
          
          const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          
          setStream(fallbackStream);
          
          // Registrar información sobre la resolución de fallback
          const fallbackTrack = fallbackStream.getVideoTracks()[0];
          const fallbackSettings = fallbackTrack.getSettings();
          console.log("CameraView: Configuración de fallback:", fallbackSettings);
          
          setCameraResolution({
            width: fallbackSettings.width || 0,
            height: fallbackSettings.height || 0
          });
          
          setTimeout(() => {
            setCameraReady(true);
            if (onStreamReady) {
              console.log(`CameraView: Notifying fallback stream ready con resolución: ${fallbackSettings.width}x${fallbackSettings.height}`);
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
      {cameraReady && (
        <div className="absolute top-2 left-2 z-20 bg-black/50 text-white text-xs p-1 rounded">
          Res: {cameraResolution.width}x{cameraResolution.height}
        </div>
      )}
    </>
  );
};

export default CameraView;
