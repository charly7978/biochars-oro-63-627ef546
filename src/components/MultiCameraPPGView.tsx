/**
 * MultiCameraPPGView
 * React component for experimental multicamera PPG capture
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { CameraIcon, ZapIcon, BarChart2Icon, RefreshCwIcon, PowerIcon } from "lucide-react";

import { 
  MultiCameraPPGProcessor, 
  multiCameraPPGProcessor,
  CameraDevice,
  PPGSignalSource,
  MultiCameraPPGResult
} from '../modules/camera/MultiCameraPPGProcessor';
import { VitalSignsProcessor } from '../modules/vital-signs/VitalSignsProcessor';

const MultiCameraPPGView: React.FC = () => {
  // Camera and processing state
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [activeCameras, setActiveCameras] = useState<Map<string, PPGSignalSource>>(new Map());
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [currentPPGValue, setCurrentPPGValue] = useState<number>(0);
  const [signalBuffer, setSignalBuffer] = useState<{value: number, time: number}[]>([]);
  const [signalQuality, setSignalQuality] = useState<number>(0);
  
  // Settings state
  const [useTensorFlow, setUseTensorFlow] = useState<boolean>(true);
  const [useEnhancement, setUseEnhancement] = useState<boolean>(true);
  const [useFusion, setUseFusion] = useState<boolean>(true);
  const [maxCameras, setMaxCameras] = useState<number>(2);
  
  // Vital signs processing
  const [vitalSignsProcessor] = useState<VitalSignsProcessor>(() => new VitalSignsProcessor());
  const [spo2, setSpo2] = useState<number>(0);
  const [bloodPressure, setBloodPressure] = useState<string>("--/--");
  const [heartRate, setHeartRate] = useState<number>(0);
  
  // Video preview refs
  const videoRefs = useRef<{[key: string]: HTMLVideoElement | null}>({});
  
  // Animation frame ref for continuous processing
  const animationFrameRef = useRef<number | null>(null);
  
  // Initialize and discover cameras
  useEffect(() => {
    async function init() {
      try {
        // Discover available cameras
        const cameras = await multiCameraPPGProcessor.discoverCameras();
        setAvailableCameras(cameras);
        
        // Set configuration
        multiCameraPPGProcessor.setConfig({
          maxCameras,
          useTensorFlow,
          useFusion,
          enhanceSignal: useEnhancement
        });
        
        toast.success(`Detected ${cameras.length} cameras`);
      } catch (error) {
        console.error("Error initializing camera system:", error);
        toast.error("Failed to initialize camera system");
      }
    }
    
    init();
    
    // Cleanup
    return () => {
      stopCapture();
      multiCameraPPGProcessor.dispose();
    };
  }, []);
  
  // Update processor config when settings change
  useEffect(() => {
    multiCameraPPGProcessor.setConfig({
      maxCameras,
      useTensorFlow,
      useFusion,
      enhanceSignal: useEnhancement
    });
  }, [maxCameras, useTensorFlow, useFusion, useEnhancement]);
  
  // Start capturing from cameras
  const startCapture = async () => {
    try {
      // Start capture with default camera selection
      const sources = await multiCameraPPGProcessor.startCapture();
      setActiveCameras(new Map(sources));
      setIsCapturing(true);
      
      // Setup video elements for each source
      for (const [deviceId, source] of sources.entries()) {
        if (source.stream && videoRefs.current[deviceId]) {
          videoRefs.current[deviceId]!.srcObject = source.stream;
          videoRefs.current[deviceId]!.play().catch(e => console.error("Error playing video:", e));
        }
      }
      
      // Start continuous processing
      startContinuousProcessing();
      
      toast.success("Camera capture started");
    } catch (error) {
      console.error("Error starting capture:", error);
      toast.error("Failed to start camera capture");
    }
  };
  
  // Stop capturing
  const stopCapture = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    multiCameraPPGProcessor.stopCapture();
    setActiveCameras(new Map());
    setIsCapturing(false);
    
    // Reset video elements
    for (const videoRef of Object.values(videoRefs.current)) {
      if (videoRef && videoRef.srcObject) {
        const stream = videoRef.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.srcObject = null;
      }
    }
    
    toast.info("Camera capture stopped");
  };
  
  // Process PPG signal continuously
  const startContinuousProcessing = () => {
    const processFrame = () => {
      if (!isCapturing) return;
      
      try {
        // Get current PPG value from processor
        const result = multiCameraPPGProcessor.getCurrentValue();
        
        // Update state with current value
        setCurrentPPGValue(result.combinedValue);
        setSignalQuality(result.confidenceScore * 100);
        
        // Add to signal buffer for visualization
        const newPoint = { value: result.combinedValue, time: Date.now() };
        setSignalBuffer(prev => {
          const newBuffer = [...prev, newPoint];
          // Keep last 100 points
          if (newBuffer.length > 100) {
            return newBuffer.slice(-100);
          }
          return newBuffer;
        });
        
        // Process vital signs with VitalSignsProcessor
        processVitalSigns(result);
      } catch (error) {
        console.error("Error in continuous processing:", error);
      }
      
      // Continue processing
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };
    
    // Start processing loop
    animationFrameRef.current = requestAnimationFrame(processFrame);
  };
  
  // Process vital signs from PPG value
  const processVitalSigns = (ppgResult: MultiCameraPPGResult) => {
    try {
      // Generate dummy RR intervals data (this would come from actual heart rate processing)
      const rrData = {
        intervals: [1000, 1020, 980],
        lastPeakTime: Date.now()
      };
      
      // Process with VitalSignsProcessor
      const vitals = vitalSignsProcessor.process(ppgResult.combinedValue, rrData);
      
      // Update state with vital signs
      setSpo2(vitals.spo2);
      setBloodPressure(vitals.pressure);
      
      // Calculate heart rate from RR intervals (simplified)
      if (rrData.intervals.length > 0) {
        const avgRR = rrData.intervals.reduce((a, b) => a + b, 0) / rrData.intervals.length;
        setHeartRate(Math.round(60000 / avgRR));
      }
    } catch (error) {
      console.error("Error processing vital signs:", error);
    }
  };
  
  // Format chart data
  const chartData = signalBuffer.map((point, index) => ({
    index,
    ppg: point.value
  }));
  
  return (
    <div className="flex flex-col w-full h-full">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CameraIcon className="h-5 w-5" /> 
            Experimental Multicamera PPG
          </CardTitle>
          <CardDescription>
            Using multiple cameras with TensorFlow enhancement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Signal visualization */}
            <div className="bg-gray-900 rounded-lg p-2 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="index" hide />
                  <YAxis domain={[0, 1]} hide />
                  <Tooltip 
                    formatter={(value) => [Number(value).toFixed(3), 'PPG']}
                    labelFormatter={() => ''}
                  />
                  <ReferenceLine y={0.5} stroke="#666" strokeDasharray="3 3" />
                  <Line 
                    type="monotone" 
                    dataKey="ppg" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Vital signs display */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-900 rounded-lg p-3 flex flex-col items-center justify-center">
                <div className="text-sm text-gray-400">SpO2</div>
                <div className="text-2xl font-bold text-white">{spo2}%</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 flex flex-col items-center justify-center">
                <div className="text-sm text-gray-400">Blood Pressure</div>
                <div className="text-2xl font-bold text-white">{bloodPressure}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 flex flex-col items-center justify-center">
                <div className="text-sm text-gray-400">Heart Rate</div>
                <div className="text-2xl font-bold text-white">{heartRate}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 flex flex-col items-center justify-center col-span-3">
                <div className="text-sm text-gray-400">Signal Quality</div>
                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                  <div 
                    className="bg-green-500 h-2.5 rounded-full" 
                    style={{ width: `${signalQuality}%` }}
                  ></div>
                </div>
                <div className="text-right w-full text-xs text-gray-400 mt-1">
                  {signalQuality.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
          
          {/* Camera previews */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Array.from(activeCameras.entries()).map(([deviceId, source]) => (
              <div key={deviceId} className="relative rounded-lg overflow-hidden bg-black h-[150px]">
                <video
                  ref={el => { videoRefs.current[deviceId] = el; }}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                  <Badge variant={source.quality > 70 ? "success" : source.quality > 40 ? "warning" : "destructive"}>
                    {source.quality.toFixed(0)}%
                  </Badge>
                  <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">
                    {availableCameras.find(cam => cam.deviceId === deviceId)?.facing === 'user' ? 'Front' : 'Back'}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Empty placeholders for inactive cameras */}
            {Array.from({ length: Math.max(0, 2 - activeCameras.size) }).map((_, i) => (
              <div key={`empty-${i}`} className="rounded-lg bg-gray-900 h-[150px] flex items-center justify-center">
                <span className="text-gray-500">No Camera Active</span>
              </div>
            ))}
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="tensorflow"
                checked={useTensorFlow}
                onCheckedChange={setUseTensorFlow}
              />
              <Label htmlFor="tensorflow" className="flex items-center gap-1">
                <ZapIcon className="h-4 w-4" /> TensorFlow
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="enhancement"
                checked={useEnhancement}
                onCheckedChange={setUseEnhancement}
              />
              <Label htmlFor="enhancement" className="flex items-center gap-1">
                <BarChart2Icon className="h-4 w-4" /> Signal Enhancement
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="fusion"
                checked={useFusion}
                onCheckedChange={setUseFusion}
              />
              <Label htmlFor="fusion" className="flex items-center gap-1">
                <RefreshCwIcon className="h-4 w-4" /> Signal Fusion
              </Label>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex-1 max-w-xs">
            <Label className="mb-2 block">Max Cameras: {maxCameras}</Label>
            <Slider
              min={1}
              max={4}
              step={1}
              value={[maxCameras]}
              onValueChange={(values) => setMaxCameras(values[0])}
            />
          </div>
          <Button
            variant={isCapturing ? "destructive" : "default"}
            onClick={isCapturing ? stopCapture : startCapture}
            className="ml-4"
          >
            <PowerIcon className="h-4 w-4 mr-2" />
            {isCapturing ? "Stop Capture" : "Start Capture"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default MultiCameraPPGView;
