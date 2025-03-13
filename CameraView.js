
import React, { useRef, useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  buttonPosition,
  detectedPeaks = [] // Add detectedPeaks prop with default empty array
}) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const frameProcessingRef = useRef(null);

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
      
      if (onStreamReady) {
        onStreamReady(newStream);
        console.log("Stream enviado a la aplicación");
      }
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      setCameraActive(false);
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

      {/* Peak visualization overlay */}
      {isMonitoring && detectedPeaks && detectedPeaks.length > 0 && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {detectedPeaks.map((peak, index) => (
            <div 
              key={`peak-${index}-${peak.time}`}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center`}
              style={{
                left: `${50 + (index - detectedPeaks.length + 1) * 10}%`, 
                top: `${40 - (peak.value || 0) * 0.4}%`
              }}
            >
              {/* Circle marker */}
              <div 
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${peak.isArrhythmia ? 'bg-yellow-500 animate-pulse border-2 border-red-500' : 'bg-blue-500'}
                  text-white
                `}
              >
                {Math.round(peak.value || 0)}
              </div>
              
              {/* Value label */}
              <div className="mt-1 text-xs font-medium bg-black/60 text-white px-1 rounded">
                {getFormattedTime(peak.time)}
              </div>
              
              {/* Arrhythmia label */}
              {peak.isArrhythmia && (
                <div className="mt-1 text-xs font-bold bg-red-500/90 text-white px-2 py-1 rounded-full animate-pulse">
                  LATIDO PREMATURO
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default CameraView;
