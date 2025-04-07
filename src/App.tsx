
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ErrorHandlingProvider } from "./components/ErrorHandlingProvider";
import { useEffect } from "react";
import ErrorDefenseSystem from "./core/error-defense/ErrorDefenseSystem";
import DependencyMonitor from "./core/error-defense/DependencyMonitor";

const App = () => {
  // Inicializar sistemas de defensa
  useEffect(() => {
    // Inicializar sistema de defensa
    const errorDefense = ErrorDefenseSystem.getInstance();
    
    // Inicializar monitor de dependencias
    const dependencyMonitor = DependencyMonitor.getInstance();
    
    // Verificar dependencias
    dependencyMonitor.checkAllDependencies();
    
    return () => {
      // Cerrar sistemas al desmontar
      errorDefense.shutdown();
      dependencyMonitor.shutdown();
    };
  }, []);
  
  return (
    <Router>
      <ErrorHandlingProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
        <SonnerToaster />
      </ErrorHandlingProvider>
    </Router>
  );
};

export default App;
