
import React, { useRef, useEffect, useState, memo } from 'react';
import { Fingerprint } from 'lucide-react';

const CameraView = memo(({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  buttonPosition,
  detectedPeaks = [] // Ensure we're accepting peaks data
}) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const frameProcessingRef = useRef(null);
  const lastErrorRef = useRef(null);
  const errorCountRef = useRef(0);

  const stopCamera = async () => {
    if (stream) {
      try {
        // Cancel any ongoing frame processing
        if (frameProcessingRef.current) {
          cancelAnimationFrame(frameProcessingRef.current);
          frameProcessingRef.current = null;
        }

        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (err) {
            console.error("Error al detener track:", err);
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        
        setStream(null);
        setCameraActive(false);
        console.log("Cámara detenida correctamente");
      } catch (err) {
        console.error("Error al detener la cámara:", err);
      }
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      // Detener cámara anterior si existe
      await stopCamera();

      const isAndroid = /android/i.test(navigator.userAgent);

      const baseVideoConstraints = {
        facingMode: 'environment',
        width: { ideal: 720 },
        height: { ideal: 480 }
      };

      if (isAndroid) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 25 },
          resizeMode: 'crop-and-scale'
        });
      }

      const constraints = {
        video: baseVideoConstraints
      };

      console.log("Intentando iniciar cámara con restricciones:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Cámara iniciada correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack && isAndroid) {
        try {
          const capabilities = videoTrack.getCapabilities();
          const advancedConstraints = [];
          
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
          }

          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
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
      setCameraActive(true);
      
      // Reset error tracking on successful camera start
      errorCountRef.current = 0;
      lastErrorRef.current = null;
      
      if (onStreamReady) {
        onStreamReady(newStream);
        console.log("Stream enviado a la aplicación");
      }
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      setCameraActive(false);
      
      // Track errors
      errorCountRef.current++;
      lastErrorRef.current = err;
      
      // If we've had multiple failures, wait longer before retrying
      if (errorCountRef.current > 3) {
        console.log("Múltiples errores al iniciar la cámara, esperando más tiempo...");
        // We don't auto-retry here, let the component's lifecycle handle it
      }
    }
  };

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("Iniciando cámara porque isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Deteniendo cámara porque isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("Componente CameraView desmontándose, deteniendo cámara");
      stopCamera();
    };
  }, [isMonitoring]);

  // Helper function to get formatted time
  const getFormattedTime = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  };

  // Debug log when peaks change
  useEffect(() => {
    if (detectedPeaks && detectedPeaks.length > 0) {
      console.log("CameraView: Peaks received:", detectedPeaks.length, detectedPeaks);
    }
  }, [detectedPeaks]);

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
      {isMonitoring && buttonPosition && (
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

      {/* Peak visualization overlay - IMPROVED AND FIXED */}
      {isMonitoring && detectedPeaks && detectedPeaks.length > 0 && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {detectedPeaks.map((peak, index) => {
            // Calculate position (ensure we have the correct properties)
            const x = `${Math.min(Math.max(25 + (index - Math.max(0, detectedPeaks.length - 10)) * 5, 10), 90)}%`;
            const y = `${Math.max(20, 50 - (peak.value || 0) * 0.3)}%`;
            
            // Debug each peak
            console.log(`Rendering peak ${index}:`, { x, y, peak });
            
            return (
              <div 
                key={`peak-${index}-${peak.timestamp || Date.now()}`}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{
                  left: x,
                  top: y,
                  zIndex: 1000 + index // Ensure newer peaks are on top
                }}
              >
                {/* Pulsating background for arrhythmia */}
                {peak.isArrhythmia && (
                  <div className="absolute inset-0 w-24 h-24 -m-10 rounded-full bg-yellow-400/30 animate-pulse"></div>
                )}
                
                {/* Main circle - different styles for normal vs arrhythmia */}
                <div 
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                    ${peak.isArrhythmia ? 'bg-red-500 border-2 border-yellow-400 animate-pulse' : 'bg-blue-500'}
                    text-white shadow-lg
                  `}
                >
                  {Math.round(peak.value || 0)}
                </div>
                
                {/* Value label with timing info */}
                <div className="mt-1 text-xs font-medium bg-black/70 text-white px-2 py-1 rounded">
                  {peak.timestamp ? getFormattedTime(peak.timestamp) : 'N/A'}
                </div>
                
                {/* Special label for arrhythmia peaks */}
                {peak.isArrhythmia && (
                  <div className="mt-1 text-xs font-bold bg-red-500 text-white px-3 py-1 rounded-full animate-pulse shadow-md">
                    LATIDO PREMATURO
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
});

export default CameraView;
