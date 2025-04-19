
  /**
   * Obtener información de depuración
   */
  const getDebugInfo = useCallback(() => {
    return {
      ...debugInfo.current,
      processedSignals: processedSignals.current,
      ppgBufferLength: ppgBuffer.current.length,
      arrhythmiaCounter,
      processorActive: !!vitalSignsProcessor.current,
      signalLog: [] // Añadimos signalLog vacío para cumplir con el tipo esperado
    };
  }, [arrhythmiaCounter]);
