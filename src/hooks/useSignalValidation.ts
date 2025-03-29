import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalValidationResult } from '../core/RealSignalValidator';
import { validateFullSignal } from '../core/RealSignalValidator';
import FeedbackService from '../services/FeedbackService';

const INITIAL_VALIDATION: SignalValidationResult = {
  valid: true,
  level: 0,
  color: 'gray',
  label: 'Sin datos',
  warnings: [],
  badSegments: []
};

/**
 * Hook para gestionar la validación de señales
 * @param autoFeedback Si true, envía retroalimentación automática al usuario basada en la validación
 * @returns Objeto con el resultado de validación y métodos para actualizar
 */
export function useSignalValidation(autoFeedback: boolean = true) {
  const [validation, setValidation] = useState<SignalValidationResult>(INITIAL_VALIDATION);
  const [signalBuffer, setSignalBuffer] = useState<number[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  
  // Validación periódica
  useEffect(() => {
    if (!isValidating || signalBuffer.length < 10) return;
    
    const intervalId = setInterval(() => {
      validateSignal();
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [isValidating, signalBuffer]);
  
  // Enviar retroalimentación al usuario basada en la validación
  useEffect(() => {
    if (!autoFeedback || validation.valid) return;
    
    // Solo enviar feedback si hay problemas graves
    if (validation.color === 'red' || (validation.color === 'orange' && validation.warnings.length > 1)) {
      FeedbackService.signalValidationFeedback(validation);
    }
  }, [validation, autoFeedback]);
  
  /**
   * Añade un nuevo valor a la señal para validación
   */
  const addValue = useCallback((value: number) => {
    setSignalBuffer(prev => {
      const newBuffer = [...prev, value];
      if (newBuffer.length > 60) {
        return newBuffer.slice(-60);
      }
      return newBuffer;
    });
  }, []);
  
  /**
   * Valida la señal actual
   */
  const validateSignal = useCallback(() => {
    if (signalBuffer.length < 10) {
      return setValidation(INITIAL_VALIDATION);
    }
    
    const result = validateFullSignal(signalBuffer);
    setValidation(result);
    return result;
  }, [signalBuffer]);
  
  /**
   * Inicia la validación periódica
   */
  const startValidation = useCallback(() => {
    setIsValidating(true);
  }, []);
  
  /**
   * Detiene la validación periódica
   */
  const stopValidation = useCallback(() => {
    setIsValidating(false);
  }, []);
  
  /**
   * Reinicia el estado
   */
  const reset = useCallback(() => {
    setSignalBuffer([]);
    setValidation(INITIAL_VALIDATION);
    setIsValidating(false);
  }, []);
  
  return {
    validation,
    addValue,
    validateSignal,
    startValidation,
    stopValidation,
    reset,
    isValidating
  };
}
