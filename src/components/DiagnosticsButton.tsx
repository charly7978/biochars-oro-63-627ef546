
import React from 'react';
import { Button } from './ui/button';
import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const DiagnosticsButton = () => {
  return (
    <Link to="/diagnostics">
      <Button 
        variant="outline" 
        size="icon" 
        className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 z-50"
        title="System Diagnostics"
      >
        <Activity className="h-4 w-4 text-blue-600" />
      </Button>
    </Link>
  );
};

export default DiagnosticsButton;
