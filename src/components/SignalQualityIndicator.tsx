
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

/**
 * Componente que muestra la calidad de la señal PPG
 * Incluye detección específica para Android y consejos de ayuda
 */
const SignalQualityIndicator = ({ quality, isMonitoring = false }: SignalQualityIndicatorProps) => {
  // Estado local
  const [displayQuality, setDisplayQuality] = useState(0);
  const [qualityHistory, setQualityHistory] = useState<number[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showHelpTip, setShowHelpTip] = useState(false);
  
  // Constantes de configuración - ajustadas para mejor representación de la realidad 
  const historySize = 8; // Ventana para promediar datos
  const REQUIRED_FINGER_FRAMES = 16; // Requiere más frames consistentes para calidad alta
  const QUALITY_THRESHOLD = 75; // Umbral para calidad considerada "buena"
  const MIN_QUALITY_FOR_DETECTION = 45; // Umbral mínimo para detección válida
  const MIN_CONSECUTIVE_QUALITY = 4; // Requiere calidad consistente
  const SIGNAL_STABILITY_THRESHOLD = 0.15; // Umbral de estabilidad

  // Detectar plataforma
  useEffect(() => {
    const androidDetected = /android/i.test(navigator.userAgent);
    setIsAndroid(androidDetected);
    
    // Mostrar tip de ayuda en Android después de un delay
    if (androidDetected) {
      const timer = setTimeout(() => setShowHelpTip(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Mantener historial de calidad para promedio
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
  // y aplicar validación más estricta para mejor representación de la realidad
  useEffect(() => {
    if (qualityHistory.length === 0) {
      setDisplayQuality(0);
      return;
    }

    // Verificar que haya suficientes muestras de calidad
    if (qualityHistory.length < MIN_CONSECUTIVE_QUALITY) {
      setDisplayQuality(Math.min(25, Math.round(quality * 0.4)));
      return;
    }

    // Verificar estabilidad de la señal - rechazar señales inestables
    const variance = calculateVariance(qualityHistory);
    
    // Logging para depuración de varianza y estabilidad
    console.log("SignalQualityIndicator: Análisis de estabilidad", {
      variance,
      qualityHistory: qualityHistory.slice(-3),
      threshold: 180,
      isStable: variance < 180
    });
    
    if (variance > 180) { 
      // Señal inestable, mostrar calidad reducida
      setDisplayQuality(Math.min(35, Math.round(quality * 0.5)));
      return;
    }

    // Verificar que la calidad mínima sea suficiente
    const minQuality = Math.min(...qualityHistory);
    if (minQuality < MIN_QUALITY_FOR_DETECTION) {
      setDisplayQuality(Math.max(5, Math.min(30, minQuality)));
      return;
    }

    // Ponderación con mayor peso a valores más recientes
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      const weight = Math.pow(1.3, index); // Valores más recientes tienen más peso
      weightedSum += q * weight;
      totalWeight += weight;
    });

    const averageQuality = Math.round(weightedSum / totalWeight);
    
    // Ajuste más realista a la calidad, sin reducción agresiva pero fiel a la realidad
    const qualityReductionFactor = 0.92; // Factor más realista
    const adjustedQuality = Math.round(averageQuality * qualityReductionFactor);
    
    // Suavizar cambios para mejor UX
    setDisplayQuality(prev => {
      const delta = (adjustedQuality - prev) * 0.3;
      return Math.round(prev + delta);
    });

    // Emitir evento de señal válida - sólo cuando realmente tenemos buena calidad
    // y con datos detallados para mejor diagnóstico
    if (adjustedQuality > QUALITY_THRESHOLD - 15 && variance < 150 && isMonitoring) {
      const stabilityScore = 1 - (variance / 200);
      const eventDetail = { 
        quality: adjustedQuality,
        stable: variance < 150,
        variance,
        minQuality,
        averageQuality,
        stabilityScore: Math.max(0, Math.min(1, stabilityScore)),
        qualityHistory: qualityHistory.slice(-3),
        timestamp: Date.now()
      };
      
      // Emitir evento con datos detallados
      window.dispatchEvent(new CustomEvent('validSignalDetected', { 
        detail: eventDetail
      }));
      
      console.log("SignalQualityIndicator: Evento validSignalDetected emitido", eventDetail);
    }
  }, [qualityHistory, isMonitoring]);

  // Calcular varianza para detección de estabilidad
  const calculateVariance = (values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  };

  /**
   * Obtiene el color basado en la calidad
   */
  const getQualityColor = (q: number) => {
    if (q === 0) return '#666666';
    if (q > 75) return '#00ff00';
    if (q > 50) return '#ffff00';
    return '#ff0000';
  };

  /**
   * Obtiene el texto descriptivo de calidad
   */
  const getQualityText = (q: number) => {
    if (q === 0) return 'Sin Dedo';
    if (q > 75) return 'Excelente';
    if (q > 50) return 'Buena';
    return 'Baja';
  };

  // Efecto de pulso adaptado a la plataforma
  const pulseStyle = displayQuality > 0 
    ? isAndroid ? "animate-pulse transition-all duration-500" : "animate-pulse transition-all duration-300" 
    : "transition-all duration-300";

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
      
      {/* Consejos de ayuda específicos para Android */}
      {isAndroid && showHelpTip && displayQuality < QUALITY_THRESHOLD && (
        <div className="absolute -bottom-20 left-0 right-0 bg-black/70 p-2 rounded text-white text-xs flex items-center gap-1">
          <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
          <span>
            Asegure que su dedo cubra completamente la cámara y la luz de flash. 
            Presione firmemente.
          </span>
        </div>
      )}
    </div>
  );
};

export default SignalQualityIndicator;
