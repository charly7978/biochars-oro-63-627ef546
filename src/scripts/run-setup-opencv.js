
/**
 * Simple script to run the OpenCV setup
 */
console.log('Running OpenCV setup script...');

// Use dynamic import for ESM compatibility
import('./setup-opencv.js')
  .then(() => {
    console.log('OpenCV setup script imported successfully.');
  })
  .catch((error) => {
    console.error('Failed to import OpenCV setup script:', error);
    process.exit(1);
  });
