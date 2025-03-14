
import React from 'react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

interface MeasurementConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  measurementTime: number;
  heartRate: number | string;
  spo2: number | string;
  pressure: string;
  glucose?: number | string;
  cholesterol?: number | string;
  triglycerides?: number | string;
}

const MeasurementConfirmationDialog: React.FC<MeasurementConfirmationDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  measurementTime,
  heartRate,
  spo2,
  pressure,
  glucose = '--',
  cholesterol = '--',
  triglycerides = '--'
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-center">
            Confirmar Medición
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            La medición se ha completado en {measurementTime} segundos.
            ¿Confirmas que los resultados son correctos?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center mb-2">
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">Frecuencia Cardíaca</div>
              <div className="font-bold text-lg">{heartRate} BPM</div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">SPO2</div>
              <div className="font-bold text-lg">{spo2}%</div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">Presión</div>
              <div className="font-bold text-lg">{pressure}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">Glucosa</div>
              <div className="font-bold text-lg">{glucose || '--'} mg/dL</div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">Colesterol</div>
              <div className="font-bold text-lg">{cholesterol || '--'} mg/dL</div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">Triglicéridos</div>
              <div className="font-bold text-lg">{triglycerides || '--'} mg/dL</div>
            </div>
          </div>
        </div>
        
        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
          <AlertDialogCancel 
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2"
          >
            <XCircle size={18} />
            Repetir Medición
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle size={18} />
            Confirmar Resultados
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default MeasurementConfirmationDialog;
