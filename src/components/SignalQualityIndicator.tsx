
import React, { useState, useEffect, useRef } from 'react';
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
  const [suspiciousPattern, setSuspiciousPattern] = useState(false);
  
  // Contadores para detección avanzada de falsos positivos
  const suspiciousPatternsCountRef = useRef(0);
  const goodSignalCountRef = useRef(0);
  const sampleCountRef = useRef(0);
  const lastThreeQualitiesRef = useRef<number[]>([]);
  
  // Constantes de configuración - extremadamente estrictas
  const historySize = 15; // Ventana más grande para mejor análisis (aumentado de 12)
  const QUALITY_THRESHOLD = 90; // Umbral extremadamente elevado (aumentado de 85)
  const MIN_QUALITY_FOR_DETECTION = 65; // Umbral mínimo mucho más elevado (aumentado de 50)
  const SIGNAL_STABILITY_THRESHOLD = 0.75; // Umbral de estabilidad extremadamente exigente (aumentado de 0.65)
  const VERIFICATION_FACTOR = 0.90; // Factor de verificación ultrastricto (aumentado de 0.85)
  const CONSECUTIVE_READINGS_NEEDED = 10; // Número de lecturas buenas consecutivas necesarias (aumentado de 5)
  const TEMPORAL_VARIATION_MIN = 2.0; // Mínima variación temporal necesaria (nuevo)
  const TEMPORAL_VARIATION_MAX = 30.0; // Máxima variación temporal permitida (nuevo)
  const SUSPICIOUSLY_STABLE_COUNT = 6; // Cuenta para considerar una señal sospechosamente estable (nuevo)

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
      // Incrementar contador de muestras
      sampleCountRef.current += 1;
      
      // Verificación extrema para valores sospechosos que podrían ser falsos positivos
      if (quality > 90) {
        // Valores cercanos a 100 sin cambio significativo son altamente sospechosos
        lastThreeQualitiesRef.current.push(quality);
        if (lastThreeQualitiesRef.current.length > 3) {
          lastThreeQualitiesRef.current.shift();
        }
        
        // Calcular variación entre muestras consecutivas
        if (lastThreeQualitiesRef.current.length === 3) {
          const diffs = [
            Math.abs(lastThreeQualitiesRef.current[1] - lastThreeQualitiesRef.current[0]),
            Math.abs(lastThreeQualitiesRef.current[2] - lastThreeQualitiesRef.current[1])
          ];
          
          const avgDiff = (diffs[0] + diffs[1]) / 2;
          
          // Si la diferencia es muy pequeña, es sospechosamente estable
          if (avgDiff < 0.8) {
            suspiciousPatternsCountRef.current += 1;
            if (suspiciousPatternsCountRef.current >= SUSPICIOUSLY_STABLE_COUNT) {
              setSuspiciousPattern(true);
              setFalsePositiveDetected(true);
              console.log("SignalQualityIndicator: Patrón sospechosamente estable detectado", {
                lastValues: [...lastThreeQualitiesRef.current],
                avgDiff,
                count: suspiciousPatternsCountRef.current
              });
              setTimeout(() => {
                setFalsePositiveDetected(false);
                setSuspiciousPattern(false);
                suspiciousPatternsCountRef.current = 0;
              }, 5000);
            }
          } else {
            // Reducir contador si hay variación natural
            suspiciousPatternsCountRef.current = Math.max(0, suspiciousPatternsCountRef.current - 1);
          }
        }
      } else {
        // Reducir contador para valores normales
        suspiciousPatternsCountRef.current = Math.max(0, suspiciousPatternsCountRef.current - 1);
      }
      
      // Actualizar historial de calidad
      setQualityHistory(prev => {
        const newHistory = [...prev, quality];
        return newHistory.slice(-historySize);
      });
    } else {
      setQualityHistory([]);
      setDisplayQuality(0);
      setStabilityScore(0);
      setConsecutiveGoodReadings(0);
      setSuspiciousPattern(false);
      setFalsePositiveDetected(false);
      suspiciousPatternsCountRef.current = 0;
      goodSignalCountRef.current = 0;
      sampleCountRef.current = 0;
      lastThreeQualitiesRef.current = [];
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
    
    // Rechazar señales con varianza extremadamente baja (posible simulación)
    if (variance < 0.5 && qualityHistory.every(q => q > 0)) {
      console.log("SignalQualityIndicator: Señal artificialmente estable detectada", {
        variance,
        history: qualityHistory.slice(-5)
      });
      setDisplayQuality(Math.min(5, displayQuality));
      setStabilityScore(0.1);
      setConsecutiveGoodReadings(0);
      setSuspiciousPattern(true);
      return;
    }
    
    // Verificar si la varianza está dentro de un rango fisiológicamente plausible
    if (variance < TEMPORAL_VARIATION_MIN || variance > TEMPORAL_VARIATION_MAX) {
      console.log("SignalQualityIndicator: Varianza de señal fuera de rango fisiológico", {
        variance,
        minAllowed: TEMPORAL_VARIATION_MIN,
        maxAllowed: TEMPORAL_VARIATION_MAX
      });
      setDisplayQuality(Math.min(10, displayQuality));
      setStabilityScore(0.2);
      setConsecutiveGoodReadings(0);
      return;
    }

    // Ponderación con mayor peso a valores más recientes
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      // Ponderación exponencial - valores recientes tienen mucho más peso
      const weight = Math.pow(1.8, index); // Aumentado de 1.5 a 1.8
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
      consecutiveGoodReadings,
      suspiciousPattern
    });
    
    // Penalizar fuertemente señales inestables
    if (variance > 120) { 
      weightedAverage = Math.round(weightedAverage * 0.2); // Reducido de 0.3
    } else if (variance > 80) {
      weightedAverage = Math.round(weightedAverage * 0.4); // Reducido de 0.5
    } else if (variance > 40) {
      weightedAverage = Math.round(weightedAverage * 0.6); // Reducido de 0.7
    }
    
    // Penalizar señales inconsistentes
    if (consistencyFactor < 0.85) { // Aumentado de 0.8 a 0.85
      weightedAverage = Math.round(weightedAverage * consistencyFactor * 0.7); // Reducido de 0.8 a 0.7
    }
    
    // Verificación adicional para evitar falsos positivos
    if (weightedAverage > 60 && (stabilityMetric < 0.75 || consistencyFactor < 0.8)) {
      weightedAverage = Math.min(40, weightedAverage); // Reducido de 50 a 40
    }
    
    // Verificación fisiológica más estricta
    if (weightedAverage > 30 && variance < 4) { // Aumentado de 3 a 4
      // Señal demasiado estable para ser fisiológica (posible simulación)
      weightedAverage = Math.min(15, weightedAverage); // Reducido de 20 a 15
      console.log("SignalQualityIndicator: Señal sospechosamente estable - posible simulación", {
        variance, weightedAverage
      });
    }

    // Verificación de consistencia entre lecturas
    if (weightedAverage > MIN_QUALITY_FOR_DETECTION) {
      setConsecutiveGoodReadings(prev => prev + 1);
      goodSignalCountRef.current += 1;
    } else {
      setConsecutiveGoodReadings(0);
    }
    
    // Verificar la proporción total de buenas señales
    const goodSignalRatio = goodSignalCountRef.current / Math.max(1, sampleCountRef.current);
    if (sampleCountRef.current > 20 && goodSignalRatio > 0.9) {
      // Demasiadas "buenas" señales consecutivas es sospechoso
      console.log("SignalQualityIndicator: Proporción sospechosamente alta de 'buenas' señales", {
        ratio: goodSignalRatio,
        goodCount: goodSignalCountRef.current,
        totalSamples: sampleCountRef.current
      });
      setSuspiciousPattern(true);
      weightedAverage = Math.min(30, weightedAverage);
    }
    
    // Sólo mostrar calidad alta después de varias lecturas buenas consecutivas
    const finalQuality = (consecutiveGoodReadings >= CONSECUTIVE_READINGS_NEEDED && !suspiciousPattern) 
      ? weightedAverage 
      : Math.min(weightedAverage, MIN_QUALITY_FOR_DETECTION - 10); // Más estricto, bajado 10 puntos más
    
    // Transición suave para mejor UX, pero con más peso a nuevos valores
    setDisplayQuality(prev => {
      const delta = (finalQuality - prev) * 0.4; // Reducido de 0.5 a 0.4 para transición más suave
      return Math.round(prev + delta);
    });

    // Emitir evento de señal válida SOLO con requisitos extremadamente estrictos
    if (finalQuality > MIN_QUALITY_FOR_DETECTION && 
        isMonitoring && 
        stabilityMetric > SIGNAL_STABILITY_THRESHOLD &&
        consistencyFactor > VERIFICATION_FACTOR &&
        consecutiveGoodReadings >= CONSECUTIVE_READINGS_NEEDED &&
        !suspiciousPattern) {
      
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
  }, [qualityHistory, isMonitoring, consecutiveGoodReadings, displayQuality, suspiciousPattern]);

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
    if (falsePositiveDetected || suspiciousPattern) return '#ff6b6b';
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
    if (suspiciousPattern) return 'Patrón Sospechoso';
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
          {suspiciousPattern ? (
            <span>Posible falso positivo detectado. Reajuste la posición del dedo.</span>
          ) : displayQuality === 0 ? (
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
