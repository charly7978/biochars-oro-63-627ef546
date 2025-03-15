
import React, { useState, useEffect } from 'react';
import { AlertCircle, Hand } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  isFingerDetected: boolean;
  isMonitoring?: boolean;
}

/**
 * Componente que muestra la calidad de la señal PPG y estado de detección de dedo
 */
const SignalQualityIndicator = ({ 
  quality, 
  isFingerDetected, 
  isMonitoring = false 
}: SignalQualityIndicatorProps) => {
  // Estado local
  const [displayQuality, setDisplayQuality] = useState(0);
  const [qualityHistory, setQualityHistory] = useState<number[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showHelpTip, setShowHelpTip] = useState(false);
  const [noFingerDetectionTime, setNoFingerDetectionTime] = useState(0);
  
  // Constantes de configuración
  const historySize = 5;
  const QUALITY_THRESHOLD = 50;
  const HELP_DELAY_MS = 2000;
  const NO_FINGER_MESSAGE_DELAY_MS = 5000;

  // Detectar plataforma
  useEffect(() => {
    const androidDetected = /android/i.test(navigator.userAgent);
    setIsAndroid(androidDetected);
    
    // Mostrar tip de ayuda después de un delay
    if (isMonitoring) {
      const timer = setTimeout(() => setShowHelpTip(true), HELP_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      setShowHelpTip(false);
    }
  }, [isMonitoring]);

  // Mantener historial de calidad para promedio
  useEffect(() => {
    if (isMonitoring) {
      // Solo actualizar quality history si hay dedo detectado
      if (isFingerDetected) {
        setQualityHistory(prev => {
          const newHistory = [...prev, quality];
          return newHistory.slice(-historySize);
        });
        setNoFingerDetectionTime(0);
      } else {
        // Si no hay dedo detectado, empezar a contar el tiempo
        if (noFingerDetectionTime === 0) {
          setNoFingerDetectionTime(Date.now());
        }
        // Establecer calidad a cero cuando no hay dedo
        setDisplayQuality(0);
      }
    } else {
      // Reset cuando no estamos monitoreando
      setQualityHistory([]);
      setDisplayQuality(0);
      setNoFingerDetectionTime(0);
    }
  }, [quality, isMonitoring, isFingerDetected, noFingerDetectionTime]);

  // Calcular calidad ponderada con más peso a valores recientes
  useEffect(() => {
    if (!isFingerDetected || qualityHistory.length === 0) {
      setDisplayQuality(0);
      return;
    }

    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      const weight = index + 1; // Valores más recientes tienen más peso
      weightedSum += q * weight;
      totalWeight += weight;
    });

    const averageQuality = Math.round(weightedSum / totalWeight);
    
    // Suavizar cambios para mejor UX
    setDisplayQuality(prev => {
      const delta = (averageQuality - prev) * 0.3;
      return Math.round(prev + delta);
    });
  }, [qualityHistory, isFingerDetected]);

  /**
   * Obtiene el color basado en la calidad
   */
  const getQualityColor = (q: number) => {
    if (!isFingerDetected) return '#666666';
    if (q === 0) return '#666666';
    if (q > 65) return '#00ff00';
    if (q > 40) return '#ffff00';
    return '#ff0000';
  };

  /**
   * Obtiene el texto descriptivo de calidad
   */
  const getQualityText = (q: number) => {
    if (!isFingerDetected) return 'Sin Dedo';
    if (q === 0) return 'Sin Dedo';
    if (q > 65) return 'Excelente';
    if (q > 40) return 'Buena';
    return 'Baja';
  };

  // Efecto de pulso adaptado a la plataforma
  const pulseStyle = isFingerDetected && displayQuality > 0 
    ? isAndroid ? "animate-pulse transition-all duration-500" : "animate-pulse transition-all duration-300" 
    : "transition-all duration-300";

  // Determinar si mostrar mensaje de ayuda prolongado
  const showNoFingerMessage = isMonitoring && 
                              !isFingerDetected && 
                              noFingerDetectionTime > 0 && 
                              (Date.now() - noFingerDetectionTime) > NO_FINGER_MESSAGE_DELAY_MS;

  return (
    <div className="bg-black/30 backdrop-blur-md rounded p-1 w-full relative" style={{ marginTop: "-9mm" }}>
      <div className="flex items-center gap-1">
        <div 
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${pulseStyle}`}
          style={{
            borderColor: getQualityColor(displayQuality),
            backgroundColor: `${getQualityColor(displayQuality)}33`
          }}
        >
          {isFingerDetected ? (
            <span className="text-[9px] font-bold text-white">{displayQuality}%</span>
          ) : (
            <Hand className="h-3 w-3 text-white/70" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] font-semibold text-white/90">
              {isFingerDetected ? "Calidad de Señal" : "Estado del Sensor"}
            </span>
            <span 
              className="text-[9px] font-medium"
              style={{ color: getQualityColor(displayQuality) }}
            >
              {getQualityText(displayQuality)}
            </span>
          </div>

          <div className="w-full h-0.5 bg-gray-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-300"
              style={{
                width: `${isFingerDetected ? displayQuality : 0}%`,
                backgroundColor: getQualityColor(displayQuality)
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Consejos de ayuda específicos */}
      {isMonitoring && showHelpTip && !isFingerDetected && (
        <div className="absolute -bottom-20 left-0 right-0 bg-black/80 p-2 rounded text-white text-xs flex items-center gap-1">
          <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
          <span>
            {showNoFingerMessage 
              ? "NO SE DETECTA DEDO. Coloque su dedo índice sobre la cámara cubriendo completamente la lente y la luz."
              : "Coloque su dedo sobre la cámara cubriendo completamente el lente y la luz."}
          </span>
        </div>
      )}
    </div>
  );
};

export default SignalQualityIndicator;
