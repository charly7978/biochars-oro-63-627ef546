
import React from 'react';
import { Heart, Shield, AlertCircle } from 'lucide-react';

interface HeartRateConfidenceDisplayProps {
  heartRate: number;
  confidence: number;
  isArrhythmia?: boolean;
  showDetails?: boolean;
  className?: string;
}

/**
 * Componente que muestra la frecuencia cardíaca con nivel de confianza
 */
const HeartRateConfidenceDisplay: React.FC<HeartRateConfidenceDisplayProps> = ({
  heartRate,
  confidence,
  isArrhythmia = false,
  showDetails = true,
  className = ''
}) => {
  // Determinar color basado en la confianza
  const getConfidenceColor = () => {
    if (confidence >= 0.9) return 'text-green-500';
    if (confidence >= 0.7) return 'text-yellow-500';
    if (confidence >= 0.5) return 'text-orange-500';
    return 'text-red-500';
  };

  // Texto descriptivo
  const getConfidenceText = () => {
    if (confidence >= 0.9) return 'Alta precisión';
    if (confidence >= 0.7) return 'Precisión media';
    if (confidence >= 0.5) return 'Precisión baja';
    return 'Poco confiable';
  };

  // Etiqueta según rango de frecuencia cardíaca
  const getHeartRateLabel = () => {
    if (!heartRate || heartRate < 40) return 'Datos insuficientes';
    if (heartRate < 60) return 'Bradicardia';
    if (heartRate <= 100) return 'Normal';
    if (heartRate <= 120) return 'Elevada';
    return 'Taquicardia';
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-2">
        <Heart 
          className={`h-6 w-6 ${isArrhythmia ? 'text-red-500' : 'text-rose-500'}`} 
          fill="currentColor"
        />
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {heartRate || '--'}
            </span>
            <span className="text-sm">BPM</span>
            
            {confidence > 0 && (
              <Shield 
                className={`h-4 w-4 ${getConfidenceColor()}`} 
                fill={confidence >= 0.7 ? "currentColor" : "none"}
              />
            )}
          </div>
          
          {showDetails && (
            <div className="flex items-center gap-1 text-xs">
              <span className={getConfidenceColor()}>
                {(confidence * 100).toFixed(0)}% - {getConfidenceText()}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {showDetails && heartRate > 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span className={`
            ${heartRate >= 60 && heartRate <= 100 ? 'text-green-500' : 'text-amber-500'}
            font-medium
          `}>
            {getHeartRateLabel()}
          </span>
          
          {isArrhythmia && (
            <>
              <span className="text-gray-400">•</span>
              <span className="text-red-500 font-medium flex items-center gap-0.5">
                <AlertCircle className="h-3 w-3" />
                Arritmia
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HeartRateConfidenceDisplay;
