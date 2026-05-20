'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Plus, Trash2, Save, Calendar, Copy } from 'lucide-react'

interface SchedulePeriod {
  id: string
  name: string
  valid_from: string
  valid_to: string | null
  notes: string | null
}

interface ScheduleHour {
  id: string
  period_id: string
  weekday: number
  is_closed: boolean
  open_time_1: string | null
  close_time_1: string | null
  open_time_2: string | null
  close_time_2: string | null
}

interface ShopClosure {
  id: string
  start_date: string
  end_date: string
  reason: string | null
}

const WEEKDAYS = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 0, label: 'Domenica' },
]

const trimTime = (v: string | null) => (v ? v.substring(0, 5) : '')

function isActiveOn(period: SchedulePeriod, isoDate: string) {
  if (period.valid_from > isoDate) return false
  if (period.valid_to && period.valid_to < isoDate) return false
  return true
}

function formatPeriodRange(p: SchedulePeriod) {
  const from = format(parseISO(p.valid_from), 'd MMM yyyy', { locale: it })
  if (!p.valid_to) return `dal ${from}`
  const to = format(parseISO(p.valid_to), 'd MMM yyyy', { locale: it })
  return `${from} – ${to}`
}

export default function ShopSettings({ canEdit }: { canEdit: boolean }) {
  const [periods, setPeriods] = useState<SchedulePeriod[]>([])
  const [hoursByPeriod, setHoursByPeriod] = useState<Record<string, ScheduleHour[]>>({})
  const [closures, setClosures] = useState<ShopClosure[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingHours, setSavingHours] = useState(false)
  const [savingPeriod, setSavingPeriod] = useState(false)
  const [savingClosure, setSavingClosure] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [newClosure, setNewClosure] = useState({ start_date: '', end_date: '', reason: '' })
  const [showNewPeriodForm, setShowNewPeriodForm] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ name: '', valid_from: '', valid_to: '', notes: '' })

  // Dialog "Copia orari in altri giorni"
  const [copySource, setCopySource] = useState<ScheduleHour | null>(null)
  const [copyTargets, setCopyTargets] = useState<number[]>([])

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: periodsData }, { data: hoursData }, { data: closuresData }] = await Promise.all([
      supabase.from('shop_schedule_periods').select('*').order('valid_from', { ascending: false }),
      supabase.from('shop_schedule_hours').select('*'),
      supabase.from('shop_closures').select('*').order('start_date', { ascending: true }),
    ])

    const periodList = (periodsData as SchedulePeriod[]) ?? []
    const hoursList = (hoursData as ScheduleHour[]) ?? []
    const byPeriod: Record<string, ScheduleHour[]> = {}
    for (const h of hoursList) {
      ;(byPeriod[h.period_id] ??= []).push(h)
    }

    setPeriods(periodList)
    setHoursByPeriod(byPeriod)
    setClosures((closuresData as ShopClosure[]) ?? [])

    if (periodList.length > 0) {
      const activeNow = periodList.find(p => isActiveOn(p, today))
      setSelectedPeriodId(activeNow?.id ?? periodList[0].id)
    }
    setLoading(false)
  }

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 3000)
  }

  const selectedPeriod = useMemo(
    () => periods.find(p => p.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )

  const selectedHours = useMemo(() => {
    if (!selectedPeriodId) return []
    return WEEKDAYS.map(w => hoursByPeriod[selectedPeriodId]?.find(h => h.weekday === w.value)).filter(
      Boolean,
    ) as ScheduleHour[]
  }, [hoursByPeriod, selectedPeriodId])

  const updateLocalHour = (weekday: number, patch: Partial<ScheduleHour>) => {
    if (!selectedPeriodId) return
    setHoursByPeriod(prev => ({
      ...prev,
      [selectedPeriodId]: (prev[selectedPeriodId] ?? []).map(h =>
        h.weekday === weekday ? { ...h, ...patch } : h,
      ),
    }))
  }

  const updateLocalPeriodMeta = (patch: Partial<SchedulePeriod>) => {
    if (!selectedPeriod) return
    setPeriods(prev => prev.map(p => (p.id === selectedPeriod.id ? { ...p, ...patch } : p)))
  }

  const handleSaveSelectedPeriod = async () => {
    if (!selectedPeriod) return
    setSavingHours(true)
    try {
      const hours = hoursByPeriod[selectedPeriod.id] ?? []
      const hourUpdates = hours.map(h =>
        supabase
          .from('shop_schedule_hours')
          .update({
            is_closed: h.is_closed,
            open_time_1: h.is_closed ? null : h.open_time_1 || null,
            close_time_1: h.is_closed ? null : h.close_time_1 || null,
            open_time_2: h.is_closed ? null : h.open_time_2 || null,
            close_time_2: h.is_closed ? null : h.close_time_2 || null,
          })
          .eq('id', h.id),
      )

      const metaUpdate = supabase
        .from('shop_schedule_periods')
        .update({
          name: selectedPeriod.name,
          valid_from: selectedPeriod.valid_from,
          valid_to: selectedPeriod.valid_to || null,
          notes: selectedPeriod.notes,
        })
        .eq('id', selectedPeriod.id)

      const results = await Promise.all([metaUpdate, ...hourUpdates])
      const firstError = results.find(r => r.error)
      if (firstError?.error) throw firstError.error
      showFeedback('success', 'Periodo salvato')
    } catch (err) {
      console.error('Errore salvataggio periodo:', err)
      showFeedback('error', 'Errore nel salvataggio del periodo')
    } finally {
      setSavingHours(false)
    }
  }

  const handleCreatePeriod = async () => {
    if (!newPeriod.name.trim() || !newPeriod.valid_from) {
      showFeedback('error', 'Inserisci nome e data di inizio')
      return
    }
    setSavingPeriod(true)
    try {
      // Crea il periodo
      const { data: created, error: pErr } = await supabase
        .from('shop_schedule_periods')
        .insert({
          name: newPeriod.name.trim(),
          valid_from: newPeriod.valid_from,
          valid_to: newPeriod.valid_to || null,
          notes: newPeriod.notes || null,
        })
        .select()
        .single()
      if (pErr) throw pErr

      // Copia le ore dal periodo attualmente selezionato (se presente)
      // come punto di partenza. Altrimenti crea 7 righe default chiuse.
      const sourceHours = selectedPeriodId ? hoursByPeriod[selectedPeriodId] ?? [] : []
      const newHourRows = WEEKDAYS.map(w => {
        const src = sourceHours.find(h => h.weekday === w.value)
        return {
          period_id: created!.id,
          weekday: w.value,
          is_closed: src?.is_closed ?? false,
          open_time_1: src?.open_time_1 ?? null,
          close_time_1: src?.close_time_1 ?? null,
          open_time_2: src?.open_time_2 ?? null,
          close_time_2: src?.close_time_2 ?? null,
        }
      })

      const { data: hoursInserted, error: hErr } = await supabase
        .from('shop_schedule_hours')
        .insert(newHourRows)
        .select()
      if (hErr) throw hErr

      setPeriods(prev =>
        [created as SchedulePeriod, ...prev].sort((a, b) => b.valid_from.localeCompare(a.valid_from)),
      )
      setHoursByPeriod(prev => ({ ...prev, [created!.id]: (hoursInserted as ScheduleHour[]) ?? [] }))
      setSelectedPeriodId(created!.id)
      setShowNewPeriodForm(false)
      setNewPeriod({ name: '', valid_from: '', valid_to: '', notes: '' })
      showFeedback('success', 'Nuovo periodo creato')
    } catch (err) {
      console.error('Errore creazione periodo:', err)
      showFeedback('error', 'Errore nella creazione del periodo')
    } finally {
      setSavingPeriod(false)
    }
  }

  const handleDeletePeriod = async () => {
    if (!selectedPeriod) return
    if (periods.length === 1) {
      showFeedback('error', 'Deve esistere almeno un periodo')
      return
    }
    if (!confirm(`Eliminare il periodo "${selectedPeriod.name}"? Le ore associate verranno rimosse.`)) {
      return
    }
    try {
      const { error } = await supabase
        .from('shop_schedule_periods')
        .delete()
        .eq('id', selectedPeriod.id)
      if (error) throw error
      const remaining = periods.filter(p => p.id !== selectedPeriod.id)
      setPeriods(remaining)
      setHoursByPeriod(prev => {
        const next = { ...prev }
        delete next[selectedPeriod.id]
        return next
      })
      setSelectedPeriodId(remaining[0]?.id ?? null)
      showFeedback('success', 'Periodo eliminato')
    } catch (err) {
      console.error('Errore eliminazione periodo:', err)
      showFeedback('error', "Errore nell'eliminazione del periodo")
    }
  }

  const openCopyDialog = (hour: ScheduleHour) => {
    setCopySource(hour)
    setCopyTargets([])
  }

  const closeCopyDialog = () => {
    setCopySource(null)
    setCopyTargets([])
  }

  const toggleCopyTarget = (weekday: number) => {
    setCopyTargets(prev =>
      prev.includes(weekday) ? prev.filter(w => w !== weekday) : [...prev, weekday],
    )
  }

  const setCopyTargetsTo = (weekdays: number[]) => setCopyTargets(weekdays)

  const handleApplyCopy = () => {
    if (!copySource || !selectedPeriodId || copyTargets.length === 0) return
    setHoursByPeriod(prev => ({
      ...prev,
      [selectedPeriodId]: (prev[selectedPeriodId] ?? []).map(h =>
        copyTargets.includes(h.weekday)
          ? {
              ...h,
              is_closed: copySource.is_closed,
              open_time_1: copySource.open_time_1,
              close_time_1: copySource.close_time_1,
              open_time_2: copySource.open_time_2,
              close_time_2: copySource.close_time_2,
            }
          : h,
      ),
    }))
    showFeedback(
      'success',
      `Orari copiati in ${copyTargets.length} giorn${copyTargets.length === 1 ? 'o' : 'i'} (ricordati di salvare)`,
    )
    closeCopyDialog()
  }

  const handleAddClosure = async () => {
    if (!newClosure.start_date) {
      showFeedback('error', 'Inserisci una data di inizio')
      return
    }
    setSavingClosure(true)
    try {
      const payload = {
        start_date: newClosure.start_date,
        end_date: newClosure.end_date || newClosure.start_date,
        reason: newClosure.reason || null,
      }
      const { data, error } = await supabase.from('shop_closures').insert(payload).select().single()
      if (error) throw error
      if (data) {
        setClosures(prev =>
          [...prev, data as ShopClosure].sort((a, b) => a.start_date.localeCompare(b.start_date)),
        )
      }
      setNewClosure({ start_date: '', end_date: '', reason: '' })
      showFeedback('success', 'Chiusura aggiunta')
    } catch (err) {
      console.error('Errore aggiunta chiusura:', err)
      showFeedback('error', "Errore nell'aggiunta della chiusura")
    } finally {
      setSavingClosure(false)
    }
  }

  const handleDeleteClosure = async (id: string) => {
    if (!confirm('Eliminare questa chiusura?')) return
    try {
      const { error } = await supabase.from('shop_closures').delete().eq('id', id)
      if (error) throw error
      setClosures(prev => prev.filter(c => c.id !== id))
      showFeedback('success', 'Chiusura eliminata')
    } catch (err) {
      console.error('Errore eliminazione chiusura:', err)
      showFeedback('error', "Errore nell'eliminazione")
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse text-sm text-gray-500">Caricamento impostazioni negozio…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={
            feedback.type === 'success'
              ? 'rounded-md bg-green-50 text-green-700 px-4 py-2 text-sm border border-green-200'
              : 'rounded-md bg-red-50 text-red-700 px-4 py-2 text-sm border border-red-200'
          }
        >
          {feedback.text}
        </div>
      )}

      {/* Periodi orario */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Periodi orario
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Ogni periodo ha un proprio orario settimanale e un intervallo di validità. Lo storico resta
              consultabile.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setShowNewPeriodForm(v => !v)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Nuovo periodo
            </Button>
          )}
        </div>

        {canEdit && showNewPeriodForm && (
          <div className="p-4 border-b bg-gray-50 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <Label className="text-xs text-gray-500">Nome</Label>
              <Input
                type="text"
                placeholder="Es. Orario estivo"
                value={newPeriod.name}
                onChange={e => setNewPeriod(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-gray-500">Valido dal</Label>
              <Input
                type="date"
                value={newPeriod.valid_from}
                onChange={e => setNewPeriod(prev => ({ ...prev, valid_from: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-gray-500">Valido al (opzionale)</Label>
              <Input
                type="date"
                value={newPeriod.valid_to}
                onChange={e => setNewPeriod(prev => ({ ...prev, valid_to: e.target.value }))}
              />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs text-gray-500">Note (opzionale)</Label>
              <Input
                type="text"
                placeholder="Es. Ridotto pomeriggi feriali"
                value={newPeriod.notes}
                onChange={e => setNewPeriod(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={handleCreatePeriod} disabled={savingPeriod} className="w-full gap-2">
                {savingPeriod ? 'Creazione…' : 'Crea periodo'}
              </Button>
            </div>
            <div className="md:col-span-12 text-xs text-gray-500">
              Gli orari del periodo selezionato verranno copiati come base, poi potrai modificarli.
            </div>
          </div>
        )}

        {/* Selettore periodo */}
        <div className="p-4 border-b flex flex-wrap gap-2">
          {periods.map(p => {
            const active = isActiveOn(p, today)
            const isSelected = p.id === selectedPeriodId
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPeriodId(p.id)}
                className={
                  'px-3 py-2 rounded-md border text-sm transition-colors text-left ' +
                  (isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-white hover:bg-gray-50 border-gray-200')
                }
              >
                <div className="font-medium flex items-center gap-2">
                  {p.name}
                  {active && (
                    <span
                      className={
                        'text-[10px] px-1.5 py-0.5 rounded-full ' +
                        (isSelected ? 'bg-white/20' : 'bg-green-100 text-green-700')
                      }
                    >
                      Attivo oggi
                    </span>
                  )}
                </div>
                <div className={'text-xs ' + (isSelected ? 'text-white/80' : 'text-gray-500')}>
                  {formatPeriodRange(p)}
                </div>
              </button>
            )
          })}
          {periods.length === 0 && (
            <div className="text-sm text-gray-500">Nessun periodo definito.</div>
          )}
        </div>

        {/* Editor del periodo selezionato */}
        {selectedPeriod && (
          <>
            {canEdit && (
              <div className="p-4 border-b grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-gray-50">
                <div className="md:col-span-3">
                  <Label className="text-xs text-gray-500">Nome periodo</Label>
                  <Input
                    type="text"
                    value={selectedPeriod.name}
                    onChange={e => updateLocalPeriodMeta({ name: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500">Valido dal</Label>
                  <Input
                    type="date"
                    value={selectedPeriod.valid_from}
                    onChange={e => updateLocalPeriodMeta({ valid_from: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500">Valido al</Label>
                  <Input
                    type="date"
                    value={selectedPeriod.valid_to ?? ''}
                    onChange={e => updateLocalPeriodMeta({ valid_to: e.target.value || null })}
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs text-gray-500">Note</Label>
                  <Input
                    type="text"
                    value={selectedPeriod.notes ?? ''}
                    onChange={e => updateLocalPeriodMeta({ notes: e.target.value || null })}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleDeletePeriod}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Elimina
                  </Button>
                </div>
              </div>
            )}

            <div className="divide-y">
              {selectedHours.map(hour => {
                const label = WEEKDAYS.find(w => w.value === hour.weekday)?.label ?? ''
                const hasBreak = !!(hour.open_time_2 || hour.close_time_2)
                return (
                  <div
                    key={hour.id}
                    className={
                      'p-4 flex flex-col md:flex-row md:items-center gap-4 ' +
                      (hour.is_closed ? 'bg-gray-50/60' : '')
                    }
                  >
                    {/* Nome giorno */}
                    <div className="md:w-28 font-medium">{label}</div>

                    {/* Toggle Aperto/Chiuso */}
                    <label className="inline-flex items-center gap-2 text-sm select-none cursor-pointer md:w-28">
                      <span className="relative">
                        <input
                          type="checkbox"
                          checked={!hour.is_closed}
                          disabled={!canEdit}
                          onChange={e =>
                            updateLocalHour(hour.weekday, { is_closed: !e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <span className="block w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 peer-disabled:opacity-50 transition-colors" />
                        <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                      </span>
                      <span className={hour.is_closed ? 'text-gray-500' : 'text-green-700 font-medium'}>
                        {hour.is_closed ? 'Chiuso' : 'Aperto'}
                      </span>
                    </label>

                    {/* Stato chiuso */}
                    {hour.is_closed && (
                      <div className="flex-1 text-sm italic text-gray-400">Negozio chiuso</div>
                    )}

                    {/* Campi orari (solo se aperto) */}
                    {!hour.is_closed && (
                      <div className="flex-1 flex flex-wrap items-end gap-2">
                        <div>
                          <Label className="text-xs text-gray-500">Apertura</Label>
                          <Input
                            type="time"
                            value={trimTime(hour.open_time_1)}
                            disabled={!canEdit}
                            onChange={e =>
                              updateLocalHour(hour.weekday, { open_time_1: e.target.value || null })
                            }
                            className="w-28"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Chiusura</Label>
                          <Input
                            type="time"
                            value={trimTime(hour.close_time_1)}
                            disabled={!canEdit}
                            onChange={e =>
                              updateLocalHour(hour.weekday, { close_time_1: e.target.value || null })
                            }
                            className="w-28"
                          />
                        </div>

                        {hasBreak ? (
                          <>
                            <span className="self-end pb-2 text-gray-300">•</span>
                            <div>
                              <Label className="text-xs text-gray-500">Apertura 2</Label>
                              <Input
                                type="time"
                                value={trimTime(hour.open_time_2)}
                                disabled={!canEdit}
                                onChange={e =>
                                  updateLocalHour(hour.weekday, {
                                    open_time_2: e.target.value || null,
                                  })
                                }
                                className="w-28"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Chiusura 2</Label>
                              <Input
                                type="time"
                                value={trimTime(hour.close_time_2)}
                                disabled={!canEdit}
                                onChange={e =>
                                  updateLocalHour(hour.weekday, {
                                    close_time_2: e.target.value || null,
                                  })
                                }
                                className="w-28"
                              />
                            </div>
                            {canEdit && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  updateLocalHour(hour.weekday, {
                                    open_time_2: null,
                                    close_time_2: null,
                                  })
                                }
                                className="text-gray-500 hover:text-red-600 self-end mb-0.5"
                                title="Rimuovi pausa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        ) : (
                          canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateLocalHour(hour.weekday, {
                                  open_time_2: hour.close_time_1 ?? '15:00',
                                  close_time_2: '19:30',
                                })
                              }
                              className="text-xs text-gray-500 self-end mb-0.5 gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Aggiungi pausa
                            </Button>
                          )
                        )}
                      </div>
                    )}

                    {/* Azione: copia */}
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openCopyDialog(hour)}
                        className="gap-2 text-gray-600 hover:text-primary"
                      >
                        <Copy className="h-4 w-4" />
                        <span className="hidden sm:inline">Copia in…</span>
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>

            {canEdit && (
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <Button onClick={handleSaveSelectedPeriod} disabled={savingHours} className="gap-2">
                  <Save className="h-4 w-4" />
                  {savingHours ? 'Salvataggio…' : 'Salva periodo'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Chiusure straordinarie */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Chiusure straordinarie</h2>
          <p className="text-xs text-gray-500 mt-1">
            Giorni di chiusura aggiuntivi rispetto agli orari settimanali (festività, ferie, eventi).
          </p>
        </div>

        {canEdit && (
          <div className="p-4 border-b bg-gray-50 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <Label className="text-xs text-gray-500">Data inizio</Label>
              <Input
                type="date"
                value={newClosure.start_date}
                onChange={e => setNewClosure(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs text-gray-500">Data fine (opzionale)</Label>
              <Input
                type="date"
                value={newClosure.end_date}
                onChange={e => setNewClosure(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            <div className="md:col-span-4">
              <Label className="text-xs text-gray-500">Motivo (opzionale)</Label>
              <Input
                type="text"
                placeholder="Es. Ferie estive, Festa patronale…"
                value={newClosure.reason}
                onChange={e => setNewClosure(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={handleAddClosure} disabled={savingClosure} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                {savingClosure ? 'Aggiunta…' : 'Aggiungi'}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                {canEdit && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {closures.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 whitespace-nowrap text-sm">
                    {format(parseISO(c.start_date), 'd MMM yyyy', { locale: it })}
                    {c.end_date !== c.start_date && (
                      <> – {format(parseISO(c.end_date), 'd MMM yyyy', { locale: it })}</>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.reason || '-'}</td>
                  {canEdit && (
                    <td className="px-6 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClosure(c.id)}
                        className="p-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {closures.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 3 : 2} className="px-6 py-8 text-center text-sm text-gray-500">
                    Nessuna chiusura straordinaria pianificata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog: copia orari in altri giorni */}
      <Dialog open={!!copySource} onOpenChange={open => !open && closeCopyDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Copia orari di{' '}
              <span className="text-primary">
                {copySource ? WEEKDAYS.find(w => w.value === copySource.weekday)?.label : ''}
              </span>{' '}
              in:
            </DialogTitle>
          </DialogHeader>

          {copySource && (
            <div className="space-y-4">
              <div className="text-sm bg-gray-50 rounded-md p-3 border">
                {copySource.is_closed ? (
                  <span className="italic text-gray-500">Chiuso</span>
                ) : (
                  <span>
                    <strong>{trimTime(copySource.open_time_1) || '--:--'}</strong> –{' '}
                    <strong>{trimTime(copySource.close_time_1) || '--:--'}</strong>
                    {(copySource.open_time_2 || copySource.close_time_2) && (
                      <>
                        {' '}
                        • <strong>{trimTime(copySource.open_time_2) || '--:--'}</strong> –{' '}
                        <strong>{trimTime(copySource.close_time_2) || '--:--'}</strong>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCopyTargetsTo(
                      WEEKDAYS.filter(w => w.value !== copySource.weekday).map(w => w.value),
                    )
                  }
                >
                  Tutti i giorni
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCopyTargetsTo(
                      [1, 2, 3, 4, 5].filter(d => d !== copySource.weekday),
                    )
                  }
                >
                  Lun–Ven
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCopyTargetsTo([6, 0].filter(d => d !== copySource.weekday))}
                >
                  Weekend
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCopyTargetsTo([])}>
                  Deseleziona
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {WEEKDAYS.filter(w => w.value !== copySource.weekday).map(w => {
                  const selected = copyTargets.includes(w.value)
                  return (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => toggleCopyTarget(w.value)}
                      className={
                        'flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors ' +
                        (selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white hover:bg-gray-50 border-gray-200')
                      }
                    >
                      <span
                        className={
                          'w-4 h-4 rounded border flex items-center justify-center text-xs ' +
                          (selected ? 'bg-white text-primary border-white' : 'border-gray-300')
                        }
                      >
                        {selected ? '✓' : ''}
                      </span>
                      {w.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeCopyDialog}>
              Annulla
            </Button>
            <Button onClick={handleApplyCopy} disabled={copyTargets.length === 0}>
              Copia in {copyTargets.length} giorn{copyTargets.length === 1 ? 'o' : 'i'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
