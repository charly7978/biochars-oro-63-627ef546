
// Configuración de inicialización de OpenCV.js
var Module = {
  onRuntimeInitialized: function() {
    console.log('[OpenCV] Runtime inicializado correctamente.');
    // Disparar evento cuando OpenCV esté listo
    window.dispatchEvent(new CustomEvent('opencv-ready'));
    // Establecer bandera global para facilitar verificación
    window.cv_ready = true;
  },
  preRun: [],
  postRun: [],
  print: function(text) { console.log('[OpenCV]:', text); },
  printErr: function(text) { console.error('[OpenCV Error]:', text); }
};

console.log('[OpenCV] Script de inicialización cargado.');
