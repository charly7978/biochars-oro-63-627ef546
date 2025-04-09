import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ErrorHandlingProvider } from "./components/ErrorHandlingProvider";
import { useEffect } from "react";
import ErrorDefenseSystem from "./core/error-defense/ErrorDefenseSystem";
import DependencyMonitor from "./core/error-defense/DependencyMonitor";
import { evaluateSystemQuality } from "./utils/signalLogging";

const App = () => {
  useEffect(() => {
    const errorDefense = ErrorDefenseSystem.getInstance();
    const dependencyMonitor = DependencyMonitor.getInstance();
    
    const startupVerification = async () => {
      try {
        await dependencyMonitor.checkAllDependencies();
        const qualityReport = evaluateSystemQuality();
        console.log('System startup verification:', qualityReport);
        if (qualityReport.score < 80) {
          errorDefense.reset();
          console.warn('System quality below threshold, performing preventive reset');
        }
      } catch (error) {
        console.error('System startup verification failed', error);
      }
    };
    
    const verificationTimer = setTimeout(startupVerification, 1500);
    const periodicVerificationInterval = setInterval(() => {
      dependencyMonitor.checkAllDependencies();
    }, 300000);
    
    return () => {
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
      </ErrorHandlingProvider>
    </Router>
  );
};

export default App;
