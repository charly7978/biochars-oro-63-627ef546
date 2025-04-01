
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { setPowerSavingMode, getAdaptiveProcessorStatus } from '../modules/camera/CameraFrameCapture';

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
  const [isFocusing, setIsFocusing] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(1.0);
  const [isCharging, setIsCharging] = useState(true);
  const [powerSavingActive, setPowerSavingActive] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;
  const inactivityTimerRef = useRef<number | null>(null);
  const measurementDurationRef = useRef<number>(0);
  const longMeasurementThreshold = 60000; // 60 segundos

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const windowsDetected = /windows nt/i.test(userAgent);
    
    console.log("Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isWindows: windowsDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsWindows(windowsDetected);
    
    // Inicializar monitoreo de batería
    initBatteryMonitoring();
    
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  const initBatteryMonitoring = async () => {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        
        // Actualizar estado inicial
        setBatteryLevel(battery.level);
        setIsCharging(battery.charging);
        
        // Configurar ahorro de energía si es necesario
        const shouldActivatePowerSaving = !battery.charging && battery.level < 0.3;
        if (shouldActivatePowerSaving !== powerSavingActive) {
          setPowerSavingActive(shouldActivatePowerSaving);
          setPowerSavingMode(shouldActivatePowerSaving);
        }
        
        // Escuchar cambios en la batería
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(battery.level);
          updatePowerSavingMode(battery.level, battery.charging);
        });
        
        battery.addEventListener('chargingchange', () => {
          setIsCharging(battery.charging);
          updatePowerSavingMode(battery.level, battery.charging);
        });
        
        console.log("Monitoreo de batería iniciado:", {
          level: battery.level,
          charging: battery.charging
        });
      } else {
        console.log("API de batería no disponible en este dispositivo");
      }
    } catch (error) {
      console.error("Error al inicializar monitoreo de batería:", error);
    }
  };
  
  const updatePowerSavingMode = (level: number, charging: boolean) => {
    const shouldActivate = !charging && level < 0.3;
    if (shouldActivate !== powerSavingActive) {
      setPowerSavingActive(shouldActivate);
      setPowerSavingMode(shouldActivate);
      console.log(`Modo de ahorro de energía ${shouldActivate ? 'activado' : 'desactivado'}`);
    }
  };

  const stopCamera = async () => {
    if (stream) {
      console.log("Stopping camera stream and turning off torch");
      stream.getTracks().forEach(track => {
        try {
          if (track.kind === 'video' && track.getCapabilities()?.torch) {
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error desactivando linterna:", err));
          }
          
          track.stop();
        } catch (err) {
          console.error("Error al detener track:", err);
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      retryAttemptsRef.current = 0;
      measurementDurationRef.current = 0;
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isWindows = /windows nt/i.test(navigator.userAgent);

      // Iniciar medición de duración
      measurementDurationRef.current = Date.now();
      
      // Configurar resolución según nivel de batería y plataforma
      let idealWidth = 1280;
      let idealHeight = 720;
      let targetFrameRate = 30;
      
      if (powerSavingActive || (!isCharging && batteryLevel < 0.5)) {
        console.log("Aplicando configuración de bajo consumo para la cámara");
        idealWidth = 640;
        idealHeight = 480;
        targetFrameRate = 15;
        
        if (batteryLevel < 0.2) {
          idealWidth = 320;
          idealHeight = 240;
          targetFrameRate = 10;
        }
      }

      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: idealWidth },
        height: { ideal: idealHeight },
        frameRate: { ideal: targetFrameRate }
      };

      if (isAndroid) {
        console.log("Configurando para Android");
        // La configuración ya ha sido ajustada según energía
      } else if (isIOS) {
        console.log("Configurando para iOS");
        // Ajustar según energía pero manteniendo optimizaciones específicas
        if (!powerSavingActive && isCharging) {
          Object.assign(baseVideoConstraints, {
            frameRate: { ideal: 30 }
          });
        }
      } else if (isWindows) {
        console.log("Configurando para Windows con resolución adaptativa");
        // La configuración ya ha sido ajustada según energía
      } else {
        console.log("Configurando para escritorio con resolución adaptativa");
        // La configuración ya ha sido ajustada según energía
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("Intentando acceder a la cámara con configuración:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Cámara inicializada correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Capacidades de la cámara:", capabilities);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          // Solo activar linterna si no estamos en modo de ahorro y batería no está baja
          const shouldUseTorch = !(powerSavingActive || (batteryLevel < 0.2 && !isCharging));
          
          if (isAndroid) {
            try {
              if (capabilities.torch && shouldUseTorch) {
                console.log("Activando linterna en Android");
                await videoTrack.applyConstraints({
                  advanced: [{ torch: true }]
                });
                setTorchEnabled(true);
              } else if (!shouldUseTorch) {
                console.log("Linterna desactivada para ahorrar batería");
              }
            } catch (err) {
              console.error("Error al activar linterna en Android:", err);
            }
          } else {
            if (capabilities.exposureMode) {
              const exposureConstraint: MediaTrackConstraintSet = { 
                exposureMode: 'continuous' 
              };
              
              if (capabilities.exposureCompensation?.max) {
                exposureConstraint.exposureCompensation = capabilities.exposureCompensation.max;
              }
              
              advancedConstraints.push(exposureConstraint);
            }
            
            if (capabilities.focusMode) {
              advancedConstraints.push({ focusMode: 'continuous' });
            }
            
            if (capabilities.whiteBalanceMode) {
              advancedConstraints.push({ whiteBalanceMode: 'continuous' });
            }
            
            if (capabilities.brightness && capabilities.brightness.max) {
              const maxBrightness = capabilities.brightness.max;
              const brightnessValue = powerSavingActive ? 
                                     maxBrightness * 0.1 : // Menor brillo para ahorrar batería
                                     maxBrightness * 0.2;
              advancedConstraints.push({ brightness: brightnessValue });
            }
            
            if (capabilities.contrast && capabilities.contrast.max) {
              const maxContrast = capabilities.contrast.max;
              advancedConstraints.push({ contrast: maxContrast * 0.6 });
            }

            if (advancedConstraints.length > 0) {
              console.log("Aplicando configuraciones avanzadas:", advancedConstraints);
              await videoTrack.applyConstraints({
                advanced: advancedConstraints
              });
            }

            if (capabilities.torch && shouldUseTorch) {
              console.log("Activando linterna para mejorar la señal PPG");
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
            } else if (!shouldUseTorch) {
              console.log("Linterna desactivada para ahorrar batería");
            } else {
              console.log("La linterna no está disponible en este dispositivo");
            }
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
        
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.imageRendering = 'crisp-edges';
        
        videoRef.current.style.backfaceVisibility = 'hidden';
        videoRef.current.style.perspective = '1000px';
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      retryAttemptsRef.current = 0;
      
      // Configurar temporizador para detectar mediciones prolongadas
      checkForLongMeasurements();
      
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000);
      } else {
        console.error(`Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
      }
    }
  };
  
  const checkForLongMeasurements = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    inactivityTimerRef.current = window.setTimeout(() => {
      const measurementDuration = Date.now() - measurementDurationRef.current;
      
      // Si la medición ha durado más que el umbral
      if (measurementDuration > longMeasurementThreshold) {
        console.log("Medición prolongada detectada, activando ahorro de energía");
        
        // Activar modo de ahorro si la batería no está cargando o está por debajo del 50%
        if (!isCharging || batteryLevel < 0.5) {
          setPowerSavingActive(true);
          setPowerSavingMode(true);
          
          // Reducir uso de linterna para mediciones largas
          if (torchEnabled && stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack && videoTrack.getCapabilities()?.torch) {
              console.log("Apagando linterna para ahorrar batería en medición prolongada");
              videoTrack.applyConstraints({
                advanced: [{ torch: false }]
              }).then(() => {
                setTorchEnabled(false);
              }).catch(err => {
                console.error("Error desactivando linterna:", err);
              });
            }
          }
        }
      }
      
      // Verificar nuevamente después
      inactivityTimerRef.current = window.setTimeout(checkForLongMeasurements, 10000);
    }, 10000); // Verificar cada 10 segundos
  };

  const refreshAutoFocus = useCallback(async () => {
    if (stream && !isFocusing && !isAndroid) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.focusMode) {
        try {
          setIsFocusing(true);
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'manual' }]
          });
          await new Promise(resolve => setTimeout(resolve, 100));
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
          console.log("Auto-enfoque refrescado con éxito");
        } catch (err) {
          console.error("Error al refrescar auto-enfoque:", err);
        } finally {
          setIsFocusing(false);
        }
      }
    }
  }, [stream, isFocusing, isAndroid]);

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring]);

  useEffect(() => {
    if (stream && isFingerDetected && !torchEnabled && !powerSavingActive) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna después de detectar dedo");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          setTorchEnabled(true);
        }).catch(err => {
          console.error("Error activando linterna:", err);
        });
      }
    }
    
    if (isFingerDetected && !isAndroid) {
      const focusInterval = setInterval(refreshAutoFocus, 5000);
      return () => clearInterval(focusInterval);
    }
  }, [stream, isFingerDetected, torchEnabled, refreshAutoFocus, isAndroid, powerSavingActive]);

  // Ajustar la tasa de frames según calidad de señal y estado de energía
  const getFPSForConditions = (): number => {
    if (powerSavingActive) {
      return isAndroid ? 5 : 10;
    }
    
    if (isAndroid) {
      return 10;
    }
    
    if (signalQuality > 70) {
      return batteryLevel < 0.5 && !isCharging ? 15 : 30;
    }
    
    return 15;
  };

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
        backfaceVisibility: 'hidden',
        imageRendering: 'crisp-edges'
      }}
    />
  );
};

export default CameraView;
