import React from 'react';
import DiagnosticsButton from '@/components/DiagnosticsButton';

const Index = () => {
  return (
    <div className="relative min-h-screen">
      {/* Add the DiagnosticsButton */}
      <DiagnosticsButton />
      
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Vital Signs Monitor</h1>
        {/* Existing content would go here */}
        <p>Place your finger on the sensor to begin monitoring.</p>
      </div>
    </div>
  );
};

export default Index;
