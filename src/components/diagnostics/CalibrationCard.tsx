
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CircleCheck, AlertCircle } from 'lucide-react';

interface CalibrationCardProps {
  active: boolean;
  status: 'calibrating' | 'calibrated' | 'not_calibrated';
  progress: number;
  lastCalibrated: Date | null;
}

const CalibrationCard: React.FC<CalibrationCardProps> = ({
  active,
  status,
  progress,
  lastCalibrated
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'calibrated':
        return <CircleCheck className="h-5 w-5 text-green-500" />;
      case 'calibrating':
        return (
          <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
        );
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'calibrated': return 'text-green-600';
      case 'calibrating': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          Calibration Status
          <span className={`text-sm font-normal flex items-center gap-1 ${getStatusColor()}`}>
            {getStatusIcon()}
            {status === 'not_calibrated' ? 'NOT CALIBRATED' : status.toUpperCase()}
          </span>
        </CardTitle>
        <CardDescription>
          System calibration information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {status === 'calibrating' && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Calibration Progress</span>
                <span className="text-sm font-semibold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">Calibration State</div>
              <div className="font-semibold">{active ? 'Active' : 'Inactive'}</div>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">Last Calibrated</div>
              <div className="font-semibold">
                {lastCalibrated ? lastCalibrated.toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 mt-2">
            {status === 'calibrated' 
              ? 'System is fully calibrated and optimized for accurate readings.'
              : status === 'calibrating'
              ? 'Calibration in progress. Please keep finger steady on the sensor.'
              : 'System needs calibration for optimal performance.'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CalibrationCard;
