
  return {
    processSignal,
    reset,
    fullReset,
    applyBloodPressureCalibration,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults, // Devolver los últimos resultados válidos guardados
    arrhythmiaWindows,
    debugInfo: getDebugInfo()
  };
