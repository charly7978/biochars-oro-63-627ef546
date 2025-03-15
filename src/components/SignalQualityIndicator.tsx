
import React, { useState, useEffect } from 'react';
import { Vibration } from '../utils/Vibration';

// Import only the necessary config from FingerDetector
import { FingerDetector } from '../modules/finger-detection/FingerDetector';

interface SignalQualityIndicatorProps {
  quality: number;
  isFingerPresent: boolean;
  qualityLevel?: string;
}

/**
 * Constants for quality thresholds
 */
const QUALITY_CONSTANTS = {
  LOW_QUALITY_THRESHOLD: 25,
  MEDIUM_QUALITY_THRESHOLD: 50,
  HIGH_QUALITY_THRESHOLD: 75,
  QUALITY_THRESHOLD: 70
};

const SignalQualityIndicator: React.FC<SignalQualityIndicatorProps> = ({
  quality,
  isFingerPresent,
  qualityLevel = 'BAJO'
}) => {
  const [lastVibrationTime, setLastVibrationTime] = useState(0);
  const [lastStatus, setLastStatus] = useState('');

  // Create a detector instance just to get the configuration
  const fingerDetector = new FingerDetector();
  const config = fingerDetector.getConfig();

  /**
   * Determinar color y mensajes basados en la calidad
   */
  const getQualityInfo = (quality: number, isFingerPresent: boolean) => {
    let qualityColor = 'text-red-500';
    let helpMessage = 'Coloca tu dedo en la cámara';

    if (!isFingerPresent) {
      return {
        qualityColor: 'text-gray-400',
        helpMessage: 'Coloca tu dedo en la cámara'
      };
    }

    if (quality >= QUALITY_CONSTANTS.HIGH_QUALITY_THRESHOLD) {
      qualityColor = 'text-emerald-500';
      helpMessage = 'Excelente señal! Mantenga esta posición';
    } else if (quality >= QUALITY_CONSTANTS.MEDIUM_QUALITY_THRESHOLD) {
      qualityColor = 'text-amber-500';
      helpMessage = 'Buena señal, mantén el dedo quieto';
    } else if (quality >= config.MIN_QUALITY_FOR_DETECTION) {
      qualityColor = 'text-orange-500';
      helpMessage = 'Señal aceptable, ajusta la posición';
    } else {
      qualityColor = 'text-red-500';
      helpMessage = 'Señal débil, cubre toda la cámara con tu dedo';
    }

    return { qualityColor, helpMessage };
  };

  const { qualityColor, helpMessage } = getQualityInfo(quality, isFingerPresent);

  // Vibrate and update status when needed
  useEffect(() => {
    const currentTime = Date.now();
    const timeSinceLastVibration = currentTime - lastVibrationTime;
    const MIN_VIBRATION_INTERVAL = 2000; // 2 seconds between vibrations

    let newStatus = '';
    
    if (!isFingerPresent) {
      newStatus = 'no-finger';
    } else if (quality >= QUALITY_CONSTANTS.QUALITY_THRESHOLD) {
      newStatus = 'good-quality';
    } else {
      newStatus = 'low-quality';
    }

    // Only vibrate if status changed and enough time has passed
    if (newStatus !== lastStatus && timeSinceLastVibration > MIN_VIBRATION_INTERVAL) {
      if (newStatus === 'no-finger') {
        Vibration.vibrate(200);
      } else if (newStatus === 'good-quality') {
        Vibration.vibrate([100, 100, 100]);
      }
      
      setLastVibrationTime(currentTime);
    }
    
    setLastStatus(newStatus);
  }, [isFingerPresent, quality, lastVibrationTime, lastStatus]);

  return (
    <div className="flex flex-col items-center mt-2 overflow-hidden">
      <div className="flex items-center mb-1">
        <div className={`text-lg font-semibold ${qualityColor}`}>
          {isFingerPresent ? `${qualityLevel || 'BAJO'} (${quality}%)` : 'NO DETECTADO'}
        </div>
        
        <div className="ml-2 flex space-x-1">
          {[...Array(5)].map((_, i) => {
            let dotColor = 'bg-gray-300';
            
            if (isFingerPresent) {
              if (i < Math.ceil(quality / 20)) {
                if (quality >= QUALITY_CONSTANTS.HIGH_QUALITY_THRESHOLD) {
                  dotColor = 'bg-emerald-500';
                } else if (quality >= QUALITY_CONSTANTS.MEDIUM_QUALITY_THRESHOLD) {
                  dotColor = 'bg-amber-500';
                } else if (quality >= config.MIN_QUALITY_FOR_DETECTION) {
                  dotColor = 'bg-orange-500';
                } else {
                  dotColor = 'bg-red-500';
                }
              }
            }
            
            return (
              <div 
                key={i} 
                className={`h-2 w-2 rounded-full ${dotColor} transition-colors duration-300`}
              />
            );
          })}
        </div>
      </div>
      
      <p className="text-sm text-gray-600 text-center max-w-[250px]">
        {helpMessage}
      </p>
    </div>
  );
};

export default SignalQualityIndicator;
