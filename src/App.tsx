
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ErrorHandlingProvider } from "./components/ErrorHandlingProvider";
import { useEffect } from "react";
import ErrorDefenseSystem from "./core/error-defense/ErrorDefenseSystem";
import DependencyMonitor from "./core/error-defense/DependencyMonitor";
import { logSignalProcessing, LogLevel, evaluateSystemQuality } from "./utils/signalLogging";

const App = () => {
  // Initialize defense systems
  useEffect(() => {
    // Initialize error defense system
    const errorDefense = ErrorDefenseSystem.getInstance();
    
    // Initialize dependency monitor
    const dependencyMonitor = DependencyMonitor.getInstance();
    
    // Run comprehensive system verification on startup
    const startupVerification = async () => {
      try {
        // Removed verbose logging toasts
        await dependencyMonitor.checkAllDependencies();
        
        const qualityReport = evaluateSystemQuality();
        
        // Only log to console, removed system toasts
        console.log('System startup verification:', qualityReport);
        
        // Preemptively reset error defense system if quality is compromised
        if (qualityReport.score < 80) {
          errorDefense.reset();
          console.warn('System quality below threshold, performing preventive reset');
        }
      } catch (error) {
        console.error('System startup verification failed', error);
      }
    };
    
    // Run verification after a short delay to allow components to initialize
    const verificationTimer = setTimeout(startupVerification, 1500);
    
    // Set up periodic verification
    const periodicVerificationInterval = setInterval(() => {
      dependencyMonitor.checkAllDependencies();
    }, 300000); // Every 5 minutes
    
    return () => {
      // Shutdown systems when unmounting
      errorDefense.shutdown();
      dependencyMonitor.shutdown();
      clearTimeout(verificationTimer);
      clearInterval(periodicVerificationInterval);
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
