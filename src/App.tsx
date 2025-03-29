
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import HeartRateTrainerPage from "./pages/HeartRateTrainerPage";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle } from "./components/ui/navigation-menu";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

const App = () => {
  return (
    <Router>
      <header className="bg-slate-900 text-white py-2 px-4">
        <NavigationMenu className="max-w-full">
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link to="/" className={navigationMenuTriggerStyle()}>
                Inicio
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link to="/entrenador-bpm" className={navigationMenuTriggerStyle()}>
                <Heart className="mr-1 h-4 w-4" />
                Entrenador BPM
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </header>
      
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/entrenador-bpm" element={<HeartRateTrainerPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
};

export default App;
