
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import VitalsHistoryView from './VitalsHistoryView';

interface Measurement {
  id: string;
  timestamp: number;
  heartRate: number;
  spo2: number;
  systolic: number;
  diastolic: number;
  arrhythmiaStatus: string;
}

interface VitalsHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measurements: Measurement[];
}

const VitalsHistoryDialog: React.FC<VitalsHistoryDialogProps> = ({
  open,
  onOpenChange,
  measurements
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de Mediciones</DialogTitle>
          <DialogDescription>
            Visualice el registro de sus mediciones anteriores.
          </DialogDescription>
        </DialogHeader>
        <VitalsHistoryView 
          measurements={measurements} 
          onClose={() => onOpenChange(false)} 
        />
      </DialogContent>
    </Dialog>
  );
};

export default VitalsHistoryDialog;
