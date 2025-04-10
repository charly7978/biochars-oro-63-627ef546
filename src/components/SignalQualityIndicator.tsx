
import React, { useMemo } from 'react';
import { Heart, Activity, AlertCircle, CheckCircle } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  confidence: number;
  isFingerDetected: boolean;
  hasArrhythmia?: boolean;
  showDetailed?: boolean;
  className?: string;
}

/**
 * Componente que muestra indicadores visuales detallados sobre la calidad de la señal
 * y confianza de la medición
 */
const SignalQualityIndicator: React.FC<SignalQualityIndicatorProps> = ({
  quality,
  confidence,
  isFingerDetected,
  hasArrhythmia = false,
  showDetailed = false,
  className = ''
}) => {
  // Determinar colores según calidad
  const qualityColor = useMemo(() => {
    if (quality >= 75) return 'bg-green-500';
    if (quality >= 50) return 'bg-yellow-500';
    if (quality >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  }, [quality]);

  // Determinar colores según confianza
  const confidenceColor = useMemo(() => {
    if (confidence >= 0.9) return 'text-green-500';
    if (confidence >= 0.7) return 'text-yellow-500';
    if (confidence >= 0.5) return 'text-orange-500';
    return 'text-red-500';
  }, [confidence]);

  // Texto descriptivo de la calidad
  const qualityText = useMemo(() => {
    if (quality >= 75) return 'Excelente';
    if (quality >= 50) return 'Buena';
    if (quality >= 25) return 'Regular';
    return 'Baja';
  }, [quality]);

  // Texto descriptivo de la confianza
  const confidenceText = useMemo(() => {
    if (confidence >= 0.9) return 'Alta precisión';
    if (confidence >= 0.7) return 'Precisión media';
    if (confidence >= 0.5) return 'Precisión baja';
    return 'Poco confiable';
  }, [confidence]);

  return (
    <div className={`rounded-lg bg-black/5 backdrop-blur-sm p-3 ${className}`}>
      {/* Indicador principal de calidad */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isFingerDetected ? (
            <Heart className="h-5 w-5 text-rose-500" fill="currentColor" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          )}
          <span className="font-medium text-sm">
            {isFingerDetected ? 'Dedo detectado' : 'Coloque su dedo'}
          </span>
        </div>
        
        {hasArrhythmia && (
          <div className="px-2 py-1 bg-red-500/20 rounded-full flex items-center gap-1">
            <Activity className="h-4 w-4 text-red-500" />
            <span className="text-xs font-semibold text-red-500">Arritmia</span>
          </div>
        )}
      </div>

      {/* Barra de calidad */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span>Calidad de señal</span>
          <span className="font-medium">{quality}% - {qualityText}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${qualityColor} transition-all duration-300 ease-out`} 
            style={{ width: `${quality}%` }}
          />
        </div>
      </div>

      {/* Confianza */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span>Confianza</span>
          <span className={`font-medium ${confidenceColor}`}>
            {(confidence * 100).toFixed(0)}% - {confidenceText}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-blue-500 transition-all duration-300 ease-out`} 
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Detalles adicionales */}
      {showDetailed && (
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${quality >= 50 ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>Estabilidad: {quality >= 50 ? 'Buena' : 'Baja'}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isFingerDetected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>Contacto: {isFingerDetected ? 'Correcto' : 'Incorrecto'}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${hasArrhythmia ? 'bg-red-500' : 'bg-green-500'}`} />
            <span>Ritmo: {hasArrhythmia ? 'Irregular' : 'Regular'}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${confidence >= 0.7 ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span>Medición: {confidence >= 0.7 ? 'Confiable' : 'Verificar'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignalQualityIndicator;
