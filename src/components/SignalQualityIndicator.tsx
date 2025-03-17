
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

/**
 * Componente que muestra la calidad de la señal PPG
 * Incluye detección específica para Android y consejos de ayuda
 * Con validación mucho más estricta para evitar falsos positivos
 */
const SignalQualityIndicator = ({ quality, isMonitoring = false }: SignalQualityIndicatorProps) => {
  // Estado local
  const [displayQuality, setDisplayQuality] = useState(0);
  const [qualityHistory, setQualityHistory] = useState<number[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showHelpTip, setShowHelpTip] = useState(false);
  const [stabilityScore, setStabilityScore] = useState(0);
  
  // Constantes de configuración - mucho más estrictas
  const historySize = 8; // Ventana más grande para mayor estabilidad
  const QUALITY_THRESHOLD = 75; // Umbral elevado para calidad considerada "buena"
  const MIN_QUALITY_FOR_DETECTION = 40; // Umbral mínimo elevado para detección válida
  const SIGNAL_STABILITY_THRESHOLD = 0.35; // Umbral de estabilidad más exigente
  const VERIFICATION_FACTOR = 0.8; // Factor de verificación más estricto

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

  // Mantener historial de calidad para promedio con mayor peso a valores recientes
  useEffect(() => {
    if (isMonitoring) {
      setQualityHistory(prev => {
        const newHistory = [...prev, quality];
        return newHistory.slice(-historySize);
      });
    } else {
      setQualityHistory([]);
      setDisplayQuality(0);
      setStabilityScore(0);
    }
  }, [quality, isMonitoring]);

  // Calcular calidad ponderada con verificación fisiológica
  // y aplicación de criterios extremadamente estrictos
  useEffect(() => {
    if (qualityHistory.length === 0) {
      setDisplayQuality(0);
      setStabilityScore(0);
      return;
    }

    // Ponderación con mayor peso a valores más recientes
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      // Ponderación exponencial - valores recientes tienen mucho más peso
      const weight = Math.pow(1.35, index); 
      weightedSum += q * weight;
      totalWeight += weight;
    });

    // Calcular media ponderada 
    let weightedAverage = Math.round(weightedSum / totalWeight);
    
    // Verificar estabilidad de la señal - mucho más exigente
    const variance = calculateVariance(qualityHistory);
    const normalizedVariance = Math.min(250, variance) / 250;
    const stabilityMetric = 1 - normalizedVariance;
    setStabilityScore(stabilityMetric);
    
    // Calcular índice de consistencia
    const consistencyFactor = calculateConsistency(qualityHistory);
    
    // Logging detallado para depuración
    console.log("SignalQualityIndicator: Análisis exhaustivo", {
      variance,
      normalizedVariance,
      stabilityMetric,
      consistencyFactor,
      qualityHistory: qualityHistory.slice(-3),
      weightedAverage,
      threshold: QUALITY_THRESHOLD
    });
    
    // Penalizar fuertemente señales inestables
    if (variance > 180) { 
      weightedAverage = Math.round(weightedAverage * 0.6);
    } else if (variance > 100) {
      weightedAverage = Math.round(weightedAverage * 0.75);
    } else if (variance > 60) {
      weightedAverage = Math.round(weightedAverage * 0.9);
    }
    
    // Penalizar señales inconsistentes
    if (consistencyFactor < 0.7) {
      weightedAverage = Math.round(weightedAverage * consistencyFactor);
    }
    
    // Verificación adicional para evitar falsos positivos
    if (weightedAverage > 60 && (stabilityMetric < 0.6 || consistencyFactor < 0.65)) {
      weightedAverage = Math.min(60, weightedAverage); // Limitar calificación para señales sospechosas
    }
    
    // Verificación fisiológica
    if (weightedAverage > 30 && variance < 10) {
      // Señal demasiado estable para ser fisiológica (posible simulación)
      weightedAverage = Math.min(30, weightedAverage);
      console.log("SignalQualityIndicator: Señal sospechosamente estable - posible simulación", {
        variance, weightedAverage
      });
    }
    
    // Transición suave para mejor UX, pero con más peso a nuevos valores para actualización más rápida
    setDisplayQuality(prev => {
      const delta = (weightedAverage - prev) * 0.5; 
      return Math.round(prev + delta);
    });

    // Emitir evento de señal válida SOLO cuando tenemos calidad realmente suficiente
    // Y superamos todas las verificaciones de consistencia y estabilidad
    if (weightedAverage > MIN_QUALITY_FOR_DETECTION && 
        isMonitoring && 
        stabilityMetric > SIGNAL_STABILITY_THRESHOLD &&
        consistencyFactor > VERIFICATION_FACTOR) {
      
      const eventDetail = { 
        quality: weightedAverage,
        stable: stabilityMetric > SIGNAL_STABILITY_THRESHOLD,
        variance,
        stabilityScore: stabilityMetric,
        consistencyFactor,
        qualityHistory: qualityHistory.slice(-3),
        timestamp: Date.now()
      };
      
      // Emitir evento más frecuente cuando la calidad es buena 
      if (weightedAverage > QUALITY_THRESHOLD || Math.random() < 0.2) {
        window.dispatchEvent(new CustomEvent('validSignalDetected', { 
          detail: eventDetail
        }));
        
        console.log("SignalQualityIndicator: Evento validSignalDetected emitido", eventDetail);
      }
    }
  }, [qualityHistory, isMonitoring]);

  // Calcular varianza para detección de estabilidad
  const calculateVariance = (values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  };
  
  // Calcular consistencia (diferencia máxima entre valores consecutivos)
  const calculateConsistency = (values: number[]): number => {
    if (values.length < 3) return 1;
    
    let maxDiff = 0;
    for (let i = 1; i < values.length; i++) {
      const diff = Math.abs(values[i] - values[i-1]);
      maxDiff = Math.max(maxDiff, diff);
    }
    
    // Normalizar a un rango de 0-1 donde 1 es perfectamente consistente
    return Math.max(0, Math.min(1, 1 - (maxDiff / 100)));
  };

  /**
   * Obtiene el color basado en la calidad con niveles intermedios más claros
   */
  const getQualityColor = (q: number) => {
    if (q === 0) return '#666666';
    if (q > 75) return '#00ff00';
    if (q > 60) return '#bfff00';
    if (q > 45) return '#ffff00';
    if (q > 30) return '#ffbf00';
    if (q > 15) return '#ff8000';
    return '#ff0000';
  };

  /**
   * Obtiene el texto descriptivo de calidad con más niveles intermedios
   */
  const getQualityText = (q: number) => {
    if (q === 0) return 'Sin Dedo';
    if (q > 75) return 'Excelente';
    if (q > 60) return 'Muy Buena';
    if (q > 45) return 'Buena';
    if (q > 30) return 'Regular';
    if (q > 15) return 'Baja';
    return 'Muy Baja';
  };

  // Efecto de pulso adaptado a la plataforma y calidad
  const pulseStyle = displayQuality > 0 
    ? isAndroid 
      ? `animate-pulse transition-all duration-${500 - Math.min(400, displayQuality * 3)}`
      : `animate-pulse transition-all duration-${400 - Math.min(300, displayQuality * 2)}`
    : "transition-all duration-300";

  // Calcular opacidad basada en estabilidad para feedback visual
  const stabilityOpacity = Math.max(0.3, Math.min(1, stabilityScore));

  return (
    <div className="bg-black/30 backdrop-blur-md rounded p-1 w-full relative" style={{ marginTop: "-9mm" }}>
      <div className="flex items-center gap-1">
        <div 
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${pulseStyle}`}
          style={{
            borderColor: getQualityColor(displayQuality),
            backgroundColor: `${getQualityColor(displayQuality)}33`,
            opacity: stabilityOpacity
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
      
      {/* Mensajes de ayuda más específicos */}
      {showHelpTip && displayQuality < QUALITY_THRESHOLD && (
        <div className="absolute -bottom-20 left-0 right-0 bg-black/70 p-2 rounded text-white text-xs flex items-center gap-1">
          <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
          {displayQuality === 0 ? (
            <span>Coloque su dedo cubriendo completamente la cámara y la luz de flash.</span>
          ) : displayQuality < 30 ? (
            <span>Presione firmemente y mantenga el dedo quieto. Ajuste la posición.</span>
          ) : (
            <span>Mantenga el dedo firme y evite movimientos para mejorar la medición.</span>
          )}
        </div>
      )}
    </div>
  );
};

export default SignalQualityIndicator;
