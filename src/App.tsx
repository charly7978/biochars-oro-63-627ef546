
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const App = () => {
  console.log("DEBUG: App component - Initializing");
  
  // Log React version for debugging
  const reactVersion = React?.version;
  console.log(`DEBUG: App component - React version: ${reactVersion}`);
  
  // Check if window/document are available (to detect SSR issues)
  console.log("DEBUG: App component - Environment check:", {
    hasWindow: typeof window !== 'undefined',
    hasDocument: typeof document !== 'undefined',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  });
  
  console.log("DEBUG: App component - Creating router");
  
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
};

export default App;
