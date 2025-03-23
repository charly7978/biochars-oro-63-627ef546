
import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

interface CalibrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CalibrationDialog: React.FC<CalibrationDialogProps> = ({ 
  isOpen, 
  onClose
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md perspective-1000">
        <motion.div
          initial={{ rotateY: -90 }}
          animate={{ rotateY: 0 }}
          exit={{ rotateY: 90 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ transformStyle: "preserve-3d" }}
          className="bg-background p-6 rounded-lg shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">Información</h2>
            <div className="w-9" />
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-500 text-center">
              El procesamiento avanzado de señales no requiere calibración.
            </p>

            <Button
              className="w-full"
              onClick={onClose}
            >
              Aceptar
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default CalibrationDialog;
