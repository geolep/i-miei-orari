'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface Incasso {
  id: string;
  data: string;
  importo: number;
  note?: string;
  created_at: string;
}

interface IncassiChartProps {
  incassi: Incasso[];
  tipo?: 'temporale' | 'giorni';
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

export default function IncassiChart({ incassi, tipo = 'temporale' }: IncassiChartProps) {
  if (tipo === 'giorni') {
    return <GiorniChart incassi={incassi} />;
  }

  return <TemporaleChart incassi={incassi} />;
}

function TemporaleChart({ incassi }: { incassi: Incasso[] }) {
  // Raggruppa gli incassi per data e somma gli importi
  const datiPerData = incassi.reduce((acc, incasso) => {
    const data = incasso.data;
    if (!acc[data]) {
      acc[data] = { data, importo: 0 };
    }
    acc[data].importo += incasso.importo;
    return acc;
  }, {} as Record<string, { data: string; importo: number }>);

  const dati = Object.values(datiPerData)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(-30); // Ultimi 30 giorni

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={dati}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="data" 
          tickFormatter={(value) => new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
        />
        <YAxis />
        <Tooltip 
          formatter={(value: number) => [`€${value.toFixed(2)}`, 'Importo']}
          labelFormatter={(label) => new Date(label).toLocaleDateString('it-IT', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        />
        <Line 
          type="monotone" 
          dataKey="importo" 
          stroke="#8884d8" 
          strokeWidth={2}
          dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function GiorniChart({ incassi }: { incassi: Incasso[] }) {
  const giorniSettimana = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  
  // Raggruppa gli incassi per giorno della settimana
  const datiPerGiorno = incassi.reduce((acc, incasso) => {
    const giorno = new Date(incasso.data).getDay();
    // Converti da domenica=0 a lunedì=0
    const giornoLunedi = giorno === 0 ? 6 : giorno - 1;
    const nomeGiorno = giorniSettimana[giornoLunedi];
    
    if (!acc[nomeGiorno]) {
      acc[nomeGiorno] = { giorno: nomeGiorno, importo: 0, count: 0 };
    }
    acc[nomeGiorno].importo += incasso.importo;
    acc[nomeGiorno].count += 1;
    return acc;
  }, {} as Record<string, { giorno: string; importo: number; count: number }>);

  // Ordina i dati secondo l'ordine dei giorni della settimana
  const dati = giorniSettimana
    .map(nomeGiorno => datiPerGiorno[nomeGiorno] || { giorno: nomeGiorno, importo: 0, count: 0, media: 0 })
    .map(item => ({
      ...item,
      media: item.count > 0 ? item.importo / item.count : 0
    }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dati}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="giorno" />
        <YAxis />
        <Tooltip 
          formatter={(value: number, name: string) => [
            name === 'importo' ? `€${value.toFixed(2)}` : value.toFixed(2), 
            name === 'importo' ? 'Totale' : name === 'count' ? 'Numero incassi' : 'Media'
          ]}
        />
        <Bar dataKey="importo" fill="#8884d8" name="Totale" />
      </BarChart>
    </ResponsiveContainer>
  );
} 