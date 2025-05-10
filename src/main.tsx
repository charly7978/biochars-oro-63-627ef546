
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Asegurarse que el DOM está completamente cargado
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    console.error("Elemento raíz no encontrado");
    return;
  }
  
  // Render the app
  createRoot(rootElement).render(<App />);
  
  console.log("Aplicación renderizada correctamente");
});
