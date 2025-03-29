
/**
 * Hook para cálculo de signos vitales
 * 
 * Integra el módulo de optimización con el módulo de cálculo
 * para obtener resultados precisos con feedback bidireccional
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  createCalculator, 
  VitalSignsCalculatorManager,
  CalculationResult
} from '../modules/vital-signs/calculation';
import { useSignalOptimizer } from './useSignalOptimizer';
import { useArrhythmiaVisualization } from './vital-signs/use-arrhythmia-visualization';

/**
 * Hook que conecta optimización y cálculo de signos vitales
 */
export const useVitalSignsCalculator = () => {
  // Referencia para instancia de calculador
  const calculatorRef = useRef<VitalSignsCalculatorManager | null>(null);
  
  // Estados para resultados
  const [lastCalculation, setLastCalculation] = useState<CalculationResult | null>(null);
  const [visualizationData, setVisualizationData] = useState<any>(null);
  
  // Integración con optimizador
  const { 
    optimizedSignals, 
    sendFeedback
  } = useSignalOptimizer();
  
  // Integración con visualizador de arritmias
  const { 
    arrhythmiaWindows, 
    addArrhythmiaWindow 
  } = useArrhythmiaVisualization();
  
  // Inicializar calculador
  useEffect(() => {
    if (!calculatorRef.current) {
      calculatorRef.current = createCalculator();
      console.log("VitalSignsCalculator: Inicializado y conectado al optimizador");
    }
    
    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.reset();
      }
    };
  }, []);
  
  /**
   * Procesa señales optimizadas y calcula signos vitales
   */
  const calculateVitalSigns = useCallback(() => {
    if (!calculatorRef.current) return null;
    
    try {
      // Realizar cálculos con señales optimizadas
      const result = calculatorRef.current.processOptimizedSignals(optimizedSignals);
      
      // Actualizar estado
      setLastCalculation(result);
      
      // Actualizar datos de visualización
      setVisualizationData(calculatorRef.current.getVisualizationData());
      
      // Generar feedback para optimizador
      const feedbackItems = calculatorRef.current.generateFeedback();
      
      // Enviar feedback al optimizador
      for (const feedback of feedbackItems) {
        sendFeedback(feedback);
      }
      
      // Registrar ventana de arritmia si hay un evento
      if (result.arrhythmia.status?.includes('Arritmia') && result.arrhythmia.data?.visualWindow) {
        const window = result.arrhythmia.data.visualWindow;
        addArrhythmiaWindow(window.start, window.end);
        
        // Emitir evento para que el gráfico PPG pueda mostrar la arritmia
        const arrhythmiaEvent = new CustomEvent('external-arrhythmia-detected', {
          detail: {
            timestamp: Date.now(),
            window: window,
            severity: result.arrhythmia.data.severity || 'media',
            type: result.arrhythmia.data.type || 'irregular'
          }
        });
        document.dispatchEvent(arrhythmiaEvent);
        
        console.log("Ventana de arritmia registrada para visualización en gráfico PPG:", window);
      }
      
      console.log("VitalSignsCalculator: Cálculo realizado con éxito", { 
        heartRate: result.heartRate.value,
        spo2: result.spo2.value,
        pressure: result.bloodPressure.value,
        arrhythmia: result.arrhythmia.status
      });
      
      return result;
    } catch (error) {
      console.error("Error calculando signos vitales:", error);
      return null;
    }
  }, [optimizedSignals, sendFeedback, addArrhythmiaWindow]);
  
  /**
   * Obtiene datos de visualización para gráficos
   */
  const getVisualizationData = useCallback(() => {
    return {
      ...calculatorRef.current?.getVisualizationData() || null,
      arrhythmiaWindows
    };
  }, [arrhythmiaWindows]);
  
  /**
   * Reinicia el calculador
   */
  const reset = useCallback(() => {
    if (calculatorRef.current) {
      calculatorRef.current.reset();
      setLastCalculation(null);
      setVisualizationData(null);
    }
  }, []);
  
  return {
    calculateVitalSigns,
    lastCalculation,
    visualizationData,
    getVisualizationData,
    arrhythmiaWindows,
    reset
  };
};
