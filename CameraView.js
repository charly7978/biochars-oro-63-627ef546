
import React, { useRef, useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { ProcessorConfig } from './src/modules/vital-signs/ProcessorConfig';

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  buttonPosition 
}) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [brightnessSamples, setBrightnessSamples] = useState([]);
  const [avgBrightness, setAvgBrightness] = useState(0);
  const brightnessSampleLimit = 10;
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const retryCountRef = useRef(0);
  const errorCountRef = useRef(0);
  const cameraTimeoutRef = useRef(null);

  const stopCamera = async () => {
    if (stream) {
      console.log("Stopping camera stream and turning off torch");
      stream.getTracks().forEach(track => {
        try {
          // Try to turn off torch before stopping the track
          if (track.kind === 'video' && track.getCapabilities()?.torch) {
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error desactivando linterna:", err));
          }
          track.stop();
        } catch (err) {
          console.error("Error stopping track:", err);
        }
        
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      });
      setStream(null);
      setTorchEnabled(false);
    }
    
    if (cameraTimeoutRef.current) {
      clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;
    }
  };

  const startCamera = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      const baseVideoConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (isAndroid) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 },
          resizeMode: 'crop-and-scale'
        });
      } else if (isIOS) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 }
        });
      }

      const constraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("Intentando acceder a la cámara con:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const videoTrack = newStream.getVideoTracks()[0];
      console.log("Cámara activada:", videoTrack.label);

      if (videoTrack && (isAndroid || isIOS)) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Camera capabilities:", capabilities);
          
          // Aplicar configuraciones especiales para móviles
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
            console.log("Applied advanced camera constraints");
          }

          // Activar la linterna inmediatamente para mejorar detección
          if (videoTrack.getCapabilities()?.torch) {
            try {
              console.log("Activando linterna...");
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
              console.log("Linterna activada con éxito");
            } catch (err) {
              console.error("No se pudo activar la linterna:", err);
              
              // Segundo intento de activar linterna con retardo
              setTimeout(async () => {
                try {
                  await videoTrack.applyConstraints({
                    advanced: [{ torch: true }]
                  });
                  setTorchEnabled(true);
                  console.log("Linterna activada con éxito (segundo intento)");
                } catch (err2) {
                  console.error("No se pudo activar la linterna (segundo intento):", err2);
                }
              }, 800);
            }
          } else {
            console.log("Este dispositivo no tiene linterna disponible");
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
        if (isAndroid || isIOS) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
        }
      }

      setStream(newStream);
      retryCountRef.current = 0;
      errorCountRef.current = 0;
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      // Programar verificación de estado de la cámara
      cameraTimeoutRef.current = setTimeout(checkCameraStatus, 5000);
      
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      
      // Incrementar contador de errores
      errorCountRef.current++;
      
      // Implementar reintentos con esperas crecientes
      retryCountRef.current++;
      const delayTime = Math.min(2000 * retryCountRef.current, 6000);
      
      if (retryCountRef.current <= 3) {
        console.log(`Reintentando iniciar la cámara en ${delayTime}ms (intento ${retryCountRef.current}/3)...`);
        setTimeout(() => {
          startCamera();
        }, delayTime);
      } else {
        console.error("Se alcanzó el máximo de intentos para iniciar la cámara");
        // Si no podemos iniciar la cámara después de 3 intentos, probamos con configuración mínima
        tryFallbackCamera();
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Intento de respaldo con configuración mínima
  const tryFallbackCamera = async () => {
    console.log("Intentando configuración mínima de cámara");
    try {
      const minimalConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };
      
      const fallbackStream = await navigator.mediaDevices.getUserMedia(minimalConstraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = fallbackStream;
      }
      
      setStream(fallbackStream);
      
      if (onStreamReady) {
        onStreamReady(fallbackStream);
      }
      
      console.log("Cámara iniciada con configuración mínima");
    } catch (err) {
      console.error("Error incluso con configuración mínima:", err);
    }
  };
  
  // Verificar si la cámara sigue activa y funcionando
  const checkCameraStatus = () => {
    if (!isMonitoring || !stream) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.enabled || videoTrack.readyState !== 'live') {
      console.log("Cámara en mal estado, reiniciando...");
      stopCamera();
      setTimeout(startCamera, 1000);
      return;
    }
    
    // Verificar si la linterna está activa cuando debería
    if (isMonitoring && !torchEnabled && videoTrack.getCapabilities()?.torch) {
      console.log("Linterna desactivada inesperadamente, reactivando...");
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).then(() => {
        setTorchEnabled(true);
        console.log("Linterna reactivada exitosamente");
      }).catch(err => {
        console.error("No se pudo reactivar la linterna:", err);
      });
    }
    
    // Programar la próxima verificación
    cameraTimeoutRef.current = setTimeout(checkCameraStatus, 5000);
  };

  // Monitor camera brightness to help with finger detection verification
  useEffect(() => {
    if (!stream || !videoRef.current || !isMonitoring) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 100;
    canvas.height = 100;

    const checkBrightness = () => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;
      
      try {
        ctx.drawImage(
          videoRef.current,
          0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight,
          0, 0, 100, 100
        );
        
        const imageData = ctx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        
        let brightness = 0;
        // Sample every 4th pixel to improve performance
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          brightness += (r + g + b) / 3;
        }
        
        brightness /= (data.length / 16);
        
        setBrightnessSamples(prev => {
          const newSamples = [...prev, brightness];
          if (newSamples.length > brightnessSampleLimit) {
            newSamples.shift();
          }
          return newSamples;
        });

        const avgBrightness = brightnessSamples.reduce((sum, val) => sum + val, 0) / 
                            Math.max(1, brightnessSamples.length);
        setAvgBrightness(avgBrightness);
        
        console.log("CameraView: Brightness check", { 
          currentBrightness: brightness,
          avgBrightness,
          fingerDetected: isFingerDetected,
          signalQuality
        });
      } catch (err) {
        console.error("Error checking brightness:", err);
        errorCountRef.current++;
        
        // Si hay muchos errores consecutivos, reiniciar la cámara
        if (errorCountRef.current > 5) {
          console.log("Demasiados errores de cámara, reiniciando...");
          errorCountRef.current = 0;
          stopCamera();
          setTimeout(startCamera, 1000);
        }
      }
    };

    const interval = setInterval(checkBrightness, 500);
    return () => clearInterval(interval);
  }, [stream, isMonitoring, isFingerDetected, signalQuality, brightnessSamples]);

  useEffect(() => {
    if (isMonitoring && !stream) {
      startCamera();
    } else if (!isMonitoring && stream) {
      stopCamera();
    }
    return () => {
      console.log("CameraView component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring]);

  // Determine actual finger status using both provided detection and brightness
  // Extremely permissive detection
  const actualFingerStatus = isFingerDetected || (
    avgBrightness < 70 || // Umbral muy permisivo para brightness
    signalQuality > 10    // Umbral muy permisivo para calidad
  );

  // Reattach camera if the torch gets disabled unexpectedly
  useEffect(() => {
    if (isMonitoring && stream && !torchEnabled) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("Reactivando linterna...");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          setTorchEnabled(true);
          console.log("Linterna reactivada con éxito");
        }).catch(err => {
          console.error("Error reactivando linterna:", err);
        });
      }
    }
  }, [isMonitoring, stream, torchEnabled]);

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
              !actualFingerStatus ? 'text-gray-400' :
              signalQuality > 50 ? 'text-green-500' :
              signalQuality > 20 ? 'text-yellow-500' :
              'text-red-500'
            }`}
          />
          <span className={`text-xs mt-2 transition-colors duration-300 ${
            actualFingerStatus ? 'text-green-500' : 'text-gray-400'
          }`}>
            {actualFingerStatus ? "dedo detectado" : "ubique su dedo en el lente"}
          </span>
        </div>
      )}
    </>
  );
};

export default CameraView;
