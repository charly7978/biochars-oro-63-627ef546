
// Configuración de inicialización de OpenCV.js - Simplified and Robust
var Module = {
  onRuntimeInitialized: function() {
    console.log('[OpenCV] Runtime inicializado correctamente.');
    // Set global flag first
    window.cv_ready = true;
    // Then dispatch event
    window.dispatchEvent(new CustomEvent('opencv-ready'));
    console.log('[OpenCV] Event dispatched successfully');
  },
  print: function(text) { console.log('[OpenCV]:', text); },
  printErr: function(text) { console.error('[OpenCV Error]:', text); }
};

// Set initial state
window.cv_ready = false;
console.log('[OpenCV] Script de inicialización cargado correctamente.');
