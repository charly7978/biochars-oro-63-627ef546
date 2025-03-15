
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
  
  // Constantes de configuración - VALORES MÁS ESTRICTOS
  const historySize = 6; // Ventana de historial para promedio
  const REQUIRED_FINGER_FRAMES = 12; // EXTREMADAMENTE ESTRICTO (era 10)
  const QUALITY_THRESHOLD = 65; // ELEVADO (era 60)
  const LOW_QUALITY_THRESHOLD = 45; // ELEVADO (era 40)
  const MIN_QUALITY_FOR_DETECTION = 18; // ELEVADO: mínimo absoluto para considerar detección
  const RESET_QUALITY_THRESHOLD = 10; // Nuevo: umbral por debajo del cual se reinicia todo

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
      // NUEVO: Si la calidad es muy baja (menor al umbral de reset), reiniciar historial
      if (quality < RESET_QUALITY_THRESHOLD) {
        if (qualityHistory.length > 0) {
          setQualityHistory([]);
          setDisplayQuality(0);
          console.log("SignalQualityIndicator: Reinicio completo por calidad crítica", {
            calidadRecibida: quality,
            umbralReset: RESET_QUALITY_THRESHOLD
          });
        }
        return;
      }
      
      // NUEVO: Solo agregar al historial si la calidad supera cierto umbral mínimo
      // Esto evita falsas detecciones
      if (quality > MIN_QUALITY_FOR_DETECTION) {
        setQualityHistory(prev => {
          const newHistory = [...prev, quality];
          return newHistory.slice(-historySize);
        });
      } else {
        // Si la calidad es muy baja, reiniciar el historial
        if (qualityHistory.length > 0) {
          setQualityHistory([]);
          setDisplayQuality(0);
          console.log("SignalQualityIndicator: Reinicio de historial por calidad insuficiente", {
            calidadRecibida: quality,
            umbralMínimo: MIN_QUALITY_FOR_DETECTION
          });
        }
      }
    } else {
      setQualityHistory([]);
      setDisplayQuality(0);
    }
  }, [quality, isMonitoring, qualityHistory.length]);

  // Calcular calidad ponderada con más peso a valores recientes y más estricta
  useEffect(() => {
    if (qualityHistory.length === 0) {
      setDisplayQuality(0);
      return;
    }

    // NUEVO: Verificar si hay suficientes frames consecutivos de buena calidad
    if (qualityHistory.length < REQUIRED_FINGER_FRAMES) {
      // Reducimos aún más la calidad mostrada si no hay suficientes frames
      setDisplayQuality(Math.max(0, Math.min(8, quality))); // Limitado a 8% máximo
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
    
    // NUEVO: Verificación adicional para evitar falsas lecturas altas
    // Comprobar que no haya demasiada variación en los últimos valores
    const recentValues = qualityHistory.slice(-4);
    const minRecent = Math.min(...recentValues);
    const maxRecent = Math.max(...recentValues);
    const rangeRecent = maxRecent - minRecent;
    
    let finalQuality = averageQuality;
    
    // Si hay demasiada variación, penalizar la calidad
    if (rangeRecent > 30 && qualityHistory.length < historySize) {
      finalQuality = Math.round(finalQuality * 0.7);
      console.log("SignalQualityIndicator: Penalización por alta variación", {
        variación: rangeRecent,
        calidadOriginal: averageQuality,
        calidadAjustada: finalQuality
      });
    }
    
    // Suavizar cambios para mejor UX
    setDisplayQuality(prev => {
      const delta = (finalQuality - prev) * 0.3;
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
      console.log("SignalQualityIndicator: Cambio de nivel de calidad", {
        anterior: lastQualityLevel,
        nuevo: newQualityLevel,
        calidadPonderada: finalQuality
      });
    }
    
  }, [qualityHistory, lastQualityLevel, quality]);

  /**
   * Obtiene el color basado en la calidad (más granular y más estricto)
   */
  const getQualityColor = (q: number) => {
    if (q === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) return '#666666';
    if (q > 85) return '#059669'; // Verde más saturado
    if (q > 75) return '#10b981'; // Verde medio
    if (q > 60) return '#22c55e'; // Verde normal
    if (q > 45) return '#a3e635'; // Verde-amarillo
    if (q > 35) return '#eab308'; // Amarillo
    if (q > 25) return '#f97316'; // Naranja
    if (q > 15) return '#ef4444'; // Rojo
    return '#b91c1c';            // Rojo oscuro
  };

  /**
   * Obtiene el texto descriptivo de calidad con umbrales más estrictos
   */
  const getQualityText = (q: number) => {
    if (q === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) return 'Sin Dedo';
    if (q > 85) return 'Excelente';
    if (q > 70) return 'Muy Buena';
    if (q > 55) return 'Buena';
    if (q > 40) return 'Aceptable';
    if (q > 25) return 'Baja';
    if (q > 15) return 'Muy Baja';
    return 'Crítica';
  };

  /**
   * Obtiene el mensaje de ayuda basado en la plataforma y calidad
   */
  const getHelpMessage = () => {
    // Sin dedo detectado
    if (displayQuality === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) {
      return "Cubra completamente la cámara y flash con su dedo índice. Presione firmemente.";
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
    if (displayQuality === 0 || qualityHistory.length < REQUIRED_FINGER_FRAMES) 
      return "transition-all duration-300";
    
    const baseClass = "transition-all duration-300";
    const pulseSpeed = isAndroid ? "animate-pulse" : "animate-pulse";
    
    return `${baseClass} ${pulseSpeed}`;
  };

  // NUEVA FUNCIÓN: Determina si hay un dedo realmente presente
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
