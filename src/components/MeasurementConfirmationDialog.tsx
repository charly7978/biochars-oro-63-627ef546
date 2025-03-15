
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
  // Format values to correctly display "--" for 0, null, or undefined values
  const formatValue = (value: number | string | undefined): string => {
    if (value === 0 || value === null || value === undefined || value === '') {
      return '--';
    }
    return String(value);
  };

  const formattedHeartRate = formatValue(heartRate);
  const formattedSpo2 = formatValue(spo2);
  const formattedGlucose = formatValue(glucose);
  const formattedCholesterol = formatValue(cholesterol);
  const formattedTriglycerides = formatValue(triglycerides);

  // Debug logging
  console.log("MeasurementConfirmationDialog - Valores recibidos:", {
    heartRate,
    spo2,
    pressure,
    glucose,
    cholesterol,
    triglycerides
  });
  
  console.log("MeasurementConfirmationDialog - Valores formateados:", {
    formattedHeartRate,
    formattedSpo2,
    formattedGlucose,
    formattedCholesterol,
    formattedTriglycerides
  });

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
              <div className="font-bold text-lg">{formattedHeartRate} BPM</div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">SPO2</div>
              <div className="font-bold text-lg">{formattedSpo2}%</div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">Presión</div>
              <div className="font-bold text-lg">{pressure}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">Glucosa</div>
              <div className="font-bold text-lg">{formattedGlucose} mg/dL</div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">Colesterol</div>
              <div className="font-bold text-lg">{formattedCholesterol} mg/dL</div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-500">Triglicéridos</div>
              <div className="font-bold text-lg">{formattedTriglycerides} mg/dL</div>
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
