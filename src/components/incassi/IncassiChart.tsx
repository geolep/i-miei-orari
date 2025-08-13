'use client';

import { useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface Incasso {
  id: string;
  data: string;
  importo: number;
  note?: string;
  created_at: string;
}

interface IncassiChartProps {
  incassi: Incasso[];
  periodoCorrente?: {
    inizio: Date;
    fine: Date;
  };
}

type ZoomLevel = 'giorni' | 'settimane' | 'mesi' | 'trimestri';

export default function IncassiChart({ incassi, periodoCorrente }: IncassiChartProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('settimane');
  const [currentPeriod, setCurrentPeriod] = useState(() => {
    if (periodoCorrente) {
      return {
        inizio: new Date(periodoCorrente.inizio),
        fine: new Date(periodoCorrente.fine)
      };
    }
    // Default: settimana corrente (lunedì-domenica)
    const oggi = new Date();
    const giornoSettimana = oggi.getDay();
    const giorniDalLunedi = giornoSettimana === 0 ? 6 : giornoSettimana - 1;
    const fine = new Date(oggi);
    const inizio = new Date(oggi);
    inizio.setDate(fine.getDate() - giorniDalLunedi);
    fine.setDate(inizio.getDate() + 6);
    return { inizio, fine };
  });

  const getPeriodDuration = useCallback((level: ZoomLevel) => {
    switch (level) {
      case 'giorni': return 7; // 7 giorni
      case 'settimane': return 7; // 1 settimana
      case 'mesi': return 90; // 3 mesi
      case 'trimestri': return 365; // 1 anno
      default: return 30;
    }
  }, []);

  const navigatePeriod = useCallback((direction: 'forward' | 'backward') => {
    setCurrentPeriod(prev => {
      const newInizio = new Date(prev.inizio);
      const newFine = new Date(prev.fine);
      
      switch (zoomLevel) {
        case 'giorni':
          // Naviga di un giorno alla volta
          if (direction === 'forward') {
            newInizio.setDate(newInizio.getDate() + 1);
            newFine.setDate(newFine.getDate() + 1);
          } else {
            newInizio.setDate(newInizio.getDate() - 1);
            newFine.setDate(newFine.getDate() - 1);
          }
          break;
          
        case 'settimane':
          // Naviga di settimana in settimana, sempre partendo dal lunedì
          if (direction === 'forward') {
            newInizio.setDate(newInizio.getDate() + 7);
            newFine.setDate(newFine.getDate() + 7);
          } else {
            newInizio.setDate(newInizio.getDate() - 7);
            newFine.setDate(newFine.getDate() - 7);
          }
          break;
          
        case 'mesi':
          // Naviga di un mese alla volta, mantenendo 3 mesi di visualizzazione
          if (direction === 'forward') {
            newInizio.setMonth(newInizio.getMonth() + 1);
            newFine.setMonth(newFine.getMonth() + 1);
          } else {
            newInizio.setMonth(newInizio.getMonth() - 1);
            newFine.setMonth(newFine.getMonth() - 1);
          }
          break;
          
        case 'trimestri':
          // Naviga di un anno alla volta
          if (direction === 'forward') {
            newInizio.setFullYear(newInizio.getFullYear() + 1);
            newFine.setFullYear(newFine.getFullYear() + 1);
          } else {
            newInizio.setFullYear(newInizio.getFullYear() - 1);
            newFine.setFullYear(newFine.getFullYear() - 1);
          }
          break;
      }
      
      return { inizio: newInizio, fine: newFine };
    });
  }, [zoomLevel]);

  const changeZoomLevel = useCallback((newLevel: ZoomLevel) => {
    setZoomLevel(newLevel);
    
    // Ricalcola il periodo corrente in base al nuovo livello
    const oggi = new Date();
    let inizio: Date;
    let fine: Date;
    
    switch (newLevel) {
      case 'giorni':
        // Ultimi 7 giorni
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setDate(fine.getDate() - 6);
        break;
        
      case 'settimane':
        // Settimana corrente (lunedì-domenica)
        const giornoSettimana = oggi.getDay();
        const giorniDalLunedi = giornoSettimana === 0 ? 6 : giornoSettimana - 1;
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setDate(fine.getDate() - giorniDalLunedi);
        fine.setDate(inizio.getDate() + 6);
        break;
        
      case 'mesi':
        // Ultimi 3 mesi
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setMonth(fine.getMonth() - 2);
        inizio.setDate(1);
        break;
        
      case 'trimestri':
        // Ultimo anno
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setFullYear(fine.getFullYear() - 1);
        break;
        
      default:
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setDate(fine.getDate() - 30);
    }
    
    setCurrentPeriod({ inizio, fine });
  }, []);

  const resetToToday = useCallback(() => {
    const oggi = new Date();
    let inizio: Date;
    let fine: Date;
    
    switch (zoomLevel) {
      case 'giorni':
        // Ultimi 7 giorni
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setDate(fine.getDate() - 6);
        break;
        
      case 'settimane':
        // Settimana corrente (lunedì-domenica)
        const giornoSettimana = oggi.getDay();
        const giorniDalLunedi = giornoSettimana === 0 ? 6 : giornoSettimana - 1;
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setDate(fine.getDate() - giorniDalLunedi);
        fine.setDate(inizio.getDate() + 6);
        break;
        
      case 'mesi':
        // Ultimi 3 mesi
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setMonth(fine.getMonth() - 2);
        inizio.setDate(1);
        break;
        
      case 'trimestri':
        // Ultimo anno
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setFullYear(fine.getFullYear() - 1);
        break;
        
      default:
        fine = new Date(oggi);
        inizio = new Date(oggi);
        inizio.setDate(fine.getDate() - 30);
    }
    
    setCurrentPeriod({ inizio, fine });
  }, [zoomLevel]);

  // Calcola il periodo precedente per il confronto
  const durataPeriodo = currentPeriod.fine.getTime() - currentPeriod.inizio.getTime();
  const inizioPeriodoPrecedente = new Date(currentPeriod.inizio.getTime() - durataPeriodo);
  const finePeriodoPrecedente = new Date(currentPeriod.inizio.getTime() - 1);

  // Filtra gli incassi per i periodi
  const incassiPeriodoCorrente = incassi.filter(incasso => {
    const dataIncasso = new Date(incasso.data);
    // Normalizza le date per il confronto (rimuovi l'ora)
    const dataIncassoNormalizzata = new Date(dataIncasso.getFullYear(), dataIncasso.getMonth(), dataIncasso.getDate());
    const inizioNormalizzato = new Date(currentPeriod.inizio.getFullYear(), currentPeriod.inizio.getMonth(), currentPeriod.inizio.getDate());
    const fineNormalizzato = new Date(currentPeriod.fine.getFullYear(), currentPeriod.fine.getMonth(), currentPeriod.fine.getDate());
    
    return dataIncassoNormalizzata >= inizioNormalizzato && dataIncassoNormalizzata <= fineNormalizzato;
  });

  const incassiPeriodoPrecedente = incassi.filter(incasso => {
    const dataIncasso = new Date(incasso.data);
    // Normalizza le date per il confronto (rimuovi l'ora)
    const dataIncassoNormalizzata = new Date(dataIncasso.getFullYear(), dataIncasso.getMonth(), dataIncasso.getDate());
    const inizioPrecedenteNormalizzato = new Date(inizioPeriodoPrecedente.getFullYear(), inizioPeriodoPrecedente.getMonth(), inizioPeriodoPrecedente.getDate());
    const finePrecedenteNormalizzato = new Date(finePeriodoPrecedente.getFullYear(), finePeriodoPrecedente.getMonth(), finePeriodoPrecedente.getDate());
    
    return dataIncassoNormalizzata >= inizioPrecedenteNormalizzato && dataIncassoNormalizzata <= finePrecedenteNormalizzato;
  });

  // Raggruppa gli incassi per data
  const raggruppaPerData = (incassi: Incasso[]) => {
    return incassi.reduce((acc, incasso) => {
      const data = incasso.data;
      if (!acc[data]) {
        acc[data] = { data, importo: 0 };
      }
      acc[data].importo += incasso.importo;
      return acc;
    }, {} as Record<string, { data: string; importo: number }>);
  };

  const datiPeriodoCorrente = raggruppaPerData(incassiPeriodoCorrente);
  const datiPeriodoPrecedente = raggruppaPerData(incassiPeriodoPrecedente);

  // Debug: verifica i dati filtrati
  console.log('Periodo corrente:', {
    inizio: currentPeriod.inizio.toISOString().split('T')[0],
    fine: currentPeriod.fine.toISOString().split('T')[0],
    incassiFiltrati: incassiPeriodoCorrente.length,
    datiRaggruppati: Object.keys(datiPeriodoCorrente)
  });

  // Crea array di date per il periodo corrente
  const datePeriodoCorrente: string[] = [];
  const dataCorrente = new Date(currentPeriod.inizio);
  while (dataCorrente <= currentPeriod.fine) {
    datePeriodoCorrente.push(dataCorrente.toISOString().split('T')[0]);
    dataCorrente.setDate(dataCorrente.getDate() + 1);
  }

  // Crea array di date per il periodo precedente
  const datePeriodoPrecedente: string[] = [];
  const dataPrecedente = new Date(inizioPeriodoPrecedente);
  while (dataPrecedente <= finePeriodoPrecedente) {
    datePeriodoPrecedente.push(dataPrecedente.toISOString().split('T')[0]);
    dataPrecedente.setDate(dataPrecedente.getDate() + 1);
  }

  // Prepara i dati per il grafico
  const datiGrafico = datePeriodoCorrente.map((data, index) => {
    const dataPrecedente = datePeriodoPrecedente[index];
    const importoCorrente = datiPeriodoCorrente[data]?.importo || 0;
    const importoPrecedente = datiPeriodoPrecedente[dataPrecedente]?.importo || 0;
    
    // Debug per il primo giorno
    if (index === 0) {
      console.log('Primo giorno del grafico:', {
        data,
        importoCorrente,
        importoPrecedente,
        datiDisponibili: Object.keys(datiPeriodoCorrente),
        valoreTrovato: datiPeriodoCorrente[data]
      });
    }
    
    // Formatta la data in base al livello di zoom
    let giorno = '';
    switch (zoomLevel) {
      case 'giorni':
        giorno = new Date(data).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });
        break;
      case 'settimane':
        giorno = new Date(data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        break;
      case 'mesi':
        giorno = new Date(data).toLocaleDateString('it-IT', { month: 'short', day: '2-digit' });
        break;
      case 'trimestri':
        giorno = new Date(data).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
        break;
    }
    
    return {
      data,
      importoCorrente,
      importoPrecedente,
      giorno
    };
  });

  const formatPeriodLabel = () => {
    const inizio = currentPeriod.inizio.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: '2-digit',
      year: zoomLevel === 'trimestri' ? 'numeric' : undefined
    });
    const fine = currentPeriod.fine.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    return `${inizio} - ${fine}`;
  };

  return (
    <div className="space-y-4">
      {/* Controlli di navigazione e zoom */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigatePeriod('backward')}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Indietro
          </Button>
          
          <div className="text-center min-w-[200px]">
            <div className="text-sm font-medium">{formatPeriodLabel()}</div>
            <div className="text-xs text-muted-foreground capitalize">{zoomLevel}</div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigatePeriod('forward')}
            className="flex items-center gap-1"
          >
            Avanti
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => changeZoomLevel('giorni')}
            className={zoomLevel === 'giorni' ? 'bg-primary text-primary-foreground' : ''}
          >
            Giorni
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => changeZoomLevel('settimane')}
            className={zoomLevel === 'settimane' ? 'bg-primary text-primary-foreground' : ''}
          >
            Settimane
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => changeZoomLevel('mesi')}
            className={zoomLevel === 'mesi' ? 'bg-primary text-primary-foreground' : ''}
          >
            Mesi
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => changeZoomLevel('trimestri')}
            className={zoomLevel === 'trimestri' ? 'bg-primary text-primary-foreground' : ''}
          >
            Anni
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={resetToToday}
            className="flex items-center gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            Oggi
          </Button>
        </div>
      </div>

      {/* Grafico */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={datiGrafico}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="giorno" 
            angle={zoomLevel === 'giorni' ? -45 : 0}
            textAnchor={zoomLevel === 'giorni' ? 'end' : 'middle'}
            height={zoomLevel === 'giorni' ? 80 : 60}
          />
          <YAxis />
          <Tooltip 
            formatter={(value: number, name: string) => [
              `€${value.toFixed(2)}`, 
              name
            ]}
            labelFormatter={(label) => {
              // Il label è il valore formattato del giorno, dobbiamo trovare la data originale
              const dataOriginale = datiGrafico.find(d => d.giorno === label)?.data;
              if (!dataOriginale) return label;
              
              const data = new Date(dataOriginale);
              const dataFormattata = data.toLocaleDateString('it-IT', { 
                day: '2-digit', 
                month: '2-digit',
                year: 'numeric'
              });
              
              // Trova l'indice della data corrente per calcolare la data del periodo precedente
              const index = datePeriodoCorrente.indexOf(dataOriginale);
              if (index !== -1 && index < datePeriodoPrecedente.length) {
                const dataPrecedente = new Date(datePeriodoPrecedente[index]);
                const dataPrecedenteFormattata = dataPrecedente.toLocaleDateString('it-IT', { 
                  day: '2-digit', 
                  month: '2-digit',
                  year: 'numeric'
                });
                return `${dataFormattata} (Periodo Precedente: ${dataPrecedenteFormattata})`;
              }
              
              return dataFormattata;
            }}
          />
          <Line 
            type="monotone" 
            dataKey="importoCorrente" 
            stroke="#8884d8" 
            strokeWidth={2}
            dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
            name="Periodo Corrente"
          />
          <Line 
            type="monotone" 
            dataKey="importoPrecedente" 
            stroke="#82CA9D" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#82CA9D', strokeWidth: 2, r: 4 }}
            name="Periodo Precedente"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 