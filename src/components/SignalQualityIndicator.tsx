
import React, { useMemo } from 'react';
import { Gauge, Heart, XCircle, AlertCircle } from 'lucide-react';
import { FingerDetector } from '../modules/finger-detection/FingerDetector';

interface SignalQualityIndicatorProps {
  quality: number;
  isFingerDetected: boolean;
  heartRate?: number;
  perfusionIndex?: number;
  showDetailedInfo?: boolean;
}

/**
 * Componente que muestra indicadores visuales de calidad de señal
 * Proporciona feedback al usuario para optimizar la colocación del dedo
 */
const SignalQualityIndicator: React.FC<SignalQualityIndicatorProps> = ({
  quality,
  isFingerDetected,
  heartRate = 0,
  perfusionIndex = 0,
  showDetailedInfo = false
}) => {
  // Detector estático para acceder a configuración de umbrales
  const fingerDetector = useMemo(() => new FingerDetector(), []);
  
  // Determinar nivel de calidad y color basado en la calidad de la señal
  const {
    qualityText,
    qualityColorClass,
    fingerStatusText,
    infoText,
    ringPercentage
  } = useMemo(() => {
    // Calidad basada en el valor numérico
    let qualityText = "Señal débil";
    let qualityColorClass = "text-red-500";
    let ringColorClass = "from-red-500 to-rose-500";
    let ringPercentage = quality;
    let fingerStatusText = isFingerDetected ? "Dedo detectado" : "Sin dedo";
    let infoText = "Coloque su dedo sobre la cámara";
    
    // Calcular resultado completo para obtener nivel y mensaje
    const detectionResult = fingerDetector.processQuality(quality, 150, 80);
    
    // Determinar texto y color según nivel de calidad
    if (!isFingerDetected) {
      qualityText = "Sin señal";
      qualityColorClass = "text-gray-400";
      ringColorClass = "from-gray-400 to-gray-500";
      infoText = detectionResult.helpMessage;
    } else if (quality >= 70) {
      qualityText = "Señal óptima";
      qualityColorClass = "text-green-500";
      ringColorClass = "from-green-500 to-emerald-500";
      infoText = "Mantén el dedo quieto para mediciones precisas";
    } else if (quality >= 45) {
      qualityText = "Señal buena";
      qualityColorClass = "text-green-400";
      ringColorClass = "from-green-400 to-green-500";
      infoText = "La señal es buena, mantén el dedo quieto";
    } else if (quality >= 25) {
      qualityText = "Señal aceptable";
      qualityColorClass = "text-yellow-500";
      ringColorClass = "from-yellow-500 to-orange-500";
      infoText = "Ajusta ligeramente el dedo para mejorar la señal";
    }
    
    return {
      qualityText,
      qualityColorClass,
      ringColorClass,
      fingerStatusText,
      infoText,
      ringPercentage
    };
  }, [quality, isFingerDetected, fingerDetector]);
  
  return (
    <div className="w-full flex flex-col items-center space-y-2 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-gray-200/30">
      {/* Indicador principal de calidad */}
      <div className="w-full flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <Gauge className={`h-5 w-5 ${qualityColorClass}`} />
          <span className={`text-sm font-semibold ${qualityColorClass}`}>
            {qualityText}
          </span>
        </div>
        
        <div className="text-xs text-gray-500 flex items-center gap-1">
          {isFingerDetected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>{fingerStatusText}</span>
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5 text-gray-400" />
              <span>{fingerStatusText}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Barra de calidad */}
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${
            isFingerDetected ? fingerDetector.getConfig().state.fingerDetected ? "from-green-500 to-emerald-500" : "from-gray-400 to-gray-500" : "from-gray-400 to-gray-500"
          }`}
          style={{ width: `${isFingerDetected ? quality : 0}%` }}
        ></div>
      </div>
      
      {/* Mensaje de ayuda */}
      <div className="w-full text-center">
        <span className="text-xs text-gray-600">{infoText}</span>
      </div>
      
      {/* Información detallada (opcional) */}
      {showDetailedInfo && (
        <div className="w-full grid grid-cols-2 gap-2 mt-2">
          <div className="flex flex-col items-center p-2 bg-white/20 rounded-md">
            <div className="flex items-center gap-1">
              <Heart className="h-4 w-4 text-red-500" />
              <span className="text-xs text-gray-600">Ritmo cardíaco</span>
            </div>
            <span className="text-lg font-semibold">
              {isFingerDetected && fingerDetector.getConfig().state.fingerDetected && heartRate > 0 ? `${heartRate} bpm` : '-'}
            </span>
          </div>
          
          <div className="flex flex-col items-center p-2 bg-white/20 rounded-md">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-gray-600">Perfusión</span>
            </div>
            <span className="text-lg font-semibold">
              {isFingerDetected && fingerDetector.getConfig().state.fingerDetected && perfusionIndex > 0 ? `${perfusionIndex.toFixed(1)}%` : '-'}
            </span>
          </div>
        </div>
      )}
      
      {/* Información de parámetros técnicos (solo para desarrollo) */}
      {import.meta.env.DEV && (
        <div className="w-full mt-2 text-[0.65rem] text-gray-500 border-t border-gray-200 pt-1">
          <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
            <div>Umbral: {fingerDetector.getConfig().thresholds.perfusion}</div>
            <div>Estabilidad: {fingerDetector.getConfig().state.qualityStability}</div>
            <div>Detecciones: {fingerDetector.getConfig().state.consecutiveDetections}/{fingerDetector.getConfig().thresholds.requiredFrames || 5}</div>
            <div>Dispositivo: {fingerDetector.getConfig().device}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignalQualityIndicator;
