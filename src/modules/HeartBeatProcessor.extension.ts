
// Este archivo extiende la funcionalidad del HeartBeatProcessor
// para proporcionar datos PPG a otros procesadores

// Esta función se añadirá al prototipo de HeartBeatProcessor
// usando el código de inicialización a continuación
function getPPGData(this: any): number[] {
  // Si el procesador tiene un buffer de PPG, devolverlo
  if (this.ppgBuffer && Array.isArray(this.ppgBuffer)) {
    return [...this.ppgBuffer];
  }
  
  // Si el procesador tiene un filtro u otras estructuras con datos PPG, intentar extraerlos
  if (this.filter && this.filter.buffer && Array.isArray(this.filter.buffer)) {
    return [...this.filter.buffer];
  }
  
  // Si el procesador tiene un array de valores, devolverlo
  if (this.values && Array.isArray(this.values)) {
    return [...this.values];
  }
  
  // Si hay algún otro método que devuelve datos relacionados con PPG, usarlo
  if (typeof this.getFilteredValues === 'function') {
    const filtered = this.getFilteredValues();
    if (Array.isArray(filtered)) {
      return filtered;
    }
  }
  
  // Si no se encuentra ninguna fuente de datos PPG, devolver array vacío
  console.warn("HeartBeatProcessor.getPPGData: No se encontraron datos PPG disponibles");
  return [];
}

// Código de inicialización que se ejecutará automáticamente
(function() {
  if (typeof window !== 'undefined') {
    // Esperar a que HeartBeatProcessor esté disponible
    const checkAndExtend = () => {
      const processor = (window as any).heartBeatProcessor;
      
      if (processor) {
        // Verificar si ya tiene el método getPPGData
        if (!processor.getPPGData) {
          // Añadir el método al prototipo o directamente al objeto
          console.log("Extendiendo HeartBeatProcessor con getPPGData");
          processor.getPPGData = getPPGData;
        }
      } else {
        // Si no está disponible aún, intentar nuevamente en 100ms
        setTimeout(checkAndExtend, 100);
      }
    };
    
    // Iniciar el proceso de comprobación
    checkAndExtend();
  }
})();
