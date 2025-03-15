
import React, { useRef, useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  buttonPosition 
}) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [hasError, setHasError] = useState(false);
  const streamAttemptRef = useRef(0);

  const stopCamera = async () => {
    if (stream) {
      try {
        stream.getTracks().forEach(track => {
          track.stop();
        });
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      } catch (err) {
        console.warn("Error al detener cámara:", err);
      }
      setStream(null);
    }
  };

  const startCamera = async () => {
    try {
      // Asegurarnos de que cualquier stream anterior esté detenido
      await stopCamera();
      setHasError(false);
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

      const baseVideoConstraints = {
        facingMode: 'environment',
        width: { ideal: 720 },
        height: { ideal: 480 }
      };

      // Ajustes específicos para diferentes plataformas
      if (isAndroid) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
          resizeMode: 'crop-and-scale'
        });
      } else if (isIOS) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 }
        });
      } else {
        // Computadoras de escritorio
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 10 }
        });
      }

      const constraints = {
        video: baseVideoConstraints,
        audio: false
      };

      streamAttemptRef.current += 1;
      console.log(`CameraView: Intento ${streamAttemptRef.current} de obtener stream de cámara`);
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newStream.getVideoTracks()[0];

      if (!videoTrack) {
        throw new Error("No se pudo obtener pista de video");
      }

      console.log("CameraView: Stream obtenido correctamente", {
        videoTrack: videoTrack.label,
        settings: videoTrack.getSettings()
      });

      if (videoTrack && (isAndroid || isIOS)) {
        try {
          const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
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
            console.log("CameraView: Restricciones avanzadas aplicadas");
          }
        } catch (err) {
          console.warn("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      // Configurar elemento de video
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.backfaceVisibility = 'hidden';
      }

      setStream(newStream);
      
      // Notificar que el stream está listo
      if (onStreamReady) {
        onStreamReady(newStream);
      }

    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      setHasError(true);
      
      // Reintento automático después de un error (máximo 3 intentos)
      if (streamAttemptRef.current < 3) {
        console.log(`CameraView: Reintentando iniciar cámara en 1.5 segundos...`);
        setTimeout(() => {
          if (isMonitoring) {
            startCamera();
          }
        }, 1500);
      }
    }
  };

  useEffect(() => {
    if (isMonitoring && !stream) {
      startCamera();
    } else if (!isMonitoring && stream) {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isMonitoring]);

  // Verificación periódica del estado de la pista de video
  useEffect(() => {
    if (!stream) return;
    
    const checkTrackStatus = () => {
      try {
        const videoTracks = stream.getVideoTracks();
        const isActive = videoTracks.some(track => track.readyState === 'live');
        
        if (!isActive && isMonitoring) {
          console.log("CameraView: Pista de video no activa, reiniciando cámara");
          startCamera();
        }
      } catch (err) {
        console.warn("Error verificando estado de pista:", err);
      }
    };
    
    const interval = setInterval(checkTrackStatus, 3000);
    return () => clearInterval(interval);
  }, [stream, isMonitoring]);

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
      
      {hasError && isMonitoring && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30">
          <div className="bg-white/90 p-4 rounded-lg max-w-[80%] text-center">
            <h3 className="font-bold text-red-500 mb-2">Error de cámara</h3>
            <p className="text-sm mb-3">No se pudo acceder a la cámara. Por favor, verifica los permisos.</p>
            <button 
              onClick={startCamera}
              className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
      
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
    </>
  );
};

export default CameraView; 
