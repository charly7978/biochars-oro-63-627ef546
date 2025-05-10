
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Make sure DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    console.error("Root element not found");
    return;
  }
  
  // Create root and render app
  createRoot(rootElement).render(<App />);
  
  console.log("Application rendered successfully");
});
