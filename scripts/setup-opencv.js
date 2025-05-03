/**
 * Script de configuración de OpenCV.js
 * Descarga, prepara y configura OpenCV.js para su uso en la aplicación
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

// URLs de OpenCV.js
const OPENCV_JS_URL = 'https://docs.opencv.org/4.7.0/opencv.js';
const OPENCV_WASM_URL = 'https://docs.opencv.org/4.7.0/opencv_js.wasm';

// Directorio de destino (public)
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const OPENCV_DIR = path.resolve(PUBLIC_DIR, 'opencv');

// Función para crear directorio
function createDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Directorio creado: ${dir}`);
  }
}

// Función para descargar archivo
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Descargando: ${url}`);
    
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✅ Descargado: ${dest}`);
        resolve();
      });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      console.error(`❌ Error descargando: ${err.message}`);
      reject(err);
    });
  });
}

// Función principal
async function setupOpenCV() {
  try {
    console.log('🔧 Configurando OpenCV.js...');
    
    // Crear directorios
    createDirectory(PUBLIC_DIR);
    createDirectory(OPENCV_DIR);
    
    // Descargar archivos de OpenCV.js
    await downloadFile(OPENCV_JS_URL, path.join(OPENCV_DIR, 'opencv.js'));
    await downloadFile(OPENCV_WASM_URL, path.join(OPENCV_DIR, 'opencv_js.wasm'));
    
    // Crear archivo de inicialización de OpenCV
    const initContent = `
// Inicialización de OpenCV.js
window.Module = {
  onRuntimeInitialized: function() {
    console.log('✅ OpenCV.js runtime inicializado');
    document.dispatchEvent(new Event('opencv-ready'));
  }
};
`;
    fs.writeFileSync(
      path.join(OPENCV_DIR, 'opencv-init.js'),
      initContent
    );
    
    console.log('🎉 OpenCV.js configurado correctamente');
  } catch (error) {
    console.error('❌ Error configurando OpenCV.js:', error);
    process.exit(1);
  }
}

// Ejecutar
setupOpenCV(); 