
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
  
  // Constantes de configuración - MÁS SENSIBLES
  const historySize = 5; // Reducido para respuesta más rápida
  const REQUIRED_FINGER_FRAMES = 5; // Reducido para detección más rápida
  const QUALITY_THRESHOLD = 50; // Reducido para detectar señales más débiles
  const LOW_QUALITY_THRESHOLD = 30; // Reducido para mayor sensibilidad
  const MIN_QUALITY_FOR_DETECTION = 10; // Reducido para mayor sensibilidad
  const RESET_QUALITY_THRESHOLD = 5; // Reducido para mayor sensibilidad

  // Detectar plataforma
  useEffect(() => {
    const androidDetected = /android/i.test(navigator.userAgent);
    const iosDetected = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsAndroid(androidDetected);
    setIsIOS(iosDetected);
    
    // Mostrar tip de ayuda después de un delay corto para respuesta rápida
    if (isMonitoring) {
      const timer = setTimeout(() => setShowHelpTip(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isMonitoring]);

  // Mantener historial de calidad para promedio ponderado
  useEffect(() => {
    if (isMonitoring) {
      // Si la calidad es muy baja, reiniciar historial
      if (quality < RESET_QUALITY_THRESHOLD) {
        if (qualityHistory.length > 0) {
          setQualityHistory([]);
          setDisplayQuality(0);
        }
        return;
      }
      
      // Más sensible: agregar al historial con umbral más bajo
      if (quality > MIN_QUALITY_FOR_DETECTION) {
        setQualityHistory(prev => {
          const newHistory = [...prev, quality];
          return newHistory.slice(-historySize);
        });
      } else {
        // Si la calidad es muy baja pero no llega al umbral de reset
        if (qualityHistory.length > 0 && quality < MIN_QUALITY_FOR_DETECTION * 0.5) {
          setQualityHistory([]);
          setDisplayQuality(0);
        }
      }
    } else {
      setQualityHistory([]);
      setDisplayQuality(0);
    }
  }, [quality, isMonitoring, qualityHistory.length]);

  // Calcular calidad ponderada con más peso a valores recientes y más sensible
  useEffect(() => {
    if (qualityHistory.length === 0) {
      setDisplayQuality(0);
      return;
    }

    // Verificar si hay suficientes frames consecutivos - más sensible
    if (qualityHistory.length < REQUIRED_FINGER_FRAMES) {
      // Mostrar calidad parcial para feedback inmediato
      setDisplayQuality(Math.max(0, Math.min(15, quality))); // Aumentado para mejor feedback
      return;
    }

    // Cálculo ponderado donde los valores más recientes tienen mayor influencia
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      const weight = Math.pow(1.3, index); // Reducido para menor sesgo
      weightedSum += q * weight;
      totalWeight += weight;
    });

    const averageQuality = Math.round(weightedSum / totalWeight);
    
    // Verificación menos estricta para falsas lecturas
    const recentValues = qualityHistory.slice(-3); // Reducido para respuesta más rápida
    const minRecent = Math.min(...recentValues);
    const maxRecent = Math.max(...recentValues);
    const rangeRecent = maxRecent - minRecent;
    
    let finalQuality = averageQuality;
    
    // Penalización más permisiva
    if (rangeRecent > 40 && qualityHistory.length < historySize) {
      finalQuality = Math.round(finalQuality * 0.85); // Penalización reducida
    }
    
    // Suavizar cambios para mejor UX
    setDisplayQuality(prev => {
      const delta = (finalQuality - prev) * 0.4; // Aumentado para respuesta más rápida
      return Math.round(prev + delta);
    });
    
    // Determinar nivel de tip basado en calidad
    if (finalQuality < LOW_QUALITY_THRESHOLD) {
      setTipLevel('error');
    } else if (finalQuality < QUALITY_THRESHOLD) {
      setTipLevel('warning');
    } else {
      setTipLevel('info');
    }
    
    // Actualizar último nivel de calidad para mensajes
    const newQualityLevel = getQualityText(finalQuality);
    if (newQualityLevel !== lastQualityLevel) {
      setLastQualityLevel(newQualityLevel);
    }
    
  }, [qualityHistory, lastQualityLevel, quality]);

  /**
   * Obtiene el color basado en la calidad (más granular y más sensible)
   */
  const getQualityColor = (q: number) => {
    if (q === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) return '#666666';
    if (q > 80) return '#059669'; // Verde más saturado
    if (q > 65) return '#10b981'; // Verde medio
    if (q > 50) return '#22c55e'; // Verde normal
    if (q > 35) return '#a3e635'; // Verde-amarillo
    if (q > 20) return '#eab308'; // Amarillo
    if (q > 10) return '#f97316'; // Naranja
    if (q > 5) return '#ef4444'; // Rojo
    return '#b91c1c';            // Rojo oscuro
  };

  /**
   * Obtiene el texto descriptivo de calidad con umbrales más sensibles
   */
  const getQualityText = (q: number) => {
    if (q === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) return 'Sin Dedo';
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
    if (displayQuality === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) {
      return "Cubra la cámara trasera y el flash con su dedo índice. Presione firmemente pero no muy fuerte.";
    }
    
    // Con dedo pero baja calidad
    if (displayQuality < LOW_QUALITY_THRESHOLD) {
      if (isAndroid) {
        return "Presione más firmemente pero sin exceso. Mantenga el dedo estable sobre la cámara trasera.";
      } else if (isIOS) {
        return "Cubra completamente la cámara trasera. Presione con firmeza moderada y mantenga el dedo quieto.";
      } else {
        return "Asegúrese que su dedo cubra la cámara trasera y manténgalo quieto. Evite presionar demasiado fuerte.";
      }
    }
    
    // Calidad media
    if (displayQuality < QUALITY_THRESHOLD) {
      return "Buen avance. Mantenga esta posición y evite movimientos.";
    }
    
    // Buena calidad
    return "¡Buena señal! Mantenga esta misma presión para óptimos resultados.";
  };

  // Estilo de pulso adaptado a la plataforma y calidad
  const getPulseClass = () => {
    if (displayQuality === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) 
      return "transition-all duration-300";
    
    const baseClass = "transition-all duration-300";
    const pulseSpeed = "animate-pulse";
    
    return `${baseClass} ${pulseSpeed}`;
  };

  // Determina si hay un dedo realmente presente - más sensible
  const isFingerActuallyDetected = () => {
    return displayQuality > 0 && qualityHistory.length >= REQUIRED_FINGER_FRAMES;
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
          className={`${isFingerActuallyDetected() ? 'text-green-500' : 'text-gray-400'} transition-colors duration-300`}
        />
      </div>
      
      {/* Consejos de ayuda mejorados */}
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
