
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, ThumbsUp, AlertTriangle, Fingerprint } from 'lucide-react';
import { FingerDetector } from '../modules/finger-detection/FingerDetector';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
  rgbValues?: {red: number, green: number, blue: number};
}

/**
 * Componente mejorado que muestra la calidad de la señal PPG
 * Incluye detección específica con validación fisiológica estricta
 */
const SignalQualityIndicator = ({ 
  quality, 
  isMonitoring = false,
  rgbValues
}: SignalQualityIndicatorProps) => {
  // Estado local
  const [displayQuality, setDisplayQuality] = useState(0);
  const [isFingerDetected, setIsFingerDetected] = useState(false);
  const [qualityText, setQualityText] = useState('Sin Dedo');
  const [qualityColor, setQualityColor] = useState('#666666');
  const [showHelpTip, setShowHelpTip] = useState(false);
  const [tipLevel, setTipLevel] = useState<'error' | 'warning' | 'info'>('info');
  const [helpMessage, setHelpMessage] = useState('');
  
  // Detector de dedo centralizado (se crea solo una vez)
  const [fingerDetector] = useState(() => new FingerDetector());
  
  // Mostrar consejos cuando se comienza a monitorear
  useEffect(() => {
    if (isMonitoring) {
      const timer = setTimeout(() => setShowHelpTip(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setShowHelpTip(false);
    }
  }, [isMonitoring]);

  // Procesar calidad de señal a través del detector centralizado con criterios fisiológicos
  useEffect(() => {
    if (isMonitoring) {
      // Si tenemos valores RGB, usarlos para detección fisiológica
      const result = rgbValues 
        ? fingerDetector.processQuality(quality, rgbValues.red, rgbValues.green)
        : fingerDetector.processQuality(quality);
      
      // Actualizar estado según resultado
      setDisplayQuality(result.quality);
      setIsFingerDetected(result.isFingerDetected);
      setQualityText(result.qualityLevel);
      setQualityColor(result.qualityColor);
      setHelpMessage(result.helpMessage);
      
      // Determinar nivel de tip basado en calidad
      if (!result.isFingerDetected || result.quality < fingerDetector.getConfig().LOW_QUALITY_THRESHOLD) {
        setTipLevel('error');
      } else if (result.quality < fingerDetector.getConfig().QUALITY_THRESHOLD) {
        setTipLevel('warning');
      } else {
        setTipLevel('info');
      }
    } else {
      // Reset cuando no estamos monitoreando
      setDisplayQuality(0);
      setIsFingerDetected(false);
      fingerDetector.reset();
    }
  }, [quality, isMonitoring, fingerDetector, rgbValues]);

  // Estilo de pulso adaptado a la calidad
  const getPulseClass = () => {
    if (!isFingerDetected) 
      return "transition-all duration-300";
    
    return "transition-all duration-300 animate-pulse";
  };

  return (
    <div className="bg-black/30 backdrop-blur-md rounded p-1 w-full relative">
      <div className="flex items-center gap-1">
        <div 
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${getPulseClass()}`}
          style={{
            borderColor: qualityColor,
            backgroundColor: `${qualityColor}33`
          }}
        >
          <span className="text-[9px] font-bold text-white">{displayQuality}%</span>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] font-semibold text-white/90">Calidad de Señal</span>
            <span 
              className="text-[9px] font-medium"
              style={{ color: qualityColor }}
            >
              {qualityText}
            </span>
          </div>

          <div className="w-full h-0.5 bg-gray-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-300"
              style={{
                width: `${displayQuality}%`,
                backgroundColor: qualityColor
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Indicador de estado del dedo */}
      <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-3">
        <Fingerprint 
          size={16} 
          className={`${isFingerDetected ? 'text-green-500' : 'text-gray-400'} transition-colors duration-300`}
        />
      </div>
      
      {/* Consejos de ayuda */}
      {showHelpTip && (displayQuality < fingerDetector.getConfig().QUALITY_THRESHOLD || !isFingerDetected) && (
        <div className="absolute -bottom-[4.5rem] left-0 right-0 bg-black/75 p-2 rounded text-white text-xs flex items-start gap-1.5 border border-white/10">
          {tipLevel === 'error' || !isFingerDetected ? (
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          ) : tipLevel === 'warning' ? (
            <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          ) : (
            <ThumbsUp className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
          )}
          <span>{helpMessage}</span>
        </div>
      )}
    </div>
  );
};

export default SignalQualityIndicator;
