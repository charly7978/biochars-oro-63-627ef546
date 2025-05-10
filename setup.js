
/**
 * Manual setup script to prepare the project
 */
console.log('🚀 Starting project setup...');

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure scripts directory exists
const scriptsDir = path.join(__dirname, 'scripts');
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
  console.log('✅ Created scripts directory');
}

// Ensure public/opencv directory exists
const opencvDir = path.join(__dirname, 'public', 'opencv');
if (!fs.existsSync(opencvDir)) {
  fs.mkdirSync(opencvDir, { recursive: true });
  console.log('✅ Created OpenCV directory');
}

// Run the OpenCV setup script directly using an absolute path
console.log('📦 Running OpenCV setup...');
try {
  const setupScriptPath = path.join(__dirname, 'scripts', 'setup-opencv.cjs');
  console.log(`Using script path: ${setupScriptPath}`);
  
  // Make sure file exists
  if (!fs.existsSync(setupScriptPath)) {
    console.error(`❌ Setup script not found at: ${setupScriptPath}`);
    process.exit(1);
  }
  
  // Use require with absolute path
  require(setupScriptPath);
  console.log('✅ OpenCV setup completed successfully');
} catch (error) {
  console.error('❌ OpenCV setup failed:', error.message);
  console.log('Please run setup manually: node scripts/setup-opencv.cjs');
}

console.log(`
🎉 Setup completed!

To start the development server:
> npm run dev

For more information, see the README.md file.
`);
