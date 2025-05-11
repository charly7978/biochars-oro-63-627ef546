
// Inicialización de OpenCV.js
window.Module = {
  onRuntimeInitialized: function() {
    console.log('✅ OpenCV.js runtime inicializado');
    document.dispatchEvent(new Event('opencv-ready'));
  }
};
