
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Define the DataPoint interface for chart data
interface DataPoint {
  value: number;
  time: number;
}

interface SignalVisualizerCardProps {
  rawSignal: DataPoint[];
  filteredSignal: DataPoint[];
  amplifiedSignal: DataPoint[];
}

const SignalVisualizerCard: React.FC<SignalVisualizerCardProps> = ({
  rawSignal,
  filteredSignal,
  amplifiedSignal
}) => {
  // Format time for x-axis
  const formatTime = (time: number) => {
    const date = new Date(time);
    return `${date.getSeconds()}.${date.getMilliseconds().toString().padStart(3, '0')}s`;
  };
  
  return (
    <Card className="h-[400px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Signal Visualization</CardTitle>
        <CardDescription>
          Real-time visualization of signal processing stages
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[320px]">
        <Tabs defaultValue="combined">
          <TabsList className="mb-2">
            <TabsTrigger value="combined">Combined</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
            <TabsTrigger value="filtered">Filtered</TabsTrigger>
            <TabsTrigger value="amplified">Amplified</TabsTrigger>
          </TabsList>
          
          <TabsContent value="combined" className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredSignal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={formatTime} 
                  tick={{ fontSize: 10 }}
                  tickCount={4}
                />
                <YAxis domain={[-0.8, 0.8]} tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(value: number) => [value.toFixed(4), 'Value']}
                  labelFormatter={formatTime}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  data={rawSignal}
                  dataKey="value"
                  name="Raw" 
                  stroke="#8884d8" 
                  dot={false} 
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  name="Filtered" 
                  stroke="#82ca9d" 
                  dot={false} 
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  data={amplifiedSignal}
                  dataKey="value" 
                  name="Amplified" 
                  stroke="#ff7300" 
                  dot={false} 
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          
          <TabsContent value="raw" className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rawSignal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={formatTime} 
                  tick={{ fontSize: 10 }}
                />
                <YAxis domain={[-0.8, 0.8]} tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(value: number) => [value.toFixed(4), 'Value']}
                  labelFormatter={formatTime}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8884d8" 
                  dot={false} 
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          
          <TabsContent value="filtered" className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredSignal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={formatTime} 
                  tick={{ fontSize: 10 }}
                />
                <YAxis domain={[-0.8, 0.8]} tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(value: number) => [value.toFixed(4), 'Value']}
                  labelFormatter={formatTime}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#82ca9d" 
                  dot={false} 
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          
          <TabsContent value="amplified" className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={amplifiedSignal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={formatTime} 
                  tick={{ fontSize: 10 }}
                />
                <YAxis domain={[-0.8, 0.8]} tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(value: number) => [value.toFixed(4), 'Value']}
                  labelFormatter={formatTime}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#ff7300" 
                  dot={false} 
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SignalVisualizerCard;
