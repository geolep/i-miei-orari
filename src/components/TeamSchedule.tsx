'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, subWeeks, addWeeks, parseISO, differenceInHours, differenceInMinutes } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from './ui/button'
import { Database } from '@/lib/database.types'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import ShiftDialog from './ShiftDialog'
import { Stethoscope, Palmtree, Clock, LucideIcon, Zap, GripVertical, MoreVertical } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Menu, Transition } from '@headlessui/react'

type Employee = Database['public']['Tables']['employees']['Row'] & {
  weekly_hours?: number;
}
type Shift = Database['public']['Tables']['shifts']['Row']
type ShiftType = 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

const SHIFT_COLORS: Record<ShiftType, { bg: string; text: string }> = {
  lavorativo: { bg: 'bg-green-100', text: 'text-green-800' },
  permesso: { bg: 'bg-pink-100', text: 'text-pink-800' },
  ferie: { bg: 'bg-purple-100', text: 'text-purple-800' },
  malattia: { bg: 'bg-red-100', text: 'text-red-800' },
  straordinario: { bg: 'bg-yellow-100', text: 'text-yellow-800' }
}

const SHIFT_ICONS: Record<ShiftType, LucideIcon | undefined> = {
  malattia: Stethoscope,
  ferie: Palmtree,
  permesso: Clock,
  lavorativo: undefined,
  straordinario: Zap
}

// Nuovo tipo per orari predefiniti
interface PredefinedShift {
  id: string;
  start_time: string;
  end_time: string;
  type: ShiftType;
}

// Funzione per determinare il colore di background per i turni lavorativi mattina/pomeriggio
function getLavorativoBg(start_time: string) {
  if (!start_time) return 'bg-green-100';
  const [h, m] = start_time.split(':').map(Number);
  if (h > 15 || (h === 15 && m > 0)) return 'bg-green-300';
  return 'bg-green-100';
}

