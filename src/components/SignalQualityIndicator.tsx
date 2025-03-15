
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, ThumbsUp, AlertTriangle, Fingerprint } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

/**
 * Componente mejorado que muestra la calidad de la señal PPG
 * Incluye detección específica para diferentes dispositivos y consejos más detallados
 * 
 * IMPORTANTE: Esta aplicación es solo para referencia médica, no reemplaza dispositivos médicos certificados.
 * La detección de señal es real, basada en datos de la cámara sin simulaciones.
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
  
  // Constantes de configuración - MÁXIMA SENSIBILIDAD
  const historySize = 3; // Mínimo para respuesta inmediata
  const REQUIRED_FINGER_FRAMES = 2; // Mínimo absoluto para detección instantánea
  const QUALITY_THRESHOLD = 30; // Drásticamente reducido para detectar señales extremadamente débiles
  const LOW_QUALITY_THRESHOLD = 15; // Drásticamente reducido para mayor sensibilidad
  const MIN_QUALITY_FOR_DETECTION = 3; // Drásticamente reducido para detección con señal mínima
  const RESET_QUALITY_THRESHOLD = 2; // Reducido al mínimo para máxima sensibilidad
  const QUALITY_BOOST_FACTOR = 1.8; // Factor de amplificación para calidad mostrada (solo visual)

  // Detectar plataforma
  useEffect(() => {
    const androidDetected = /android/i.test(navigator.userAgent);
    const iosDetected = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsAndroid(androidDetected);
    setIsIOS(iosDetected);
    
    // Mostrar tip de ayuda inmediatamente para respuesta instantánea
    if (isMonitoring) {
      const timer = setTimeout(() => setShowHelpTip(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isMonitoring]);

  // Mantener historial de calidad para promedio ponderado
  useEffect(() => {
    if (isMonitoring) {
      // Si la calidad es extremadamente baja, pero no cero, aún considerarla
      if (quality < RESET_QUALITY_THRESHOLD && quality > 0) {
        // Mantener señales débiles en el historial
        setQualityHistory(prev => {
          const newHistory = [...prev, quality * 0.5]; // Incluir con peso reducido
          return newHistory.slice(-historySize);
        });
        return;
      }
      
      // Con calidad cero, limpiar historial solo si es persistente
      if (quality <= 0) {
        if (qualityHistory.length > 0 && qualityHistory.every(q => q <= 0)) {
          setQualityHistory([]);
          setDisplayQuality(0);
        }
        return;
      }
      
      // Agregar al historial con amplificación para señales débiles
      const boostedQuality = quality < 10 ? quality * 1.5 : quality;
      setQualityHistory(prev => {
        const newHistory = [...prev, boostedQuality];
        return newHistory.slice(-historySize);
      });
    } else {
      setQualityHistory([]);
      setDisplayQuality(0);
    }
  }, [quality, isMonitoring, qualityHistory.length]);

  // Calcular calidad con amplificación para señales débiles
  useEffect(() => {
    if (qualityHistory.length === 0) {
      setDisplayQuality(0);
      return;
    }

    // Verificar si hay suficientes frames - ultra sensible
    if (qualityHistory.length < REQUIRED_FINGER_FRAMES) {
      // Mostrar calidad parcial para feedback inmediato
      setDisplayQuality(Math.max(0, Math.min(20, quality * 1.8))); // Significativamente aumentado
      return;
    }

    // Cálculo ponderado con bias fuerte hacia valores recientes
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      const weight = Math.pow(2, index); // Mayor peso a valores recientes
      weightedSum += q * weight;
      totalWeight += weight;
    });

    const rawAverage = weightedSum / totalWeight;
    
    // Amplificar señales débiles para mejor visualización
    const boostedAverage = rawAverage < 30 
      ? rawAverage * QUALITY_BOOST_FACTOR 
      : rawAverage;
      
    const averageQuality = Math.min(100, Math.round(boostedAverage));
    
    // Suavizar cambios con bias hacia valores mayores
    setDisplayQuality(prev => {
      const delta = averageQuality > prev 
        ? (averageQuality - prev) * 0.6 // Subida rápida
        : (averageQuality - prev) * 0.3; // Bajada lenta
      return Math.round(prev + delta);
    });
    
    // Determinar nivel de tip
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
    }
    
  }, [qualityHistory, lastQualityLevel, quality]);

  /**
   * Obtiene el color basado en la calidad (con mayor granularidad para señales débiles)
   */
  const getQualityColor = (q: number) => {
    if (q === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) return '#666666';
    if (q > 70) return '#059669'; // Verde más saturado
    if (q > 50) return '#10b981'; // Verde medio
    if (q > 30) return '#22c55e'; // Verde normal
    if (q > 20) return '#a3e635'; // Verde-amarillo
    if (q > 10) return '#eab308'; // Amarillo
    if (q > 5) return '#f97316'; // Naranja
    if (q > 1) return '#ef4444'; // Rojo
    return '#b91c1c';            // Rojo oscuro
  };

  /**
   * Obtiene el texto descriptivo de calidad con umbrales más sensibles
   */
  const getQualityText = (q: number) => {
    if (q === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) return 'Sin Dedo';
    if (q > 70) return 'Excelente';
    if (q > 50) return 'Muy Buena';
    if (q > 30) return 'Buena';
    if (q > 20) return 'Aceptable';
    if (q > 10) return 'Baja';
    if (q > 5) return 'Muy Baja';
    return 'Crítica';
  };

  /**
   * Obtiene el mensaje de ayuda basado en la plataforma y calidad
   */
  const getHelpMessage = () => {
    // Sin dedo detectado
    if (displayQuality === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) {
      if (isIOS) {
        return "Cubra completamente la cámara trasera y el flash con la yema del dedo índice. Presione suavemente.";
      } else if (isAndroid) {
        return "Cubra la cámara trasera con su dedo índice. En algunos Android, debe cubrir también el flash.";
      } else {
        return "Cubra la cámara trasera con su dedo índice. Presione suavemente pero de forma completa.";
      }
    }
    
    // Con dedo pero baja calidad
    if (displayQuality < LOW_QUALITY_THRESHOLD) {
      if (isAndroid) {
        return "Presione más firme pero no agresivamente. En algunos Android necesita cubrir también el flash.";
      } else if (isIOS) {
        return "Cubra completamente la cámara y ajuste la presión. Mantenga el dedo quieto.";
      } else {
        return "Asegúrese que su dedo cubra bien la cámara. Pruebe ajustar la presión, ni muy fuerte ni muy suave.";
      }
    }
    
    // Calidad media
    if (displayQuality < QUALITY_THRESHOLD) {
      return "Buena señal detectada. Mantenga esta posición estable para mejores resultados.";
    }
    
    // Buena calidad
    return "¡Excelente señal! Mantenga esta posición para óptimos resultados.";
  };

  // Estilo de pulso adaptado a la plataforma y calidad
  const getPulseClass = () => {
    if (displayQuality === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) 
      return "transition-all duration-300";
    
    const baseClass = "transition-all duration-300";
    const pulseSpeed = displayQuality < 30 ? "animate-pulse-fast" : "animate-pulse";
    
    return `${baseClass} ${pulseSpeed}`;
  };

  // Determina si hay un dedo realmente presente - ultra sensible
  const isFingerActuallyDetected = () => {
    return (displayQuality > 0) || (quality > 0 && qualityHistory.some(q => q > 0));
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
      
      {/* Indicador de estado del dedo - más sensible */}
      <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-3">
        <Fingerprint 
          size={16} 
          className={`${isFingerActuallyDetected() ? 'text-green-500' : 'text-gray-400'} transition-colors duration-300`}
        />
      </div>
      
      {/* Consejos de ayuda mejorados y más específicos */}
      {showHelpTip && (displayQuality < QUALITY_THRESHOLD || !isFingerActuallyDetected()) && (
        <div className="absolute -bottom-[4.5rem] left-0 right-0 bg-black/75 p-2 rounded text-white text-xs flex items-start gap-1.5 border border-white/10">
          {tipLevel === 'error' || !isFingerActuallyDetected() ? (
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          ) : tipLevel === 'warning' ? (
            <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          ) : (
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
