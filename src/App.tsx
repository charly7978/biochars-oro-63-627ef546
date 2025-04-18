
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import OptimizedIndex from './pages/OptimizedIndex';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<OptimizedIndex />} />
        <Route path="/legacy" element={<Index />} />
      </Routes>
    </Router>
  );
}

export default App;
