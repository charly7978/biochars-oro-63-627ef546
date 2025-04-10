
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import Index from "./pages/Index"; // Match the exact case of the file
import NotFound from "./pages/NotFound";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ShadcnToaster />
      <SonnerToaster 
        position="top-right"
        toastOptions={{
          style: {
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            border: "1px solid rgba(63, 63, 70, 0.4)",
          }
        }}
      />
    </Router>
  );
};

export default App;
