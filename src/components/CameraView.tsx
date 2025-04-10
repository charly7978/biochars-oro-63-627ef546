
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Fingerprint } from 'lucide-react';

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
  const [permissionStatus, setPermissionStatus] = useState<string>("prompt");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [brightnessLevel, setBrightnessLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;

  // Detector de plataforma
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const iosDetected = /ipad|iphone|ipod/i.test(userAgent) && !window.MSStream;
    
    console.log("CameraView: Plataforma detectada", {
      userAgent,
      isAndroid: androidDetected,
      isIOS: iosDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
  }, []);

  // Detener la cámara
  const stopCamera = async () => {
    if (stream) {
      console.log("CameraView: Deteniendo flujo de cámara REAL");
      
      try {
        stream.getTracks().forEach(track => {
          // Desactivar linterna si está disponible
          if (track.kind === 'video' && track.getCapabilities()?.torch) {
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error desactivando linterna:", err));
          }
          
          track.stop();
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      } catch (err) {
        console.error("Error al detener cámara:", err);
      }
      
      setStream(null);
      setTorchEnabled(false);
      setBrightnessLevel(0);
      retryAttemptsRef.current = 0;
    }
  };

  // Verificar permisos de cámara
  const checkCameraPermissions = useCallback(async () => {
    try {
      // Verificar permiso usando la API de permisos si está disponible
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        console.log("CameraView: Estado de permiso de cámara:", result.state);
        setPermissionStatus(result.state);
        
        if (result.state === 'denied') {
          setErrorMessage("Permiso de cámara denegado. Por favor habilite la cámara en la configuración de su navegador.");
          return false;
        }
      }
      return true;
    } catch (err) {
      console.log("Error verificando permisos:", err);
      return true; // Continuar de todos modos, getUserMedia pedirá el permiso
    }
  }, []);

  // Iniciar la cámara
  const startCamera = async () => {
    setErrorMessage(null);
    
    try {
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) {
        console.error("CameraView: No se tienen permisos de cámara");
        return;
      }
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado en este navegador");
      }

      console.log("CameraView: Solicitando acceso a cámara REAL...");
      
      // Detectar plataforma
      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChrome = /chrome/i.test(navigator.userAgent);

      // Configurar restricciones óptimas para PPG
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment', // Cámara trasera
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (isAndroid) {
        console.log("CameraView: Configurando para Android");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 }
        });
      } else if (isIOS) {
        console.log("CameraView: Configurando para iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 }
        });
      } else {
        console.log("CameraView: Configurando para escritorio");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 }
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Iniciando cámara con configuración:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: Cámara REAL inicializada correctamente");
      
      // Configurar linterna y otros ajustes
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("CameraView: Capacidades de la cámara REAL:", capabilities);
          
          // En Android, activar linterna inmediatamente
          if (isAndroid && capabilities.torch) {
            console.log("CameraView: Activando linterna en Android");
            try {
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
            } catch (torchErr) {
              console.error("Error al activar linterna en Android:", torchErr);
            }
          }
          
          // Aplicar configuraciones avanzadas para mejor captura PPG
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
            console.log("CameraView: Aplicando configuraciones avanzadas REALES:", advancedConstraints);
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
          }

          // Activar linterna en otras plataformas
          if (!isAndroid && capabilities.torch) {
            console.log("CameraView: Activando linterna para mejorar señal PPG");
            try {
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
            } catch (torchErr) {
              console.error("Error al activar linterna:", torchErr);
            }
          }
          
        } catch (err) {
          console.warn("CameraView: No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      // Configurar elemento de video
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Aplicar optimizaciones de rendimiento
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.objectFit = 'cover';
      }

      // Guardar stream y notificar
      setStream(newStream);
      setErrorMessage(null);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      // Reiniciar contador de intentos
      retryAttemptsRef.current = 0;
      
    } catch (err) {
      console.error("CameraView: Error al iniciar la cámara REAL:", err);
      let message = "Error al acceder a la cámara.";
      
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          message = "Permiso denegado. Por favor permita el acceso a la cámara.";
        } else if (err.name === "NotFoundError") {
          message = "No se encontró ninguna cámara en su dispositivo.";
        } else if (err.name === "NotReadableError") {
          message = "Su cámara está siendo utilizada por otra aplicación.";
        } else if (err.name === "OverconstrainedError") {
          message = "Las restricciones solicitadas no son compatibles con su cámara.";
        } else if (err.name === "SecurityError") {
          message = "Uso de cámara bloqueado por configuración de seguridad.";
        } else if (err.name === "AbortError") {
          message = "Se canceló el acceso a la cámara.";
        }
      }
      
      setErrorMessage(message);
      
      // Reintentar un número limitado de veces
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`CameraView: Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000);
      } else {
        console.error(`CameraView: Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
      }
    }
  };

  // Monitorear brillo para verificar presencia de dedo
  useEffect(() => {
    if (!stream || !videoRef.current || !isMonitoring) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 50;
    canvas.height = 50;

    const checkBrightness = () => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;
      
      try {
        // Obtener centro de la imagen
        ctx.drawImage(
          videoRef.current,
          videoRef.current.videoWidth / 2 - 25,
          videoRef.current.videoHeight / 2 - 25,
          50,
          50,
          0, 0, 50, 50
        );
        
        // Analizar datos de imagen REAL
        const imageData = ctx.getImageData(0, 0, 50, 50);
        const data = imageData.data;
        
        let brightness = 0;
        let redSum = 0;
        let greenSum = 0;
        let blueSum = 0;
        
        // Calcular brillo y distribución de colores
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          redSum += r;
          greenSum += g;
          blueSum += b;
          brightness += (r + g + b) / 3;
        }
        
        // Normalizar
        const pixelCount = data.length / 4;
        brightness /= pixelCount;
        redSum /= pixelCount;
        greenSum /= pixelCount;
        blueSum /= pixelCount;
        
        // Calcular dominancia de canal rojo (indicador de presencia de dedo)
        const redDominance = redSum / ((greenSum + blueSum) / 2);
        
        setBrightnessLevel(brightness);
        
        // Log ocasional para debugging
        if (Math.random() < 0.05) { // ~5% de los frames
          console.log("CameraView: Análisis de brillo REAL", { 
            brightness,
            redDominance,
            redAvg: redSum,
            greenAvg: greenSum,
            blueAvg: blueSum,
            redToGreenRatio: redSum / greenSum,
            fingerDetected: isFingerDetected,
            signalQuality
          });
        }
      } catch (err) {
        console.error("CameraView: Error analizando brillo:", err);
      }
    };

    const interval = setInterval(checkBrightness, 500);
    return () => clearInterval(interval);
  }, [stream, isMonitoring, isFingerDetected, signalQuality]);

  // Gestionar ciclo de vida de la cámara
  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("CameraView: Iniciando cámara porque isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("CameraView: Deteniendo cámara porque isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView: Componente desmontándose, deteniendo cámara");
      stopCamera();
    };
  }, [isMonitoring]);

  // Asegurar que la linterna está activada si se detecta un dedo
  useEffect(() => {
    if (stream && isFingerDetected && !torchEnabled) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("CameraView: Activando linterna después de detectar dedo");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          setTorchEnabled(true);
        }).catch(err => {
          console.error("Error activando linterna:", err);
        });
      }
    }
  }, [stream, isFingerDetected, torchEnabled]);

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
      
      {isMonitoring && (
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
      
      {errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-gray-900 p-4 rounded-lg max-w-xs text-center">
            <p className="text-red-500 mb-4">{errorMessage}</p>
            <button 
              onClick={startCamera}
              className="bg-blue-600 px-4 py-2 rounded text-white"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CameraView;
