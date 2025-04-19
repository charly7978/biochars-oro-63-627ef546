
import React, { useRef, useEffect, useState, useCallback } from 'react';

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
  const [isIOS, setIsIOS] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const torchRetryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 5; // Increased from 3 for better reliability
  const lastDeviceIdRef = useRef<string>('');
  const torchIntervalRef = useRef<number | null>(null);

  // Detect device platform
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const iosDetected = /ipad|iphone|ipod/i.test(userAgent);
    const windowsDetected = /windows nt/i.test(userAgent);
    
    console.log("Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isIOS: iosDetected,
      isWindows: windowsDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsIOS(iosDetected);
    setIsWindows(windowsDetected);
  }, []);

  // Helper to ensure torch is enabled
  const ensureTorchEnabled = useCallback(async () => {
    if (!stream) return false;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities()?.torch) {
      return false;
    }
    
    try {
      console.log("Intentando activar linterna explícitamente");
      await videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      });
      return true;
    } catch (err) {
      console.error("Error activando linterna:", err);
      return false;
    }
  }, [stream]);

  // Stop camera stream and clean up
  const stopCamera = async () => {
    if (stream) {
      console.log("Stopping camera stream and turning off torch");
      
      try {
        // First turn off the torch if enabled
        if (torchEnabled) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack && videoTrack.getCapabilities()?.torch) {
            await videoTrack.applyConstraints({
              advanced: [{ torch: false }]
            });
            console.log("Torch turned off successfully");
          }
        }
        
        // Clear torch interval if active
        if (torchIntervalRef.current) {
          clearInterval(torchIntervalRef.current);
          torchIntervalRef.current = null;
        }
        
        // Then stop all tracks
        stream.getTracks().forEach(track => {
          try {
            track.stop();
            console.log(`Track ${track.kind} stopped successfully`);
          } catch (err) {
            console.error("Error stopping track:", err);
          }
        });
      } catch (err) {
        console.error("Error during camera cleanup:", err);
      }
      
      // Clear video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      retryAttemptsRef.current = 0;
      torchRetryAttemptsRef.current = 0;
      console.log("Camera stopped successfully");
    }
  };

  // Start camera with platform-specific optimizations
  const startCamera = async () => {
    try {
      console.log("Starting camera initialization...");
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado en este navegador");
      }

      // Get list of available devices to choose the best camera
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log(`Found ${videoDevices.length} video devices:`, videoDevices.map(d => d.label || `Device ${d.deviceId.substring(0, 5)}...`));
      
      // Prefer rear camera for mobile devices
      let preferredDeviceId = '';
      
      if (isAndroid || isIOS) {
        // On mobile, look for environment-facing cameras or cameras with "back" in the name
        const rearCameras = videoDevices.filter(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('trasera') ||
          device.label.toLowerCase().includes('environment')
        );
        
        if (rearCameras.length > 0) {
          preferredDeviceId = rearCameras[0].deviceId;
          console.log("Selected rear camera:", rearCameras[0].label || preferredDeviceId);
        }
      }
      
      // If we have a previously successful device, try it first
      if (lastDeviceIdRef.current && videoDevices.some(d => d.deviceId === lastDeviceIdRef.current)) {
        preferredDeviceId = lastDeviceIdRef.current;
        console.log("Using previously successful camera device");
      }

      // Platform-specific constraints
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: preferredDeviceId ? undefined : 'environment',
        deviceId: preferredDeviceId ? { exact: preferredDeviceId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (isAndroid) {
        console.log("Configuring for Android");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 640 }, // Lower resolution for better performance
          height: { ideal: 480 }
        });
      } else if (isIOS) {
        console.log("Configuring for iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        });
      } else if (isWindows) {
        console.log("Configuring for Windows");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 640 },
          height: { ideal: 480 }
        });
      } else {
        console.log("Configuring for generic desktop");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 640 },
          height: { ideal: 480 }
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("Trying to access camera with configuration:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera initialized successfully");
      
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        // Save successful device ID for future use
        lastDeviceIdRef.current = videoTrack.getSettings().deviceId || '';
        
        // Add a track ended listener to auto-retry if it fails
        videoTrack.addEventListener('ended', () => {
          console.log("Video track ended unexpectedly, attempting to restart");
          stopCamera().then(() => {
            setTimeout(() => {
              if (isMonitoring) {
                startCamera();
              }
            }, 500);
          });
        });
        
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Camera capabilities:", capabilities);
          
          // Allow some time for camera to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Apply platform-specific optimizations
          if (isAndroid) {
            try {
              if (capabilities.torch) {
                console.log("Activando linterna en Android");
                await videoTrack.applyConstraints({
                  advanced: [{ torch: true }]
                });
                setTorchEnabled(true);
                console.log("Android torch enabled successfully");
              }
            } catch (err) {
              console.error("Error al activar linterna en Android:", err);
              // Schedule torch retry 
              torchRetryAttemptsRef.current = 0;
              scheduleTorchRetry();
            }
          } else {
            // Apply camera optimizations for non-Android devices
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
            
            // Try to apply each constraint set individually for maximum compatibility
            if (advancedConstraints.length > 0) {
              for (const constraint of advancedConstraints) {
                try {
                  await videoTrack.applyConstraints({ advanced: [constraint] });
                  console.log("Applied camera optimization:", constraint);
                } catch (err) {
                  console.log("Failed to apply constraint:", constraint, err);
                }
              }
            }

            // Always try to enable torch last
            if (capabilities.torch) {
              try {
                console.log("Activando linterna para mejorar la señal PPG");
                await videoTrack.applyConstraints({
                  advanced: [{ torch: true }]
                });
                setTorchEnabled(true);
                console.log("Torch enabled successfully");
              } catch (err) {
                console.error("Error activando linterna:", err);
                // Schedule torch retry
                torchRetryAttemptsRef.current = 0;
                scheduleTorchRetry();
              }
            } else {
              console.log("La linterna no está disponible en este dispositivo");
            }
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      // Set up video element with performance optimizations
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.backfaceVisibility = 'hidden';
        videoRef.current.style.perspective = '1000px';
        videoRef.current.style.imageRendering = 'crisp-edges';
      }

      setStream(newStream);
      
      // Notify parent about the stream
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      // Reset retry counter after successful initialization
      retryAttemptsRef.current = 0;
      
      // Set up periodic torch check
      if (torchIntervalRef.current) {
        clearInterval(torchIntervalRef.current);
      }
      
      torchIntervalRef.current = window.setInterval(() => {
        if (isMonitoring && !torchEnabled) {
          ensureTorchEnabled()
            .then(success => {
              if (success) {
                setTorchEnabled(true);
                console.log("Torch activated via periodic check");
              }
            });
        }
      }, 5000);
      
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      
      // Retry with fallback constraints
      retryAttemptsRef.current++;
      
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`Reintentando iniciar cámara con configuración simplificada (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        
        // Use progressively simpler constraints with each retry
        setTimeout(() => {
          retryWithSimplifiedConstraints(retryAttemptsRef.current);
        }, 1000);
      } else {
        console.error(`Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
      }
    }
  };

  // Schedule a torch retry with backoff
  const scheduleTorchRetry = () => {
    setTimeout(() => {
      if (stream && !torchEnabled && torchRetryAttemptsRef.current < 5) {
        torchRetryAttemptsRef.current++;
        console.log(`Retrying torch activation (attempt ${torchRetryAttemptsRef.current}/5)`);
        ensureTorchEnabled()
          .then(success => {
            if (success) {
              setTorchEnabled(true);
              console.log("Torch activated on retry");
            } else if (torchRetryAttemptsRef.current < 5) {
              scheduleTorchRetry();
            }
          });
      }
    }, torchRetryAttemptsRef.current * 1000); // Increasing backoff
  };

  // Retry camera initialization with simpler constraints
  const retryWithSimplifiedConstraints = async (retryCount: number) => {
    try {
      console.log(`Retry attempt ${retryCount} with simplified constraints`);
      
      // Progressive simplification of constraints with each retry
      const constraints: MediaStreamConstraints = {
        video: retryCount >= 3 ? true : {
          facingMode: retryCount >= 2 ? undefined : 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        },
        audio: false
      };
      
      console.log("Retry constraints:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      
      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      console.log("Camera restarted successfully with simplified constraints");
      
      // Try to enable torch after a slight delay to allow camera to initialize
      setTimeout(() => {
        const videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities()?.torch) {
          console.log("Activando linterna después de reinicio");
          videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          }).then(() => {
            setTorchEnabled(true);
            console.log("Torch enabled after retry");
          }).catch(err => {
            console.error("Error activando linterna después de reinicio:", err);
            scheduleTorchRetry();
          });
        }
      }, 1000);
      
    } catch (err) {
      console.error(`Retry attempt ${retryCount} failed:`, err);
      
      if (retryCount < maxRetryAttempts) {
        setTimeout(() => {
          retryWithSimplifiedConstraints(retryCount + 1);
        }, 1000);
      }
    }
  };

  // Function to refresh auto-focus periodically
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

  // Start/stop camera based on monitoring state
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
      if (torchIntervalRef.current) {
        clearInterval(torchIntervalRef.current);
        torchIntervalRef.current = null;
      }
      stopCamera();
    };
  }, [isMonitoring]);

  // Enable torch when finger is detected
  useEffect(() => {
    if (stream && isFingerDetected && !torchEnabled) {
      console.log("Finger detected, ensuring torch is enabled");
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna después de detectar dedo");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          setTorchEnabled(true);
          console.log("Torch enabled after finger detection");
        }).catch(err => {
          console.error("Error activando linterna:", err);
          scheduleTorchRetry();
        });
      }
    }
    
    // Set up periodic auto-focus for non-Android devices when finger is detected
    if (isFingerDetected && !isAndroid && stream) {
      console.log("Setting up periodic auto-focus refresh");
      const focusInterval = setInterval(refreshAutoFocus, 5000);
      return () => clearInterval(focusInterval);
    }
  }, [stream, isFingerDetected, torchEnabled, refreshAutoFocus, isAndroid]);

  // Activate torch when not enabled but should be
  useEffect(() => {
    if (stream && isMonitoring && !torchEnabled) {
      // Try to enable torch every second until successful
      const torchInterval = setInterval(() => {
        if (!torchEnabled) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack && videoTrack.getCapabilities()?.torch) {
            videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            }).then(() => {
              setTorchEnabled(true);
              console.log("Torch enabled by interval");
              clearInterval(torchInterval);
            }).catch(err => {
              console.log("Torch activation attempt failed:", err);
            });
          } else {
            clearInterval(torchInterval); // Stop if torch not available
          }
        } else {
          clearInterval(torchInterval); // Stop if torch already enabled
        }
      }, 2000);

      return () => clearInterval(torchInterval);
    }
  }, [stream, isMonitoring, torchEnabled]);

  // Set framerate based on platform and signal quality
  const targetFrameInterval = isAndroid ? 1000/15 : 
                             signalQuality > 70 ? 1000/30 : 1000/15;

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
