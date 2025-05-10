
// OpenCV initialization script
var Module = {
  onRuntimeInitialized: function() {
    console.log('OpenCV.js runtime initialized.');
    // Dispatch event when OpenCV is ready
    window.dispatchEvent(new CustomEvent('opencv-ready'));
  }
};
console.log('OpenCV.js initialization script loaded.');
