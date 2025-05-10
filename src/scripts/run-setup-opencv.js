
/**
 * Simple script to run the OpenCV setup
 */
console.log('Running OpenCV setup script...');

// Get the directory of the current script
const path = require('path');
const scriptDir = path.dirname(__filename);

// Use dynamic import for ESM compatibility with explicit path
const setupScriptPath = path.join(scriptDir, 'setup-opencv.js');
console.log(`Trying to import setup script from: ${setupScriptPath}`);

// Use CommonJS require if possible, fallback to dynamic import
try {
  require(setupScriptPath);
  console.log('OpenCV setup script completed successfully (CommonJS).');
} catch (error) {
  if (error.code === 'ERR_REQUIRE_ESM') {
    // If it's an ESM module, use dynamic import
    import(setupScriptPath)
      .then(() => {
        console.log('OpenCV setup script completed successfully (ESM).');
      })
      .catch((error) => {
        console.error('Failed to import OpenCV setup script:', error);
        process.exit(1);
      });
  } else {
    console.error('Failed to require OpenCV setup script:', error);
    process.exit(1);
  }
}
