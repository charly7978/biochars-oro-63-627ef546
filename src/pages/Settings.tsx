import React from 'react';
import { TensorFlowToggle } from '@/components/TensorFlowToggle';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Settings = () => {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center mb-6">
        <Button variant="ghost" asChild className="mr-2">
          <Link to="/">
            <ArrowLeft className="h-5 w-5 mr-1" />
            Volver
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Configuración</h1>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-4">Procesamiento de Datos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TensorFlowToggle />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            La desactivación de la red neuronal puede mejorar el rendimiento de la aplicación en dispositivos de bajas prestaciones.
            Los datos seguirán procesándose usando algoritmos estadísticos, pero sin la precisión de la IA.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Settings; 