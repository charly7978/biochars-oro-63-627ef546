
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
 * Componente que muestra la calidad de la señal PPG
 * Centraliza toda la detección de dedo a través del FingerDetector
 * ACTUALIZADO para usar TRIPLE VERIFICACIÓN
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
  const [rgRatio, setRgRatio] = useState(0);
  const [redValue, setRedValue] = useState(0);
  const [greenValue, setGreenValue] = useState(0);
  
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

  // Usar FingerDetector con TRIPLE VERIFICACIÓN como única fuente de detección
  useEffect(() => {
    if (isMonitoring) {
      // Procesar valores RGB si están disponibles
      if (rgbValues) {
        // Guardar valores actuales
        setRedValue(rgbValues.red);
        setGreenValue(rgbValues.green);
        
        // Calcular ratio rojo/verde
        if (rgbValues.green > 0) {
          const currentRgRatio = rgbValues.red / rgbValues.green;
          setRgRatio(currentRgRatio);
        }
      }
      
      // Procesar con el detector centralizado usando TRIPLE VERIFICACIÓN
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
      if (!result.isFingerDetected) {
        setTipLevel('error');
      } else if (result.quality < fingerDetector.getConfig().LOW_QUALITY_THRESHOLD) {
        setTipLevel('warning');
      } else {
        setTipLevel('info');
      }
      
      // Log para depuración (solo ocasionalmente)
      if (Math.random() < 0.02) {
        console.log("SignalQualityIndicator: Estado con TRIPLE VERIFICACIÓN", {
          calidad: quality,
          calidadAjustada: result.quality,
          dedoDetectado: result.isFingerDetected,
          nivelCalidad: result.qualityLevel,
          ratioRG: rgRatio,
          valorRojo: redValue,
          valorVerde: greenValue,
          umbralRG: fingerDetector.getConfig().MIN_RED_GREEN_RATIO,
          umbralRojo: fingerDetector.getConfig().MIN_RED_VALUE,
          umbralVerde: fingerDetector.getConfig().MIN_GREEN_VALUE,
          mensaje: result.helpMessage
        });
      }
    } else {
      // Reset cuando no estamos monitoreando
      setDisplayQuality(0);
      setIsFingerDetected(false);
      setRgRatio(0);
      setRedValue(0);
      setGreenValue(0);
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
          
          {/* Mostramos el ratio R/G actual y valores */}
          {rgbValues && rgbValues.green > 0 && (
            <div className="mt-0.5 flex flex-col">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-semibold text-white/70">Ratio R/G:</span>
                <span 
                  className="text-[8px] font-medium"
                  style={{ 
                    color: rgRatio >= fingerDetector.getConfig().MIN_RED_GREEN_RATIO 
                      ? '#10b981' : '#ef4444' 
                  }}
                >
                  {rgRatio.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-semibold text-white/70">R/G:</span>
                <span 
                  className="text-[8px] font-medium"
                  style={{ 
                    color: isFingerDetected ? '#10b981' : '#ef4444' 
                  }}
                >
                  {Math.round(redValue)}/{Math.round(greenValue)}
                </span>
              </div>
            </div>
          )}
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
        <div className="absolute -bottom-[5rem] left-0 right-0 bg-black/75 p-2 rounded text-white text-xs flex items-start gap-1.5 border border-white/10">
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
