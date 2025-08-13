'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, TrendingUp, TrendingDown, Euro, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import IncassiChart from '@/components/incassi/IncassiChart';
import IncassiTable from '@/components/incassi/IncassiTable';
import IncassiForm from '@/components/incassi/IncassiForm';

interface Incasso {
  id: string;
  data: string;
  importo: number;
  note?: string;
  created_at: string;
}

interface Statistiche {
  totaleSettimana: number;
  mediaGiornaliera: number;
  confrontoSettimanaPrecedente: number;
  trendSettimanale: number;
  giorniConIncassi: number;
}

interface Settimana {
  inizio: Date;
  fine: Date;
}

interface RangeDate {
  inizio: string;
  fine: string;
}

export default function IncassiPage() {
  const [incassi, setIncassi] = useState<Incasso[]>([]);
  const [statistiche, setStatistiche] = useState<Statistiche>({
    totaleSettimana: 0,
    mediaGiornaliera: 0,
    confrontoSettimanaPrecedente: 0,
    trendSettimanale: 0,
    giorniConIncassi: 0
  });
  const [settimanaCorrente, setSettimanaCorrente] = useState<Settimana>(() => {
    const oggi = new Date();
    const inizioSettimana = new Date(oggi);
    // Calcola il lunedì della settimana corrente
    const giornoSettimana = oggi.getDay(); // 0 = domenica, 1 = lunedì, ..., 6 = sabato
    const giorniDaLunedi = giornoSettimana === 0 ? 6 : giornoSettimana - 1; // Se è domenica, vai a lunedì precedente
    inizioSettimana.setDate(oggi.getDate() - giorniDaLunedi);
    inizioSettimana.setHours(0, 0, 0, 0);
    
    const fineSettimana = new Date(inizioSettimana);
    fineSettimana.setDate(inizioSettimana.getDate() + 6); // Domenica
    fineSettimana.setHours(23, 59, 59, 999);
    
    return { inizio: inizioSettimana, fine: fineSettimana };
  });
  const [rangePersonalizzato, setRangePersonalizzato] = useState<RangeDate>({
    inizio: '',
    fine: ''
  });
  const [modalitaVisualizzazione, setModalitaVisualizzazione] = useState<'settimana' | 'personalizzato'>('settimana');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchIncassi = async () => {
    try {
      const { data, error } = await supabase
        .from('incassi')
        .select('*')
        .order('data', { ascending: false });

      if (error) throw error;
      setIncassi(data || []);
      calcolaStatistiche(data || []);
    } catch (error) {
      console.error('Errore nel caricamento degli incassi:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRangeCorrente = () => {
    if (modalitaVisualizzazione === 'personalizzato' && rangePersonalizzato.inizio && rangePersonalizzato.fine) {
      return {
        inizio: new Date(rangePersonalizzato.inizio),
        fine: new Date(rangePersonalizzato.fine)
      };
    }
    return settimanaCorrente;
  };

  const calcolaStatistiche = (dati: Incasso[]) => {
    const rangeCorrente = getRangeCorrente();
    
    // Filtra gli incassi per il range corrente
    const incassiRange = dati.filter(incasso => {
      const dataIncasso = new Date(incasso.data);
      return dataIncasso >= rangeCorrente.inizio && dataIncasso <= rangeCorrente.fine;
    });

    // Calcola il periodo precedente (stessa durata del range corrente)
    const durataRange = rangeCorrente.fine.getTime() - rangeCorrente.inizio.getTime();
    const inizioPeriodoPrecedente = new Date(rangeCorrente.inizio.getTime() - durataRange);
    const finePeriodoPrecedente = new Date(rangeCorrente.inizio.getTime() - 1);

    const incassiPeriodoPrecedente = dati.filter(incasso => {
      const dataIncasso = new Date(incasso.data);
      return dataIncasso >= inizioPeriodoPrecedente && dataIncasso <= finePeriodoPrecedente;
    });

    const totaleRange = incassiRange.reduce((sum: number, incasso: Incasso) => sum + incasso.importo, 0);
    const totalePeriodoPrecedente = incassiPeriodoPrecedente.reduce((sum: number, incasso: Incasso) => sum + incasso.importo, 0);
    const mediaGiornaliera = incassiRange.length > 0 ? totaleRange / incassiRange.length : 0;
    const confrontoSettimanaPrecedente = totalePeriodoPrecedente > 0 ? 
      ((totaleRange - totalePeriodoPrecedente) / totalePeriodoPrecedente) * 100 : 0;

    // Calcolo trend settimanale (periodo corrente vs periodo precedente di stessa durata)
    const inizioPeriodoPrecedenteTrend = new Date(rangeCorrente.inizio.getTime() - durataRange);
    const finePeriodoPrecedenteTrend = new Date(rangeCorrente.inizio.getTime() - 1);

    const incassiPeriodoCorrenteTrend = dati.filter(incasso => {
      const dataIncasso = new Date(incasso.data);
      return dataIncasso >= rangeCorrente.inizio && dataIncasso <= rangeCorrente.fine;
    });
    const incassiPeriodoPrecedenteTrend = dati.filter(incasso => {
      const dataIncasso = new Date(incasso.data);
      return dataIncasso >= inizioPeriodoPrecedenteTrend && dataIncasso <= finePeriodoPrecedenteTrend;
    });

    const totalePeriodoCorrenteTrend = incassiPeriodoCorrenteTrend.reduce((sum: number, incasso: Incasso) => sum + incasso.importo, 0);
    const totalePeriodoPrecedenteTrend = incassiPeriodoPrecedenteTrend.reduce((sum: number, incasso: Incasso) => sum + incasso.importo, 0);
    const trendSettimanale = totalePeriodoPrecedenteTrend > 0 ? 
      ((totalePeriodoCorrenteTrend - totalePeriodoPrecedenteTrend) / totalePeriodoPrecedenteTrend) * 100 : 0;

    // Conta i giorni con incassi nel range corrente
    const giorniConIncassi = new Set(incassiRange.map(incasso => incasso.data)).size;

    setStatistiche({
      totaleSettimana: totaleRange,
      mediaGiornaliera,
      confrontoSettimanaPrecedente,
      trendSettimanale,
      giorniConIncassi
    });
  };

  useEffect(() => {
    fetchIncassi();
  }, [settimanaCorrente, modalitaVisualizzazione, rangePersonalizzato]);

  const handleIncassoAdded = () => {
    setIsFormOpen(false);
    fetchIncassi();
  };

  const handleIncassoDeleted = () => {
    fetchIncassi();
  };

  const vaiSettimanaPrecedente = () => {
    const nuovaInizio = new Date(settimanaCorrente.inizio);
    nuovaInizio.setDate(settimanaCorrente.inizio.getDate() - 7);
    const nuovaFine = new Date(settimanaCorrente.fine);
    nuovaFine.setDate(settimanaCorrente.fine.getDate() - 7);
    setSettimanaCorrente({ inizio: nuovaInizio, fine: nuovaFine });
  };

  const vaiSettimanaSuccessiva = () => {
    const nuovaInizio = new Date(settimanaCorrente.inizio);
    nuovaInizio.setDate(settimanaCorrente.inizio.getDate() + 7);
    const nuovaFine = new Date(settimanaCorrente.fine);
    nuovaFine.setDate(settimanaCorrente.fine.getDate() + 7);
    setSettimanaCorrente({ inizio: nuovaInizio, fine: nuovaFine });
  };

  const vaiOggi = () => {
    const oggi = new Date();
    const inizioSettimana = new Date(oggi);
    // Calcola il lunedì della settimana corrente
    const giornoSettimana = oggi.getDay(); // 0 = domenica, 1 = lunedì, ..., 6 = sabato
    const giorniDaLunedi = giornoSettimana === 0 ? 6 : giornoSettimana - 1; // Se è domenica, vai a lunedì precedente
    inizioSettimana.setDate(oggi.getDate() - giorniDaLunedi);
    inizioSettimana.setHours(0, 0, 0, 0);
    
    const fineSettimana = new Date(inizioSettimana);
    fineSettimana.setDate(inizioSettimana.getDate() + 6); // Domenica
    fineSettimana.setHours(23, 59, 59, 999);
    
    setSettimanaCorrente({ inizio: inizioSettimana, fine: fineSettimana });
  };

  const formattaSettimana = (settimana: Settimana) => {
    const inizio = settimana.inizio.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const fine = settimana.fine.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${inizio} - ${fine}`;
  };

  const formattaRangePersonalizzato = () => {
    if (!rangePersonalizzato.inizio || !rangePersonalizzato.fine) return '';
    const inizio = new Date(rangePersonalizzato.inizio).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const fine = new Date(rangePersonalizzato.fine).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${inizio} - ${fine}`;
  };

  const applicaRangePersonalizzato = () => {
    if (rangePersonalizzato.inizio && rangePersonalizzato.fine) {
      setModalitaVisualizzazione('personalizzato');
    }
  };

  const resetRangePersonalizzato = () => {
    setRangePersonalizzato({ inizio: '', fine: '' });
    setModalitaVisualizzazione('settimana');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard Incassi</h1>
        <Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuovo Incasso
        </Button>
      </div>

      {/* Grafici */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Trend Temporale</CardTitle>
            <CardDescription>Andamento degli incassi nel tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <IncassiChart 
              incassi={incassi} 
              periodoCorrente={getRangeCorrente()}
            />
          </CardContent>
        </Card>
      </div>

      {/* Selettore Periodo */}
      <Card>
        <CardContent className="pt-6">
          {/* Toggle Modalità */}
          <div className="flex justify-center mb-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <Button
                variant={modalitaVisualizzazione === 'settimana' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setModalitaVisualizzazione('settimana')}
                className="text-xs"
              >
                Settimana
              </Button>
              <Button
                variant={modalitaVisualizzazione === 'personalizzato' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setModalitaVisualizzazione('personalizzato')}
                className="text-xs"
              >
                Range Personalizzato
              </Button>
            </div>
          </div>

          {modalitaVisualizzazione === 'settimana' ? (
            /* Selettore Settimana */
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={vaiSettimanaPrecedente}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Precedente
              </Button>
              
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {formattaSettimana(settimanaCorrente)}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={vaiOggi}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Vai a oggi
                </Button>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={vaiSettimanaSuccessiva}
                className="flex items-center gap-1"
              >
                Successiva
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            /* Selettore Range Personalizzato */
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="data-inizio" className="text-sm font-medium">Da:</Label>
                  <Input
                    id="data-inizio"
                    type="date"
                    value={rangePersonalizzato.inizio}
                    onChange={(e) => setRangePersonalizzato(prev => ({ ...prev, inizio: e.target.value }))}
                    className="w-40"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Label htmlFor="data-fine" className="text-sm font-medium">A:</Label>
                  <Input
                    id="data-fine"
                    type="date"
                    value={rangePersonalizzato.fine}
                    onChange={(e) => setRangePersonalizzato(prev => ({ ...prev, fine: e.target.value }))}
                    className="w-40"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={applicaRangePersonalizzato}
                  disabled={!rangePersonalizzato.inizio || !rangePersonalizzato.fine}
                  className="flex items-center gap-1"
                >
                  <Calendar className="h-4 w-4" />
                  Applica Range
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetRangePersonalizzato}
                  className="flex items-center gap-1"
                >
                  Reset
                </Button>
              </div>
              
              {modalitaVisualizzazione === 'personalizzato' && rangePersonalizzato.inizio && rangePersonalizzato.fine && (
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {formattaRangePersonalizzato()}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistiche Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {modalitaVisualizzazione === 'settimana' ? 'Incasso Totale Settimana' : 'Incasso Totale Periodo'}
            </CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{statistiche.totaleSettimana.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {statistiche.confrontoSettimanaPrecedente >= 0 ? '+' : ''}{statistiche.confrontoSettimanaPrecedente.toFixed(1)}% vs periodo precedente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Media Giornaliera</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{statistiche.mediaGiornaliera.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Media per giorno</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {modalitaVisualizzazione === 'settimana' ? 'Trend Settimanale' : 'Trend Periodo'}
            </CardTitle>
            {statistiche.trendSettimanale >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${statistiche.trendSettimanale >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {statistiche.trendSettimanale >= 0 ? '+' : ''}{statistiche.trendSettimanale.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {modalitaVisualizzazione === 'settimana' ? 'vs settimana precedente' : 'vs periodo precedente'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Giorni con Incassi</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modalitaVisualizzazione === 'settimana' 
                ? `${statistiche.giorniConIncassi}/7` 
                : `${statistiche.giorniConIncassi} giorni`
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {modalitaVisualizzazione === 'settimana' ? 'Giorni della settimana' : 'Giorni del periodo'}
            </p>
          </CardContent>
        </Card>
      </div>

      

      {/* Tabella */}
      <Card>
        <CardHeader>
          <CardTitle>Lista Incassi</CardTitle>
          <CardDescription>Gestisci tutti i record degli incassi</CardDescription>
        </CardHeader>
        <CardContent>
          <IncassiTable 
            incassi={incassi.filter(incasso => {
              const dataIncasso = new Date(incasso.data);
              const rangeCorrente = getRangeCorrente();
              return dataIncasso >= rangeCorrente.inizio && dataIncasso <= rangeCorrente.fine;
            })} 
            onDelete={handleIncassoDeleted}
            onEdit={fetchIncassi}
          />
        </CardContent>
      </Card>

      {/* Form Modale */}
      {isFormOpen && (
        <IncassiForm 
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={handleIncassoAdded}
        />
      )}
    </div>
  );
} 