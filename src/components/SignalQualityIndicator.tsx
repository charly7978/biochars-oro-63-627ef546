
import React, { useState, useEffect } from 'react';
import { AlertCircle, ThumbsUp, AlertTriangle, Fingerprint } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

/**
 * Componente mejorado que muestra la calidad de la señal PPG
 * Incluye detección específica para diferentes dispositivos y consejos más detallados
 */
const SignalQualityIndicator = ({ quality, isMonitoring = false }: SignalQualityIndicatorProps) => {
  // Estado local
  const [displayQuality, setDisplayQuality] = useState(0);
  const [qualityHistory, setQualityHistory] = useState<number[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelpTip, setShowHelpTip] = useState(false);
  const [tipLevel, setTipLevel] = useState<'error' | 'warning' | 'info'>('info');
  const [lastQualityLevel, setLastQualityLevel] = useState<string>('');
  
  // Constantes de configuración
  const historySize = 6; // Ventana de historial para promedio
  const REQUIRED_FINGER_FRAMES = 5; // Más estricto
  const QUALITY_THRESHOLD = 50;
  const LOW_QUALITY_THRESHOLD = 30;

  // Detectar plataforma
  useEffect(() => {
    const androidDetected = /android/i.test(navigator.userAgent);
    const iosDetected = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsAndroid(androidDetected);
    setIsIOS(iosDetected);
    
    // Mostrar tip de ayuda después de un delay
    if (isMonitoring) {
      const timer = setTimeout(() => setShowHelpTip(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [isMonitoring]);

  // Mantener historial de calidad para promedio ponderado
  useEffect(() => {
    if (isMonitoring) {
      setQualityHistory(prev => {
        const newHistory = [...prev, quality];
        return newHistory.slice(-historySize);
      });
    } else {
      setQualityHistory([]);
      setDisplayQuality(0);
    }
  }, [quality, isMonitoring]);

  // Calcular calidad ponderada con más peso a valores recientes
  useEffect(() => {
    if (qualityHistory.length === 0) {
      setDisplayQuality(0);
      return;
    }

    // Cálculo ponderado donde los valores más recientes tienen mayor influencia
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      const weight = Math.pow(1.5, index); // Exponencial para dar mucho más peso a valores recientes
      weightedSum += q * weight;
      totalWeight += weight;
    });

    const averageQuality = Math.round(weightedSum / totalWeight);
    
    // Suavizar cambios para mejor UX
    setDisplayQuality(prev => {
      const delta = (averageQuality - prev) * 0.3;
      return Math.round(prev + delta);
    });
    
    // Determinar nivel de tip basado en calidad
    if (averageQuality < LOW_QUALITY_THRESHOLD) {
      setTipLevel('error');
    } else if (averageQuality < QUALITY_THRESHOLD) {
      setTipLevel('warning');
    } else {
      setTipLevel('info');
    }
    
    // Actualizar último nivel de calidad para mensajes
    const newQualityLevel = getQualityText(averageQuality);
    if (newQualityLevel !== lastQualityLevel) {
      setLastQualityLevel(newQualityLevel);
      console.log("SignalQualityIndicator: Cambio de nivel de calidad", {
        anterior: lastQualityLevel,
        nuevo: newQualityLevel,
        calidadPonderada: averageQuality
      });
    }
    
  }, [qualityHistory, lastQualityLevel]);

  /**
   * Obtiene el color basado en la calidad (más granular)
   */
  const getQualityColor = (q: number) => {
    if (q === 0) return '#666666';
    if (q > 80) return '#059669'; // Verde más saturado
    if (q > 70) return '#10b981'; // Verde medio
    if (q > 50) return '#22c55e'; // Verde normal
    if (q > 40) return '#a3e635'; // Verde-amarillo
    if (q > 30) return '#eab308'; // Amarillo
    if (q > 20) return '#f97316'; // Naranja
    if (q > 10) return '#ef4444'; // Rojo
    return '#b91c1c';            // Rojo oscuro
  };

  /**
   * Obtiene el texto descriptivo de calidad con umbrales más precisos
   */
  const getQualityText = (q: number) => {
    if (q === 0) return 'Sin Dedo';
    if (q > 80) return 'Excelente';
    if (q > 65) return 'Muy Buena';
    if (q > 50) return 'Buena';
    if (q > 35) return 'Aceptable';
    if (q > 20) return 'Baja';
    if (q > 10) return 'Muy Baja';
    return 'Crítica';
  };

  /**
   * Obtiene el mensaje de ayuda basado en la plataforma y calidad
   */
  const getHelpMessage = () => {
    // Sin dedo detectado
    if (displayQuality === 0) {
      return "Cubra completamente la cámara y flash con su dedo índice.";
    }
    
    // Con dedo pero baja calidad
    if (displayQuality < LOW_QUALITY_THRESHOLD) {
      if (isAndroid) {
        return "Presione más firmemente. Evite movimientos. El dedo debe cubrir totalmente la cámara y el flash.";
      } else if (isIOS) {
        return "Cubra completamente la cámara. Presione con firmeza pero sin bloquear totalmente la luz.";
      } else {
        return "Asegúrese que su dedo cubra completamente la cámara y manténgalo estable.";
      }
    }
    
    // Calidad media
    if (displayQuality < QUALITY_THRESHOLD) {
      return "Buen avance. Mantenga la presión estable y evite movimientos.";
    }
    
    // Buena calidad
    return "¡Buena señal! Mantenga esta posición para mejores resultados.";
  };

  // Estilo de pulso adaptado a la plataforma y calidad
  const getPulseClass = () => {
    if (displayQuality === 0) return "transition-all duration-300";
    
    const baseClass = "transition-all duration-300";
    const pulseSpeed = isAndroid ? "animate-pulse" : "animate-pulse";
    
    return `${baseClass} ${pulseSpeed}`;
  };

  return (
    <div className="bg-black/30 backdrop-blur-md rounded p-1 w-full relative">
      <div className="flex items-center gap-1">
        <div 
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${getPulseClass()}`}
          style={{
            borderColor: getQualityColor(displayQuality),
            backgroundColor: `${getQualityColor(displayQuality)}33`
          }}
        >
          <span className="text-[9px] font-bold text-white">{displayQuality}%</span>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] font-semibold text-white/90">Calidad de Señal</span>
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
                width: `${displayQuality}%`,
                backgroundColor: getQualityColor(displayQuality)
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Indicador de estado del dedo */}
      <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-3">
        <Fingerprint 
          size={16} 
          className={`${displayQuality > 0 ? 'text-green-500' : 'text-gray-400'} transition-colors duration-300`}
        />
      </div>
      
      {/* Consejos de ayuda mejorados */}
      {showHelpTip && displayQuality < QUALITY_THRESHOLD && (
        <div className="absolute -bottom-[4.5rem] left-0 right-0 bg-black/75 p-2 rounded text-white text-xs flex items-start gap-1.5 border border-white/10">
          {tipLevel === 'error' && (
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          {tipLevel === 'warning' && (
            <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          )}
          {tipLevel === 'info' && (
            <ThumbsUp className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
          )}
          <span>
            {getHelpMessage()}
          </span>
        </div>
      )}
    </div>
  );
};

export default SignalQualityIndicator;
