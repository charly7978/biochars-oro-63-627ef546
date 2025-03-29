import React from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronUp } from 'lucide-react';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
}

const VitalSign = ({ 
  label, 
  value, 
  unit, 
  highlighted = false
}: VitalSignProps) => {
  const getRiskLabel = (label: string, value: string | number) => {
    if (typeof value === 'number') {
      switch(label) {
        case 'FRECUENCIA CARDÍACA':
          if (value > 100) return 'Taquicardia';
          if (value < 60) return 'Bradicardia';
          return '';
        case 'SPO2':
          if (value < 95) return 'Hipoxemia';
          return '';
        case 'GLUCOSA':
          if (value > 126) return 'Hiperglucemia';
          if (value < 70) return 'Hipoglucemia';
          return '';
        default:
          return '';
      }
    }
    
    if (typeof value === 'string') {
      switch(label) {
        case 'PRESIÓN ARTERIAL':
          const pressureParts = value.split('/');
          if (pressureParts.length === 2) {
            const systolic = parseInt(pressureParts[0], 10);
            const diastolic = parseInt(pressureParts[1], 10);
            if (!isNaN(systolic) && !isNaN(diastolic)) {
              if (systolic >= 140 || diastolic >= 90) return 'Hipertensión';
              if (systolic < 90 || diastolic < 60) return 'Hipotensión';
            }
          }
          return '';
        case 'COLESTEROL':
          const cholesterol = parseInt(String(value), 10);
          if (!isNaN(cholesterol)) {
            if (cholesterol > 200) return 'Hipercolesterolemia';
          }
          return '';
        case 'TRIGLICÉRIDOS':
          const triglycerides = parseInt(String(value), 10);
          if (!isNaN(triglycerides)) {
            if (triglycerides > 150) return 'Hipertrigliceridemia';
          }
          return '';
        default:
          return '';
      }
    }
    
    return '';
  };

  const getRiskColor = (riskLabel: string) => {
    switch(riskLabel) {
      case 'Taquicardia':
      case 'Hipoxemia':
      case 'Hiperglucemia':
      case 'Hipertensión':
      case 'Hipercolesterolemia':
      case 'Hipertrigliceridemia':
        return 'text-[#ea384c]';
      case 'Bradicardia':
      case 'Hipoglucemia':
      case 'Hipotensión':
        return 'text-[#F97316]';
      default:
        return '';
    }
  };

  const getDetailedInfo = (label: string, value: string | number) => {
    let info = {
      normalRange: '',
      description: '',
      recommendations: [],
      riskFactors: []
    };

    switch(label) {
      case 'FRECUENCIA CARDÍACA':
        info.normalRange = '60-100 latidos por minuto';
        info.description = 'La frecuencia cardíaca es el número de veces que el corazón late por minuto. Refleja cómo trabaja el corazón para suministrar sangre al cuerpo.';
        info.recommendations = [
          'Mantener actividad física regular',
          'Evitar cafeína y alcohol en exceso',
          'Practicar técnicas de relajación'
        ];
        info.riskFactors = [
          'Sedentarismo',
          'Estrés crónico',
          'Tabaquismo',
          'Hipertensión'
        ];
        break;
      case 'SPO2':
        info.normalRange = '95-100%';
        info.description = 'La saturación de oxígeno mide el porcentaje de hemoglobina en la sangre que está saturada con oxígeno. Valores por debajo de 95% pueden indicar problemas respiratorios.';
        info.recommendations = [
          'Evitar exposición a grandes altitudes sin aclimatación',
          'Cesar tabaquismo',
          'Realizar ejercicios respiratorios'
        ];
        info.riskFactors = [
          'EPOC',
          'Asma',
          'Tabaquismo',
          'Enfermedades pulmonares'
        ];
        break;
      case 'PRESIÓN ARTERIAL':
        info.normalRange = '120/80 mmHg';
        info.description = 'La presión arterial mide la fuerza que ejerce la sangre contra las paredes de las arterias. El primer número (sistólica) mide la presión cuando el corazón late, y el segundo (diastólica) cuando el corazón descansa.';
        info.recommendations = [
          'Reducir consumo de sal',
          'Hacer ejercicio regularmente',
          'Mantener peso saludable',
          'Limitar consumo de alcohol'
        ];
        info.riskFactors = [
          'Obesidad',
          'Historia familiar',
          'Edad avanzada',
          'Dieta alta en sodio'
        ];
        break;
      case 'GLUCOSA':
        info.normalRange = '70-100 mg/dL en ayunas';
        info.description = 'La glucosa es el principal azúcar en la sangre y la fuente de energía del cuerpo. Niveles altos persistentes pueden indicar diabetes.';
        info.recommendations = [
          'Mantener dieta equilibrada',
          'Realizar actividad física regular',
          'Evitar azúcares refinados',
          'Monitorear los niveles regularmente'
        ];
        info.riskFactors = [
          'Sobrepeso',
          'Sedentarismo',
          'Historia familiar de diabetes',
          'Síndrome metabólico'
        ];
        break;
      case 'COLESTEROL':
        info.normalRange = 'Colesterol total: <200 mg/dL';
        info.description = 'El colesterol es una de las grasas en la sangre. Niveles elevados pueden aumentar el riesgo de enfermedad cardíaca.';
        info.recommendations = [
          'Consumir menos grasas saturadas y trans',
          'Aumentar el consumo de fibra',
          'Hacer ejercicio regularmente',
          'Limitar el consumo de alcohol'
        ];
        info.riskFactors = [
          'Obesidad',
          'Dieta alta en grasas',
          'Sedentarismo',
          'Genética'
        ];
        break;
      case 'TRIGLICÉRIDOS':
        info.normalRange = 'Triglicéridos: <150 mg/dL';
        info.description = 'Los triglicéridos son otras grasas en la sangre. Niveles elevados pueden aumentar el riesgo de enfermedad cardíaca.';
        info.recommendations = [
          'Consumir menos grasas saturadas y trans',
          'Aumentar el consumo de fibra',
          'Hacer ejercicio regularmente',
          'Limitar el consumo de alcohol'
        ];
        info.riskFactors = [
          'Obesidad',
          'Dieta alta en grasas',
          'Sedentarismo',
          'Genética'
        ];
        break;
      case 'ARRITMIAS':
        info.normalRange = 'Sin arritmias';
        info.description = 'Las arritmias son alteraciones del ritmo cardíaco normal. Pueden ser inofensivas o indicar problemas cardíacos subyacentes.';
        info.recommendations = [
          'Reducir consumo de cafeína',
          'Manejar el estrés',
          'Evitar el exceso de alcohol',
          'Consultar al médico si son frecuentes'
        ];
        info.riskFactors = [
          'Enfermedad cardíaca',
          'Hipertensión',
          'Edad avanzada',
          'Apnea del sueño'
        ];
        break;
      default:
        break;
    }
    
    return info;
  };

  const displayValue = (label: string, value: string | number) => {
    return value;
  };

  const riskLabel = getRiskLabel(label, value);
  const riskColor = getRiskColor(riskLabel);
  const detailedInfo = getDetailedInfo(label, value);
  const formattedValue = displayValue(label, value);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <div className="relative flex flex-col justify-center items-center p-2 text-center cursor-pointer transition-colors duration-200 h-full w-full bg-blue-900/5 rounded-lg">
          <div className="text-[11px] font-medium uppercase tracking-wider text-blue-100/90 mb-1">
            {label}
          </div>
          
          <div className="font-bold text-3xl sm:text-4xl transition-all duration-300">
            <span className="text-gradient-soft drop-shadow-[0_0_12px_rgba(140,180,255,0.5)] animate-subtle-pulse">
              {formattedValue}
            </span>
            {unit && <span className="text-xs text-blue-100/90 ml-1">{unit}</span>}
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <ChevronUp size={16} className="text-blue-400/60" />
          </div>
        </div>
      </SheetTrigger>
      
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-2xl font-bold flex items-center justify-between">
            <div className="flex items-center">
              {label}
              {unit && <span className="text-sm text-gray-500 ml-2">({unit})</span>}
            </div>
            <div className="flex space-x-2">
              <span className={`text-2xl px-3 py-1 rounded-full ${
                riskLabel ? riskColor.replace('text-', 'bg-').replace('[#', 'rgba(').replace(']', ', 0.1)') : 'bg-green-500/10'
              } drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]`}>
                {formattedValue}
                {unit && unit}
              </span>
            </div>
          </SheetTitle>
        </SheetHeader>
        
        <div className="py-6 overflow-y-auto max-h-full">
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Rango Normal</h3>
                <p className="text-gray-700">{detailedInfo.normalRange}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Descripción</h3>
                <p className="text-gray-700">{detailedInfo.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Estado Actual</h3>
                <div className={`text-lg font-medium ${riskLabel ? riskColor : 'text-green-500'}`}>
                  {riskLabel || 'Normal'}
                </div>
                <p className="text-gray-700 mt-2">
                  {riskLabel ? 
                    `Su lectura está ${riskLabel.includes('hiper') || riskLabel.includes('taqui') ? 'por encima' : 'por debajo'} del rango normal.` : 
                    'Su lectura está dentro del rango normal.'}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-2">Recomendaciones</h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    {detailedInfo.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-2">Factores de Riesgo</h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    {detailedInfo.riskFactors.map((factor, index) => (
                      <li key={index}>{factor}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VitalSign;
