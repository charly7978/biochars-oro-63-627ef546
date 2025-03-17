
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
  
  // Constantes de configuración - valores extremadamente estrictos para prevenir falsos positivos
  const historySize = 8; // Ventana ampliada para promediar más datos
  const REQUIRED_FINGER_FRAMES = 20; // Drásticamente aumentado para eliminar falsos positivos
  const QUALITY_THRESHOLD = 80; // Incrementado significativamente para exigir calidad mucho más alta
  const MIN_QUALITY_FOR_DETECTION = 45; // Calidad mínima mucho mayor para considerar dedo presente
  const MIN_CONSECUTIVE_QUALITY = 5; // Requiere calidad consistente
  const SIGNAL_STABILITY_THRESHOLD = 0.1; // Requiere estabilidad de señal

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
  // y aplicar validación extremadamente estricta
  useEffect(() => {
    if (qualityHistory.length === 0) {
      setDisplayQuality(0);
      return;
    }

    // Verificar que haya suficientes muestras de calidad
    if (qualityHistory.length < MIN_CONSECUTIVE_QUALITY) {
      setDisplayQuality(0);
      return;
    }

    // Verificar estabilidad de la señal - rechazar señales inestables
    const variance = calculateVariance(qualityHistory);
    if (variance > 300) { // Alta varianza indica inestabilidad
      setDisplayQuality(Math.min(30, Math.round(quality * 0.5)));
      return;
    }

    // Verificar que la calidad mínima sea suficiente
    const minQuality = Math.min(...qualityHistory);
    if (minQuality < MIN_QUALITY_FOR_DETECTION) {
      setDisplayQuality(Math.max(0, Math.min(20, minQuality)));
      return;
    }

    // Ponderación con mayor peso a valores más recientes
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      const weight = Math.pow(1.3, index); // Valores más recientes tienen mucho más peso
      weightedSum += q * weight;
      totalWeight += weight;
    });

    const averageQuality = Math.round(weightedSum / totalWeight);
    
    // Aplicar factor de reducción para prevenir falsos positivos
    const qualityReductionFactor = 0.85; // Reducir calidad en un 15% como medida preventiva
    const adjustedQuality = Math.round(averageQuality * qualityReductionFactor);
    
    // Suavizar cambios para mejor UX
    setDisplayQuality(prev => {
      const delta = (adjustedQuality - prev) * 0.2;
      return Math.round(prev + delta);
    });
  }, [qualityHistory]);

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
    if (q > 80) return '#00ff00';
    if (q > 60) return '#ffff00';
    return '#ff0000';
  };

  /**
   * Obtiene el texto descriptivo de calidad
   */
  const getQualityText = (q: number) => {
    if (q === 0) return 'Sin Dedo';
    if (q > 80) return 'Excelente';
    if (q > 60) return 'Buena';
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
