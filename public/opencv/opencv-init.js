
// Inicialización de OpenCV.js
// Adding type="module" to the script tag in index.html
window.Module = {
  onRuntimeInitialized: function() {
    console.log('✅ OpenCV.js runtime inicializado');
    document.dispatchEvent(new Event('opencv-ready'));
    window.cv_ready = true;
  }
}; 

// Export module for ES modules compatibility
export default window.Module;
