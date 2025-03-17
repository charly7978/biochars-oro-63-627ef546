
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

/**
 * Componente que muestra la calidad de la señal PPG
 * Con validación extremadamente estricta para evitar falsos positivos
 */
const SignalQualityIndicator = ({ quality, isMonitoring = false }: SignalQualityIndicatorProps) => {
  // Estado local
  const [displayQuality, setDisplayQuality] = useState(0);
  const [qualityHistory, setQualityHistory] = useState<number[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showHelpTip, setShowHelpTip] = useState(false);
  const [stabilityScore, setStabilityScore] = useState(0);
  const [consecutiveGoodReadings, setConsecutiveGoodReadings] = useState(0);
  const [falsePositiveDetected, setFalsePositiveDetected] = useState(false);
  
  // Constantes de configuración - extremadamente estrictas
  const historySize = 12; // Ventana más grande para mejor análisis
  const QUALITY_THRESHOLD = 85; // Umbral muy elevado para calidad considerada "buena"
  const MIN_QUALITY_FOR_DETECTION = 50; // Umbral mínimo más elevado para evitar falsos positivos
  const SIGNAL_STABILITY_THRESHOLD = 0.65; // Umbral de estabilidad extremadamente exigente
  const VERIFICATION_FACTOR = 0.85; // Factor de verificación ultrastricto
  const CONSECUTIVE_READINGS_NEEDED = 5; // Número de lecturas buenas consecutivas necesarias

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
      // Verificación extrema para valores sospechosos que podrían ser falsos positivos
      if (quality > 90 && quality < 100) {
        // Valores cercanos a 100 sin ser 100 exactos son altamente sospechosos (comunes en simulaciones)
        console.log("SignalQualityIndicator: Valor sospechosamente perfecto detectado", quality);
        setFalsePositiveDetected(true);
        setTimeout(() => setFalsePositiveDetected(false), 5000);
        return;
      }
      
      setQualityHistory(prev => {
        const newHistory = [...prev, quality];
        return newHistory.slice(-historySize);
      });
    } else {
      setQualityHistory([]);
      setDisplayQuality(0);
      setStabilityScore(0);
      setConsecutiveGoodReadings(0);
    }
  }, [quality, isMonitoring]);

  // Calcular calidad ponderada con verificación fisiológica estricta
  useEffect(() => {
    if (qualityHistory.length === 0 || !isMonitoring) {
      setDisplayQuality(0);
      setStabilityScore(0);
      setConsecutiveGoodReadings(0);
      return;
    }

    // Verificar varianza para detectar señales artificiales o demasiado estables
    const variance = calculateVariance(qualityHistory);
    if (variance < 0.1 && qualityHistory.every(q => q > 0)) {
      console.log("SignalQualityIndicator: Señal artificialmente estable detectada", {
        variance,
        history: qualityHistory.slice(-5)
      });
      setDisplayQuality(Math.min(10, displayQuality));
      setStabilityScore(0.1);
      setConsecutiveGoodReadings(0);
      return;
    }

    // Ponderación con mayor peso a valores más recientes
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      // Ponderación exponencial - valores recientes tienen mucho más peso
      const weight = Math.pow(1.5, index); 
      weightedSum += q * weight;
      totalWeight += weight;
    });

    // Calcular media ponderada 
    let weightedAverage = Math.round(weightedSum / totalWeight);
    
    // Verificar estabilidad de la señal - extremadamente exigente
    const normalizedVariance = Math.min(250, variance) / 250;
    const stabilityMetric = 1 - normalizedVariance;
    setStabilityScore(stabilityMetric);
    
    // Calcular índice de consistencia con criterios más estrictos
    const consistencyFactor = calculateConsistency(qualityHistory);
    
    // Logging detallado para depuración
    console.log("SignalQualityIndicator: Análisis ultra-estricto", {
      rawQuality: quality,
      variance,
      normalizedVariance,
      stabilityMetric,
      consistencyFactor,
      qualityHistory: qualityHistory.slice(-3),
      weightedAverage,
      threshold: QUALITY_THRESHOLD,
      consecutiveGoodReadings
    });
    
    // Penalizar fuertemente señales inestables
    if (variance > 120) { 
      weightedAverage = Math.round(weightedAverage * 0.3);
    } else if (variance > 80) {
      weightedAverage = Math.round(weightedAverage * 0.5);
    } else if (variance > 40) {
      weightedAverage = Math.round(weightedAverage * 0.7);
    }
    
    // Penalizar señales inconsistentes
    if (consistencyFactor < 0.8) {
      weightedAverage = Math.round(weightedAverage * consistencyFactor * 0.8);
    }
    
    // Verificación adicional para evitar falsos positivos
    if (weightedAverage > 60 && (stabilityMetric < 0.7 || consistencyFactor < 0.75)) {
      weightedAverage = Math.min(50, weightedAverage);
    }
    
    // Verificación fisiológica más estricta
    if (weightedAverage > 30 && variance < 3) {
      // Señal demasiado estable para ser fisiológica (posible simulación)
      weightedAverage = Math.min(20, weightedAverage);
      console.log("SignalQualityIndicator: Señal sospechosamente estable - posible simulación", {
        variance, weightedAverage
      });
    }

    // Verificación de consistencia entre lecturas
    if (weightedAverage > MIN_QUALITY_FOR_DETECTION) {
      setConsecutiveGoodReadings(prev => prev + 1);
    } else {
      setConsecutiveGoodReadings(0);
    }
    
    // Sólo mostrar calidad alta después de varias lecturas buenas consecutivas
    const finalQuality = (consecutiveGoodReadings >= CONSECUTIVE_READINGS_NEEDED) 
      ? weightedAverage 
      : Math.min(weightedAverage, MIN_QUALITY_FOR_DETECTION - 5);
    
    // Transición suave para mejor UX, pero con más peso a nuevos valores
    setDisplayQuality(prev => {
      const delta = (finalQuality - prev) * 0.5; 
      return Math.round(prev + delta);
    });

    // Emitir evento de señal válida SOLO con requisitos extremadamente estrictos
    if (finalQuality > MIN_QUALITY_FOR_DETECTION && 
        isMonitoring && 
        stabilityMetric > SIGNAL_STABILITY_THRESHOLD &&
        consistencyFactor > VERIFICATION_FACTOR &&
        consecutiveGoodReadings >= CONSECUTIVE_READINGS_NEEDED) {
      
      const eventDetail = { 
        quality: finalQuality,
        stable: stabilityMetric > SIGNAL_STABILITY_THRESHOLD,
        variance,
        stabilityScore: stabilityMetric,
        consistencyFactor,
        qualityHistory: qualityHistory.slice(-3),
        timestamp: Date.now()
      };
      
      window.dispatchEvent(new CustomEvent('validSignalDetected', { 
        detail: eventDetail
      }));
      
      console.log("SignalQualityIndicator: Evento validSignalDetected emitido tras verificación estricta", eventDetail);
    }
  }, [qualityHistory, isMonitoring, consecutiveGoodReadings]);

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
   * Obtiene el color basado en la calidad con niveles intermedios más definidos
   */
  const getQualityColor = (q: number) => {
    if (falsePositiveDetected) return '#ff6b6b';
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
    if (falsePositiveDetected) return 'Falso Positivo';
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