export default function TeamSchedule() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedShift, setSelectedShift] = useState<Shift | undefined>()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [predefinedShifts, setPredefinedShifts] = useState<PredefinedShift[]>([])
  const [isEditingPredefined, setIsEditingPredefined] = useState<string | null>(null)
  const [newPredefined, setNewPredefined] = useState<{start_time: string, end_time: string, type: ShiftType}>({start_time: '', end_time: '', type: 'lavorativo'})
  const [isAddPredefinedOpen, setIsAddPredefinedOpen] = useState(false)
  const [isEditPredefinedOpen, setIsEditPredefinedOpen] = useState(false)
  const [editPredefinedId, setEditPredefinedId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [requestType, setRequestType] = useState<'permesso' | 'ferie' | 'malattia'>('permesso')
  const [requestStartDate, setRequestStartDate] = useState<string>('')
  const [requestEndDate, setRequestEndDate] = useState<string>('')
  const [requestStartTime, setRequestStartTime] = useState<string>('')
  const [requestEndTime, setRequestEndTime] = useState<string>('')
  const [requestNote, setRequestNote] = useState<string>('')

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))

  useEffect(() => {
    fetchEmployees()
    fetchShifts()
    fetchPredefinedShifts()
    fetchUserRole()
  }, [currentDate])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .not('role', 'eq', 'admin')
        .order('surname')

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Errore nel caricamento dei dipendenti:', error)
    }
  }

  const fetchShifts = async () => {
    try {
      const startDateStr = format(startDate, 'yyyy-MM-dd')
      const endDateStr = format(addDays(startDate, 6), 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('date', startDateStr)
        .lte('date', endDateStr)

      if (error) throw error
      setShifts(data || [])
    } catch (error) {
      console.error('Errore nel caricamento dei turni:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPredefinedShifts = async () => {
    const { data, error } = await supabase.from('predefined_shifts').select('*')
    if (!error && data) setPredefinedShifts(data)
  }

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('employees')
        .select('role')
        .eq('email', user.email)
        .single()
      if (!error && data) setUserRole(data.role)
    }
  }

  const handleDeleteAllSchedule = async () => {
    if (confirm('Sei sicuro di voler eliminare tutti gli orari di questa settimana?')) {
      try {
        const startDateStr = format(startDate, 'yyyy-MM-dd')
        const endDateStr = format(addDays(startDate, 6), 'yyyy-MM-dd')

        const { error } = await supabase
          .from('shifts')
          .delete()
          .gte('date', startDateStr)
          .lte('date', endDateStr)

        if (error) throw error
        fetchShifts()
      } catch (error) {
        console.error('Errore nell\'eliminazione dei turni:', error)
      }
    }
  }

  const handleAddShift = (employeeId: string, date: Date) => {
    setSelectedEmployeeId(employeeId)
    setSelectedDate(date)
    setSelectedShift(undefined)
    setIsDialogOpen(true)
  }

  const handleEditShift = (shift: Shift, date: Date) => {
    setSelectedEmployeeId(shift.employee_id)
    setSelectedDate(date)
    setSelectedShift(shift)
    setIsDialogOpen(true)
  }

  const handleSaveShift = async (shiftData: Partial<Shift>) => {
    try {
      if (selectedShift) {
        // Update existing shift
        const { error } = await supabase
          .from('shifts')
          .update(shiftData)
          .eq('id', selectedShift.id)

        if (error) throw error
      } else {
        // Create new shift
        const { error } = await supabase
          .from('shifts')
          .insert([shiftData])

        if (error) throw error
      }

      fetchShifts()
    } catch (error) {
      console.error('Errore nel salvare il turno:', error)
    }
  }

  const handleDeleteShift = async () => {
    if (!selectedShift) return

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', selectedShift.id)

      if (error) throw error
      fetchShifts()
    } catch (error) {
      console.error('Errore nell\'eliminazione del turno:', error)
    }
  }

  const getShiftsForEmployeeAndDate = (employeeId: string, date: Date) => {
    return shifts.filter(
      shift => shift.employee_id === employeeId && shift.date === format(date, 'yyyy-MM-dd')
    )
  }

  const calculateWeeklyHours = (employeeId: string) => {
    const employeeShifts = shifts.filter(shift => shift.employee_id === employeeId)
    let totalMinutes = 0

    employeeShifts.forEach(shift => {
      if (shift.type === 'lavorativo' || shift.type === 'straordinario') {
        const startTime = parseISO(`${shift.date}T${shift.start_time}`)
        const endTime = parseISO(`${shift.date}T${shift.end_time}`)
        totalMinutes += differenceInMinutes(endTime, startTime)
      }
    })

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const handlePreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1))
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1))
  const handleThisWeek = () => setCurrentDate(new Date())

  const handleQuickDeleteShift = async (shiftId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Previene l'apertura del dialog di modifica
      try {
        const { error } = await supabase
          .from('shifts')
          .delete()
          .eq('id', shiftId)

        if (error) throw error
        fetchShifts()
      } catch (error) {
        console.error('Errore nell\'eliminazione del turno:', error)
      }
    
  }

  const handleDrop = async (e: React.DragEvent, employeeId: string, date: Date) => {
    e.preventDefault()
    const shiftData = JSON.parse(e.dataTransfer.getData('shift'))
    
    try {
      const { error } = await supabase
        .from('shifts')
        .insert([{
          employee_id: employeeId,
          date: format(date, 'yyyy-MM-dd'),
          start_time: shiftData.start,
          end_time: shiftData.end,
          type: shiftData.type
        }])

      if (error) throw error
      fetchShifts()
    } catch (error) {
      console.error('Errore nel salvare il turno:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, shift: PredefinedShift) => {
    e.dataTransfer.setData('shift', JSON.stringify({
      start: shift.start_time,
      end: shift.end_time,
      type: shift.type
    }))
  }

  // CRUD orari predefiniti
  const handleAddPredefined = async () => {
    if (!newPredefined.start_time || !newPredefined.end_time) return
    const { error } = await supabase.from('predefined_shifts').insert([newPredefined])
    if (!error) {
      setNewPredefined({start_time: '', end_time: '', type: 'lavorativo'})
      fetchPredefinedShifts()
    }
  }

  const handleDeletePredefined = async (id: string) => {
    const { error } = await supabase.from('predefined_shifts').delete().eq('id', id)
    if (!error) fetchPredefinedShifts()
  }

  const handleEditPredefined = (shift: PredefinedShift) => {
    setIsEditingPredefined(shift.id)
    setNewPredefined({start_time: shift.start_time, end_time: shift.end_time, type: shift.type})
  }

  const handleSaveEditPredefined = async (id: string) => {
    const { error } = await supabase.from('predefined_shifts').update(newPredefined).eq('id', id)
    if (!error) {
      setIsEditingPredefined(null)
      setNewPredefined({start_time: '', end_time: '', type: 'lavorativo'})
      fetchPredefinedShifts()
    }
  }

  const handleRequestSubmit = async () => {
    if (!requestStartDate) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: employeeData } = await supabase
        .from('employees')
        .select('id')
        .eq('email', user.email)
        .single()

      if (!employeeData) return

      const requestData = {
        employee_id: employeeData.id,
        type: requestType,
        start_date: requestStartDate,
        end_date: requestEndDate || requestStartDate,
        start_time: requestType === 'permesso' ? requestStartTime : null,
        end_time: requestType === 'permesso' ? requestEndTime : null,
        note: requestNote || null,
        status: 'pending'
      }

      const { error } = await supabase.from('requests').insert([requestData])
      
      if (error) throw error
      
      setIsRequestModalOpen(false)
      // Reset form
      setRequestStartDate('')
      setRequestEndDate('')
      setRequestStartTime('')
      setRequestEndTime('')
      setRequestNote('')
      setRequestType('permesso')
      
      alert('Richiesta inviata con successo!')
    } catch (error) {
      console.error('Errore nell\'inserimento della richiesta:', error)
      alert('Errore nell\'invio della richiesta')
    }
  }

  // Funzione per copiare gli orari della settimana precedente
  const handleCopyPreviousWeek = async () => {
    if (!confirm('Vuoi copiare tutti gli orari della settimana precedente in questa settimana? Gli orari esistenti verranno mantenuti.')) return;
    try {
      const prevStartDate = format(addDays(startDate, -7), 'yyyy-MM-dd');
      const prevEndDate = format(addDays(startDate, -1), 'yyyy-MM-dd');
      const currStartDate = format(startDate, 'yyyy-MM-dd');
      const currEndDate = format(addDays(startDate, 6), 'yyyy-MM-dd');

      // Prendi tutti i turni della settimana precedente
      const { data: prevShifts, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('date', prevStartDate)
        .lte('date', prevEndDate);
      if (error) throw error;
      if (!prevShifts || prevShifts.length === 0) {
        alert('Nessun orario trovato nella settimana precedente.');
        return;
      }
      // Calcola la differenza di giorni tra la settimana precedente e quella attuale
      const dayDiff = 7;
      // Prepara i nuovi turni da inserire
      const newShifts = prevShifts.map(shift => ({
        employee_id: shift.employee_id,
        date: format(addDays(new Date(shift.date), dayDiff), 'yyyy-MM-dd'),
        start_time: shift.start_time,
        end_time: shift.end_time,
        type: shift.type,
        note: shift.note,
      }));
      // Inserisci i nuovi turni
      const { error: insertError } = await supabase
        .from('shifts')
        .insert(newShifts);
      if (insertError) throw insertError;
      fetchShifts();
      alert('Orari copiati con successo!');
    } catch (err) {
      console.error('Errore nella copia degli orari:', err);
      alert('Errore nella copia degli orari.');
    }
  };

  // Copia solo i turni della settimana precedente per un singolo dipendente
  const handleCopyPreviousWeekForEmployee = async (employeeId: string) => {
    try {
      const prevStartDate = format(addDays(startDate, -7), 'yyyy-MM-dd');
      const prevEndDate = format(addDays(startDate, -1), 'yyyy-MM-dd');
      // Prendi solo i turni della settimana precedente per il dipendente
      const { data: prevShifts, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', prevStartDate)
        .lte('date', prevEndDate);
      if (error) throw error;
      if (!prevShifts || prevShifts.length === 0) {
        alert('Nessun orario trovato nella settimana precedente per questo dipendente.');
        return;
      }
      const dayDiff = 7;
      const newShifts = prevShifts.map(shift => ({
        employee_id: shift.employee_id,
        date: format(addDays(new Date(shift.date), dayDiff), 'yyyy-MM-dd'),
        start_time: shift.start_time,
        end_time: shift.end_time,
        type: shift.type,
        note: shift.note,
      }));
      const { error: insertError } = await supabase
        .from('shifts')
        .insert(newShifts);
      if (insertError) throw insertError;
      fetchShifts();
    } catch (err) {
      console.error('Errore nella copia degli orari per dipendente:', err);
      alert('Errore nella copia degli orari per dipendente.');
    }
  };

  // Elimina tutti i turni della settimana corrente per un singolo dipendente
  const handleDeleteWeekForEmployee = async (employeeId: string) => {
    if (!confirm('Vuoi eliminare tutti i turni di questa settimana per questo dipendente?')) return;
    try {
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(addDays(startDate, 6), 'yyyy-MM-dd');
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('employee_id', employeeId)
        .gte('date', startDateStr)
        .lte('date', endDateStr);
      if (error) throw error;
      fetchShifts();
    } catch (err) {
      console.error('Errore nell\'eliminazione dei turni della settimana per dipendente:', err);
      alert('Errore nell\'eliminazione dei turni della settimana per dipendente.');
    }
  };

  // Funzione per copiare la settimana corrente come settimana tipo
  const handleCopyCurrentWeekAsTemplate = async (employeeId: string) => {
    try {
      // Calcola le date della settimana corrente
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(addDays(startDate, 6), 'yyyy-MM-dd');
      // Prendi tutti i turni della settimana corrente per il dipendente
      const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', startDateStr)
        .lte('date', endDateStr);
      if (error) throw error;
      // Cancella le fasce settimana tipo già presenti
      await supabase
        .from('employee_week_templates')
        .delete()
        .eq('employee_id', employeeId);
      // Inserisci le nuove fasce come settimana tipo
      if (shifts && shifts.length > 0) {
        const weekTemplates = shifts.map(shift => ({
          employee_id: employeeId,
          weekday: new Date(shift.date).getDay() === 0 ? 6 : new Date(shift.date).getDay() - 1, // 0=dom, 6=sab → 0=lun
          start_time: shift.start_time,
          end_time: shift.end_time,
          type: shift.type,
          note: shift.note,
          template_name: 'Settimana standard'
        }));
        const { error: insertError } = await supabase
          .from('employee_week_templates')
          .insert(weekTemplates);
        if (insertError) throw insertError;
      }
      alert('Settimana tipo aggiornata con successo!');
    } catch (err) {
      console.error('Errore nel copiare la settimana come settimana tipo:', err);
      alert('Errore nel copiare la settimana come settimana tipo.');
    }
  };

  // Funzione per inserire la settimana tipo negli orari della settimana corrente
  const handleInsertWeekTemplate = async (employeeId: string) => {
    try {
      // Prendi tutte le fasce settimana tipo del dipendente
      const { data: templates, error } = await supabase
        .from('employee_week_templates')
        .select('*')
        .eq('employee_id', employeeId);
      if (error) throw error;
      if (!templates || templates.length === 0) {
        alert('Nessuna settimana tipo trovata per questo dipendente.');
        return;
      }
      // Calcola la data di inizio della settimana visualizzata
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      // Prepara i nuovi turni da inserire
      const newShifts = templates.map(t => {
        const date = addDays(weekStart, t.weekday);
        return {
          employee_id: employeeId,
          date: format(date, 'yyyy-MM-dd'),
          start_time: t.start_time,
          end_time: t.end_time,
          type: t.type,
          note: t.note,
        };
      });
      // Inserisci i nuovi turni
      const { error: insertError } = await supabase
        .from('shifts')
        .insert(newShifts);
      if (insertError) throw insertError;
      fetchShifts();
      alert('Settimana tipo inserita negli orari!');
    } catch (err) {
      console.error('Errore nell\'inserimento della settimana tipo:', err);
      alert('Errore nell\'inserimento della settimana tipo.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="container mx-auto p-4 flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <ShiftDialog
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onSave={handleSaveShift}
            onDelete={handleDeleteShift}
            selectedDate={selectedDate}
            selectedShift={selectedShift}
            employeeId={selectedEmployeeId}
            employeeName={employees.find(e => e.id === selectedEmployeeId)?.name + ' ' + employees.find(e => e.id === selectedEmployeeId)?.surname}
            quickTimes={predefinedShifts.map(s => ({
              label: `${s.start_time.substring(0,5)} - ${s.end_time.substring(0,5)}`,
              start: s.start_time,
              end: s.end_time
            }))}
          />

          {/* Header */}
          <div className="mb-8">
            <p className="text-gray-600">Gestisci gli orari settimanali del team</p>
          </div>

          

          {/* Predefined Shifts Panel dinamico */}
          {userRole !== 'employee' && (
            <div className="flex flex-col bg-white p-3 rounded-lg border shadow-sm mb-4">
              <div className="mb-2 font-medium text-sm">Orari Predefiniti</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {predefinedShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className={cn(
                      'relative flex items-center gap-1 px-2 py-1 rounded text-xs group select-none',
                      shift.type === 'lavorativo'
                        ? getLavorativoBg(shift.start_time)
                        : SHIFT_COLORS[shift.type].bg,
                      SHIFT_COLORS[shift.type].text
                    )}
                    style={{ minWidth: 90 }}
                  >
                    {/* Handle drag */}
                    <span
                      className="cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => handleDragStart(e, shift)}
                      title="Trascina per copiare l'orario"
                      onClick={e => e.stopPropagation()}
                    >
                      <GripVertical size={14} />
                    </span>
                    {/* Click per modifica */}
                    <span
                      className="flex items-center gap-1 cursor-pointer"
                      onClick={() => {
                        setEditPredefinedId(shift.id);
                        setNewPredefined({start_time: shift.start_time, end_time: shift.end_time, type: shift.type});
                        setIsEditPredefinedOpen(true);
                      }}
                    >
                      {SHIFT_ICONS[shift.type] && (
                        <span className="inline-block">{React.createElement(SHIFT_ICONS[shift.type]!, { size: 14 })}</span>
                      )}
                      <span className="">{shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}</span>
                    </span>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); handleDeletePredefined(shift.id); }} 
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity text-lg font-bold bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm border border-gray-200"
                      >×</button>
                    </div>
                  </div>
                ))}
                {/* Pulsante + per aggiungere */}
                <button
                  onClick={() => setIsAddPredefinedOpen(true)}
                  className="flex items-center justify-center w-6 h-6 rounded bg-gray-200 text-gray-600 hover:bg-gray-600 hover:text-gray-200 text-xl font-bold border border-gray-300"
                  title="Aggiungi orario predefinito"
                  type="button"
                >
                  +
                </button>
              </div>
              {/* Dialog per aggiunta */}
              <Dialog open={isAddPredefinedOpen} onOpenChange={setIsAddPredefinedOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Aggiungi Orario Predefinito</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs">Ora inizio
                      <input type="time" value={newPredefined.start_time} onChange={e => setNewPredefined(s => ({...s, start_time: e.target.value}))} className="w-full border rounded px-1 text-xs" />
                    </label>
                    <label className="text-xs">Ora fine
                      <input type="time" value={newPredefined.end_time} onChange={e => setNewPredefined(s => ({...s, end_time: e.target.value}))} className="w-full border rounded px-1 text-xs" />
                    </label>
                    <label className="text-xs">Tipo
                      <select value={newPredefined.type} onChange={e => setNewPredefined(s => ({...s, type: e.target.value as ShiftType}))} className="w-full border rounded px-1 text-xs">
                        <option value="lavorativo">Lavorativo</option>
                        <option value="permesso">Permesso</option>
                        <option value="ferie">Ferie</option>
                        <option value="malattia">Malattia</option>
                        <option value="straordinario">Straordinario</option>
                      </select>
                    </label>
                  </div>
                  <DialogFooter>
                    <button onClick={() => setIsAddPredefinedOpen(false)} className="px-3 py-1 rounded bg-gray-200 text-gray-700">Annulla</button>
                    <button onClick={() => { handleAddPredefined(); setIsAddPredefinedOpen(false); }} className="px-3 py-1 rounded bg-green-600 text-white">Aggiungi</button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreviousWeek}>
                ← Precedente
              </Button>
              <Button variant="secondary" onClick={handleThisWeek}>
                Questa Settimana
              </Button>
              <Button variant="outline" onClick={handleNextWeek}>
                Successiva →
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-lg font-medium">
                Settimana del {format(startDate, 'd MMMM yyyy', { locale: it })}
              </span>
              
            </div>
          </div>
          

          {/* Dialog per modifica */}
          <Dialog open={isEditPredefinedOpen} onOpenChange={setIsEditPredefinedOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifica Orario Predefinito</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <label className="text-xs">Ora inizio
                  <input type="time" value={newPredefined.start_time} onChange={e => setNewPredefined(s => ({...s, start_time: e.target.value}))} className="w-full border rounded px-1 text-xs" />
                </label>
                <label className="text-xs">Ora fine
                  <input type="time" value={newPredefined.end_time} onChange={e => setNewPredefined(s => ({...s, end_time: e.target.value}))} className="w-full border rounded px-1 text-xs" />
                </label>
                <label className="text-xs">Tipo
                  <select value={newPredefined.type} onChange={e => setNewPredefined(s => ({...s, type: e.target.value as ShiftType}))} className="w-full border rounded px-1 text-xs">
                    <option value="lavorativo">Lavorativo</option>
                    <option value="permesso">Permesso</option>
                    <option value="ferie">Ferie</option>
                    <option value="malattia">Malattia</option>
                    <option value="straordinario">Straordinario</option>
                  </select>
                </label>
              </div>
              <DialogFooter>
                <button onClick={() => setIsEditPredefinedOpen(false)} className="px-3 py-1 rounded bg-gray-200 text-gray-700">Annulla</button>
                <button onClick={() => { if(editPredefinedId) handleSaveEditPredefined(editPredefinedId); setIsEditPredefinedOpen(false); }} className="px-3 py-1 rounded bg-blue-600 text-white">Salva</button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          
          

          {/* Schedule Table */}
          <div id="print-orari-table" className="overflow-x-auto border rounded-lg my-3 print:my-3 print:border-0 print:rounded-none print:shadow-none print:block">
            <table className="min-w-full bg-white print:bg-white print:w-full print:text-xs print:leading-tight print:[&_th]:px-2 print:[&_td]:px-2 print:[&_th]:py-1 print:[&_td]:py-1 print:[&_th]:text-xs print:[&_td]:text-xs">
              <thead>
                <tr className="bg-gray-50 print:bg-white">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Dipendenti</th>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <th key={day} className="px-6 py-3 center text-sm font-semibold text-gray-900">{day} {format(weekDays[index], 'd/MM')}</th>
                  ))}
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Totale Ore</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee.surname} {employee.name}</td>
                    {weekDays.map((date) => (
                      <td 
                        key={date.toString()} 
                        className="px-6 py-4 relative min-h-[100px] text-center"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, employee.id, date)}
                      >
                        <div className="space-y-1">
                          {getShiftsForEmployeeAndDate(employee.id, date).map((shift) => (
                            <div key={shift.id}
                              onClick={() => {
                                if (userRole !== 'employee') handleEditShift(shift, date)
                              }}
                              className={cn(
                                'px-1 py-1 rounded text-xs cursor-pointer hover:opacity-80 group relative',
                                shift.type === 'lavorativo'
                                  ? getLavorativoBg(shift.start_time)
                                  : SHIFT_COLORS[shift.type].bg,
                                SHIFT_COLORS[shift.type].text
                              )}
                              title={shift.note || ''}
                            >
                              <div className="flex items-center gap-1 justify-center">
                                {SHIFT_ICONS[shift.type] && (
                                  <span className="inline-block">{React.createElement(SHIFT_ICONS[shift.type]!, { size: 12 })}</span>
                                )}
                                <span>{shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}</span>
                              </div>
                              {userRole !== 'employee' && (
                                <button onClick={(e) => handleQuickDeleteShift(shift.id, e)} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity text-lg font-bold bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm border border-gray-200 print:hidden" title="Elimina turno">×</button>
                              )}
                            </div>
                          ))}
                        </div>
                        {userRole !== 'employee' && (
                          <Button variant="ghost" size="sm" className="relative bottom-1 h-6 w-[100%] p-0 print:hidden" onClick={() => handleAddShift(employee.id, date)}>+</Button>
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex flex-col">
                        <span><strong>{calculateWeeklyHours(employee.id)}</strong></span>
                        <span className="text-gray-500"><strong>{employee.weekly_hours || 40}</strong>h</span>
                        
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col items-center">
                        {userRole !== 'employee' && (
                          <Menu as="div" className="relative inline-block text-left print:hidden">
                            <Menu.Button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200">
                              <MoreVertical size={18} />
                              <span className="sr-only">Azioni</span>
                            </Menu.Button>
                            <Transition
                              as={React.Fragment}
                              enter="transition ease-out duration-100"
                              enterFrom="transform opacity-0 scale-95"
                              enterTo="transform opacity-100 scale-100"
                              leave="transition ease-in duration-75"
                              leaveFrom="transform opacity-100 scale-100"
                              leaveTo="transform opacity-0 scale-95"
                            >
                              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <div className="py-1">
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        className={`$ {active ? 'bg-gray-100' : ''} w-full text-left px-4 py-2 text-sm hover:bg-gray-100`}
                                        onClick={() => handleCopyPreviousWeekForEmployee(employee.id)}
                                      >
                                        Copia sett. prec.
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        className={`$ {active ? 'bg-red-100 text-red-700' : ''} w-full text-left px-4 py-2 text-sm hover:bg-red-100`}
                                        onClick={() => handleDeleteWeekForEmployee(employee.id)}
                                      >
                                        Elimina settimana
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        className={`$ {active ? 'bg-blue-100 text-blue-700' : ''} w-full text-left px-4 py-2 text-sm hover:bg-blue-100`}
                                        onClick={() => handleCopyCurrentWeekAsTemplate(employee.id)}
                                      >
                                        Copia come settimana tipo
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        className={`$ {active ? 'bg-green-100 text-green-700' : ''} w-full text-left px-4 py-2 text-sm hover:bg-green-100`}
                                        onClick={() => handleInsertWeekTemplate(employee.id)}
                                      >
                                        Inserisci la settimana tipo
                                      </button>
                                    )}
                                  </Menu.Item>
                                </div>
                              </Menu.Items>
                            </Transition>
                          </Menu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className='flex gap-2 justify-end mb-2'>
            {userRole === 'employee' && (
              <div className="flex justify-end mb-2 print:hidden">
              <Button variant="default" onClick={() => setIsRequestModalOpen(true)}>
                Richiedi Permesso/Malattia/Ferie
              </Button>
              </div>
            )}
            {userRole !== 'employee' && (
                <>
                  <Button variant="destructive" onClick={handleDeleteAllSchedule}>
                    Elimina Tutti gli Orari
                  </Button>
                  <Button variant="secondary" onClick={handleCopyPreviousWeek}>
                    Copia Orari Settimana Precedente
                  </Button>
                </>
              )}
            {/* Pulsante stampa sopra la tabella */}
            <div className="flex justify-end mb-2 print:hidden">
              <Button variant="outline" onClick={() => window.print()}>Stampa</Button>
            </div>
          </div>

          <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inserisci Richiesta</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <label className="text-sm">Tipo di Richiesta
                  <select 
                    value={requestType} 
                    onChange={e => setRequestType(e.target.value as 'permesso' | 'ferie' | 'malattia')} 
                    className="w-full border rounded px-2 py-1 mt-1"
                  >
                    <option value="permesso">Permesso</option>
                    <option value="ferie">Ferie</option>
                    <option value="malattia">Malattia</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="text-sm">Data Inizio
                    <input 
                      type="date" 
                      value={requestStartDate} 
                      onChange={e => setRequestStartDate(e.target.value)}
                      className="w-full border rounded px-2 py-1 mt-1" 
                      required
                    />
                  </label>

                  {(requestType === 'ferie' || requestType === 'malattia') && (
                    <label className="text-sm">Data Fine
                      <input 
                        type="date" 
                        value={requestEndDate} 
                        onChange={e => setRequestEndDate(e.target.value)}
                        className="w-full border rounded px-2 py-1 mt-1" 
                      />
                    </label>
                  )}

                  {requestType === 'permesso' && (
                    <>
                      <label className="text-sm">Ora Inizio
                        <input 
                          type="time" 
                          value={requestStartTime} 
                          onChange={e => setRequestStartTime(e.target.value)}
                          className="w-full border rounded px-2 py-1 mt-1" 
                          required
                        />
                      </label>
                      <label className="text-sm">Ora Fine
                        <input 
                          type="time" 
                          value={requestEndTime} 
                          onChange={e => setRequestEndTime(e.target.value)}
                          className="w-full border rounded px-2 py-1 mt-1" 
                          required
                        />
                      </label>
                    </>
                  )}
                </div>

                <label className="text-sm">Note (opzionale)
                  <textarea 
                    value={requestNote} 
                    onChange={e => setRequestNote(e.target.value)}
                    className="w-full border rounded px-2 py-1 mt-1" 
                    rows={3}
                  />
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRequestModalOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleRequestSubmit}>
                  Invia Richiesta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-orari-table, #print-orari-table * {
            visibility: visible !important;
          }
          #print-orari-table {
            position: absolute !important;
            left: 0; top: 0; width: 100vw; margin: 0; padding: 0;
          }
          html, body {
            width: 100vw !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          @page {
            size: landscape;
            margin: 10mm;
          }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          table { font-size: 11px !important; }
          th, td { padding: 4px 8px !important; }
        }
      `}</style>
    </div>
  )
} 