
// OpenCV initialization script
var Module = {
  onRuntimeInitialized: function() {
    console.log('OpenCV.js runtime initialized.');
    // Dispatch event when OpenCV is ready
    window.dispatchEvent(new CustomEvent('opencv-ready'));
    // Also set a global flag for easier checking
    window.cv_ready = true;
  }
};
console.log('OpenCV.js initialization script loaded.');
