
// Configuración de inicialización de OpenCV.js
var Module = {
  onRuntimeInitialized: function() {
    console.log('OpenCV.js runtime initialized.');
    // Disparar evento cuando OpenCV esté listo
    window.dispatchEvent(new CustomEvent('opencv-ready'));
    // Establecer bandera global para facilitar verificación
    window.cv_ready = true;
  },
  preRun: [],
  postRun: [],
  print: function(text) { console.log('OpenCV.js:', text); },
  printErr: function(text) { console.warn('OpenCV.js Error:', text); }
};

console.log('OpenCV.js initialization script loaded.');
