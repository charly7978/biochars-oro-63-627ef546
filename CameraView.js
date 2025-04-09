import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Fingerprint, Video } from 'lucide-react';

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
  const [textureChanges, setTextureChanges] = useState(0);
  const brightnessSampleLimit = 15; // Increased for better stability
  const canvasRef = useRef(document.createElement('canvas'));
  const contextRef = useRef(null);
  const previousImageDataRef = useRef(null);
  const fingerDetectionRef = useRef({
    consecutiveFingerFrames: 0,
    consecutiveNoFingerFrames: 0,
    confidenceLevel: 0,
    lastBrightness: 0,
    textureHistory: []
  });
  
  // Enhanced finger detection options
  const FINGER_BRIGHTNESS_THRESHOLD = 70; // Lower brightness threshold (darker for finger)
  const FINGER_TEXTURE_THRESHOLD = 12;   // Texture variation threshold
  const MIN_CONFIDENCE_FRAMES = 4;       // Consecutive frames needed to confirm finger
  const MIN_RELEASE_FRAMES = 6;          // Consecutive frames needed to confirm finger removal

  const stopCamera = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      });
      setStream(null);
      fingerDetectionRef.current = {
        consecutiveFingerFrames: 0,
        consecutiveNoFingerFrames: 0,
        confidenceLevel: 0,
        lastBrightness: 0,
        textureHistory: []
      };
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

      // Optimized video constraints 
      const baseVideoConstraints = {
        facingMode: 'environment',
        width: { ideal: isIOS ? 640 : 720 },
        height: { ideal: isIOS ? 480 : 480 }
      };

      // Platform-specific optimizations
      if (isAndroid) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
          resizeMode: 'crop-and-scale'
        });
      } else if (isIOS) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 }
        });
      }

      const constraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Requesting camera with constraints:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          // Apply appropriate camera settings
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
          if (capabilities.exposureCompensation) {
            // Slightly increase exposure for better finger detection
            const expMin = capabilities.exposureCompensation.min || -2;
            const expMax = capabilities.exposureCompensation.max || 2;
            const targetExp = (expMax - expMin) * 0.25 + expMin;
            advancedConstraints.push({ exposureCompensation: targetExp });
          }

          // Apply torch/flashlight if available and needed
          if (capabilities.torch) {
            // Keep torch off initially, can be enabled later if needed
            advancedConstraints.push({ torch: false });
          }

          if (advancedConstraints.length > 0) {
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
          }

          if (videoRef.current) {
            // Apply performance optimizations
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
            
            // Set playsInline for iOS
            videoRef.current.playsInline = true;
            videoRef.current.muted = true;
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones de cámara:", err);
        }
      }

      // Configure video element and set stream
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Apply performance optimizations
        if (isAndroid || isIOS) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
          
          // Request autoplay explicitly to avoid user gesture requirements
          videoRef.current.play().catch(err => {
            console.warn("Autoplay failed:", err);
          });
        }
      }

      setStream(newStream);
      
      // Initialize canvas for analysis
      if (!contextRef.current && canvasRef.current) {
        contextRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
        canvasRef.current.width = 100;
        canvasRef.current.height = 100;
      }
      
      // Notify parent component
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      // Reset finger detection state
      fingerDetectionRef.current = {
        consecutiveFingerFrames: 0,
        consecutiveNoFingerFrames: 0,
        confidenceLevel: 0,
        lastBrightness: 0,
        textureHistory: []
      };
      
      console.log("CameraView: Camera initialized successfully");
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
    }
  }, [onStreamReady]);

  // Calculate texture variation for improved finger detection
  const calculateTextureVariation = useCallback((imageData) => {
    const data = imageData.data;
    let diffSum = 0;
    const sampleStep = 4; // Sample every 4th pixel for performance
    
    // Calculate local variations (texture)
    for (let y = 1; y < 99; y += sampleStep) {
      for (let x = 1; x < 99; x += sampleStep) {
        const i = (y * 100 + x) * 4;
        const i_up = ((y-1) * 100 + x) * 4;
        const i_left = (y * 100 + (x-1)) * 4;
        
        // Calculate difference with neighbors
        const diffUp = Math.abs(data[i] - data[i_up]) + 
                      Math.abs(data[i+1] - data[i_up+1]) + 
                      Math.abs(data[i+2] - data[i_up+2]);
                      
        const diffLeft = Math.abs(data[i] - data[i_left]) + 
                        Math.abs(data[i+1] - data[i_left+1]) + 
                        Math.abs(data[i+2] - data[i_left+2]);
        
        diffSum += (diffUp + diffLeft);
      }
    }
    
    // Normalize by number of pixels
    return diffSum / (50 * 50 * 3); // Approximate number of compared pixels
  }, []);

  // Enhanced finger detection that uses multiple features
  const detectFingerPresence = useCallback((brightness, textureVariation) => {
    const { 
      consecutiveFingerFrames, 
      consecutiveNoFingerFrames,
      confidenceLevel,
      textureHistory
    } = fingerDetectionRef.current;
    
    // Update texture history
    textureHistory.push(textureVariation);
    if (textureHistory.length > 10) textureHistory.shift();
    
    // Calculate average texture
    const avgTexture = textureHistory.reduce((a, b) => a + b, 0) / textureHistory.length;
    
    // Multiple conditions for finger detection
    const isBrightnessInRange = brightness < FINGER_BRIGHTNESS_THRESHOLD;
    const isTextureSmooth = avgTexture < FINGER_TEXTURE_THRESHOLD;
    const isSignalQualityGood = signalQuality > 30;
    
    // Combined weighted decision
    let fingerScore = 0;
    if (isBrightnessInRange) fingerScore += 2; // Brightness is strong indicator
    if (isTextureSmooth) fingerScore += 1.5;   // Texture is good indicator
    if (isSignalQualityGood) fingerScore += 1; // Signal quality confirms
    
    const fingerDetected = fingerScore >= 2.5; // Threshold for detection
    
    // State tracking with hysteresis
    let newConfidenceLevel = confidenceLevel;
    let newConsecutiveFingerFrames = consecutiveFingerFrames;
    let newConsecutiveNoFingerFrames = consecutiveNoFingerFrames;
    
    if (fingerDetected) {
      newConsecutiveFingerFrames = consecutiveFingerFrames + 1;
      newConsecutiveNoFingerFrames = 0;
      
      // Increase confidence with consistent detections
      if (newConsecutiveFingerFrames >= MIN_CONFIDENCE_FRAMES) {
        newConfidenceLevel = Math.min(100, confidenceLevel + 10);
      }
    } else {
      newConsecutiveFingerFrames = 0;
      newConsecutiveNoFingerFrames = consecutiveNoFingerFrames + 1;
      
      // Decrease confidence with consistent non-detections
      if (newConsecutiveNoFingerFrames >= MIN_RELEASE_FRAMES) {
        newConfidenceLevel = Math.max(0, confidenceLevel - 15);
      }
    }
    
    // Update state
    fingerDetectionRef.current = {
      ...fingerDetectionRef.current,
      consecutiveFingerFrames: newConsecutiveFingerFrames,
      consecutiveNoFingerFrames: newConsecutiveNoFingerFrames,
      confidenceLevel: newConfidenceLevel,
      lastBrightness: brightness,
      textureHistory
    };
    
    return {
      isFingerDetected: newConfidenceLevel > 50,
      confidence: newConfidenceLevel,
      metrics: {
        brightness,
        textureVariation: avgTexture,
        signalQuality,
        fingerScore
      }
    };
  }, [signalQuality]);

  // Monitor camera brightness and texture for enhanced finger detection
  useEffect(() => {
    if (!stream || !videoRef.current || !isMonitoring || !contextRef.current) return;
    
    let animationFrameId;
    let lastAnalysisTime = 0;
    const ANALYSIS_INTERVAL = 200; // Analyze every 200ms for performance
    
    const analyzeFrame = (timestamp) => {
      if (timestamp - lastAnalysisTime > ANALYSIS_INTERVAL) {
        if (videoRef.current && videoRef.current.videoWidth) {
          try {
            const ctx = contextRef.current;
            const canvas = canvasRef.current;
            
            // Draw video frame to canvas for analysis
            ctx.drawImage(
              videoRef.current,
              0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight,
              0, 0, canvas.width, canvas.height
            );
            
            // Get image data for analysis
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Calculate brightness
            let brightness = 0;
            // Sample every 4th pixel for performance
            for (let i = 0; i < data.length; i += 16) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              // Weighted brightness that prioritizes red channel for PPG
              brightness += (r * 0.6 + g * 0.3 + b * 0.1);
            }
            
            brightness /= (data.length / 16);
            
            // Calculate texture variation for improved finger detection
            const textureVar = calculateTextureVariation(imageData);
            setTextureChanges(textureVar);
            
            // Update brightness samples
            setBrightnessSamples(prev => {
              const newSamples = [...prev, brightness];
              if (newSamples.length > brightnessSampleLimit) {
                newSamples.shift();
              }
              return newSamples;
            });
            
            // Update average brightness
            const avgBrightness = brightnessSamples.reduce((sum, val) => sum + val, brightness) / 
                                  (brightnessSamples.length + 1);
            setAvgBrightness(avgBrightness);
            
            // Enhanced finger detection
            const fingerStatus = detectFingerPresence(brightness, textureVar);
            
            // Log detailed metrics periodically
            if (Math.random() < 0.05) { // Log ~5% of the time
              console.log("CameraView: Analysis metrics", { 
                currentBrightness: brightness,
                avgBrightness,
                textureVariation: textureVar,
                fingerDetection: fingerStatus,
                providedFingerDetected: isFingerDetected,
                signalQuality
              });
            }
            
            // Update previous frame data for next analysis
            previousImageDataRef.current = imageData;
          } catch (err) {
            console.error("Error analyzing camera frame:", err);
          }
        }
        
        lastAnalysisTime = timestamp;
      }
      
      // Schedule next analysis
      animationFrameId = requestAnimationFrame(analyzeFrame);
    };
    
    // Start analysis loop
    animationFrameId = requestAnimationFrame(analyzeFrame);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [stream, isMonitoring, brightnessSamples, isFingerDetected, signalQuality, calculateTextureVariation, detectFingerPresence]);

  // Handle camera start/stop based on monitoring state
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
  }, [isMonitoring, stream, startCamera, stopCamera]);

  // Determine finger presence status using our enhanced detection
  const fingerDetectionStatus = useMemo(() => {
    // Consider both our internal detection and the provided flag
    const internalDetection = fingerDetectionRef.current.confidenceLevel > 50;
    
    return {
      detected: internalDetection || isFingerDetected,
      confidence: fingerDetectionRef.current.confidenceLevel,
      providedConfidence: signalQuality
    };
  }, [isFingerDetected, signalQuality]);

  // Determine indicator color based on combined confidence
  const getIndicatorColor = useCallback(() => {
    const { detected, confidence, providedConfidence } = fingerDetectionStatus;
    
    if (!detected) return 'text-gray-400';
    
    // Calculate combined confidence score
    const combinedConfidence = Math.max(confidence, providedConfidence);
    
    if (combinedConfidence > 75) return 'text-green-500';
    if (combinedConfidence > 50) return 'text-yellow-500';
    return 'text-red-500';
  }, [fingerDetectionStatus]);

  // Determine status message
  const getStatusMessage = useCallback(() => {
    const { detected, confidence } = fingerDetectionStatus;
    
    if (!detected) return "ubique su dedo en el lente";
    if (confidence < 60) return "mantenga el dedo quieto";
    return "dedo detectado";
  }, [fingerDetectionStatus]);

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
          backfaceVisibility: 'hidden',
          contain: 'paint layout size'
        }}
      />
      {isMonitoring && buttonPosition && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="relative">
            <Fingerprint
              size={48}
              className={`transition-colors duration-300 ${getIndicatorColor()}`}
            />
            {fingerDetectionStatus.detected && (
              <div className="absolute inset-0 rounded-full animate-pulse bg-current opacity-20"></div>
            )}
          </div>
          <span className={`text-xs mt-2 transition-colors duration-300 ${
            fingerDetectionStatus.detected ? 'text-green-500' : 'text-gray-400'
          }`}>
            {getStatusMessage()}
          </span>
        </div>
      )}
    </>
  );
};

export default React.memo(CameraView);
