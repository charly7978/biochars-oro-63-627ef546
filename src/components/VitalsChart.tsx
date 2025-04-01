
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ChartDataPoint {
  timestamp: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
}

interface VitalsChartProps {
  data: ChartDataPoint[];
  dataKey: string;
  secondaryDataKey?: string;
  title: string;
  label: string;
  color: string;
  secondaryColor?: string;
}

const VitalsChart: React.FC<VitalsChartProps> = ({
  data,
  dataKey,
  secondaryDataKey,
  title,
  label,
  color,
  secondaryColor
}) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg h-64">
        <p className="text-muted-foreground">No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium mb-4">{title}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                return value.toString().substring(0, 5);
              }}
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              label={{ 
                value: label, 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fontSize: 12 }
              }} 
            />
            <Tooltip 
              formatter={(value) => [`${value} ${label}`, '']}
              labelFormatter={(label) => `Tiempo: ${label}`} 
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              activeDot={{ r: 8 }}
              strokeWidth={2}
              name={secondaryDataKey ? "Sistólica" : dataKey}
              dot={{ strokeWidth: 2, r: 4 }}
            />
            {secondaryDataKey && (
              <Line
                type="monotone"
                dataKey={secondaryDataKey}
                stroke={secondaryColor || "#82ca9d"}
                activeDot={{ r: 8 }}
                strokeWidth={2}
                name="Diastólica"
                dot={{ strokeWidth: 2, r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default VitalsChart;
