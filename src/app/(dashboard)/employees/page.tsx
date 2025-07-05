'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, addDays, startOfWeek, subWeeks, addWeeks, parseISO, differenceInMinutes } from 'date-fns'
import { CalendarIcon, Plus, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { it } from 'date-fns/locale'

type Employee = {
  id: string
  name: string
  surname: string
  email: string
  role: string
  weekly_hours: number
  created_at: string
  updated_at: string
}

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
]

const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
const SHIFT_TYPES = [
  { value: 'lavorativo', label: 'Lavorativo' },
  { value: 'permesso', label: 'Permesso' },
  { value: 'ferie', label: 'Ferie' },
  { value: 'malattia', label: 'Malattia' },
  { value: 'straordinario', label: 'Straordinario' },
]

type DetailModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  shifts: any[]
  type: string
  employeeName: string
}

const DetailModal = ({ isOpen, onClose, title, shifts, type, employeeName }: DetailModalProps) => {
  // Filtra i turni per il tipo specifico
  const filteredShifts = shifts.filter(s => {
    if (type === 'maggiorate') {
      return (s.type === 'lavorativo' || s.type === 'straordinario') && new Date(s.date).getDay() === 0
    }
    return s.type === type
  })

  // Ordina i turni per data
  const sortedShifts = [...filteredShifts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title} - {employeeName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Orario</th>
                <th className="px-4 py-2 text-left">Ore</th>
                <th className="px-4 py-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedShifts.map((shift) => {
                const start = parseISO(`${shift.date}T${shift.start_time}`)
                const end = parseISO(`${shift.date}T${shift.end_time}`)
                const mins = differenceInMinutes(end, start)
                const hours = Math.floor(mins / 60)
                const minutes = mins % 60

                return (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {format(parseISO(shift.date), 'EEEE d MMMM yyyy', { locale: it })}
                    </td>
                    <td className="px-4 py-2">
                      {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                    </td>
                    <td className="px-4 py-2">
                      {hours}h {minutes > 0 ? `${minutes}m` : ''}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {shift.note || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {sortedShifts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nessun turno trovato per questa categoria
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    role: 'employee',
    weekly_hours: 40
  })
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [shifts, setShifts] = useState<any[]>([])
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean
    type: string
    title: string
    employeeId: string
    employeeName: string
  }>({
    isOpen: false,
    type: '',
    title: '',
    employeeId: '',
    employeeName: ''
  })
  const [userRole, setUserRole] = useState<string>('')
  const [weekTemplate, setWeekTemplate] = useState<any[]>([])
  const [newTemplate, setNewTemplate] = useState({
    weekday: 0,
    start_time: '',
    end_time: '',
    type: 'lavorativo',
    note: '',
    template_name: 'Settimana standard'
  })
  const [isWeekTemplateDialogOpen, setIsWeekTemplateDialogOpen] = useState(false)
  const [weekTemplateEmployee, setWeekTemplateEmployee] = useState<Employee | null>(null)

  useEffect(() => {
    fetchEmployees()
    fetchShifts()
    // Supponiamo che il ruolo dell'utente sia memorizzato nel profilo utente di Supabase
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
    fetchUserRole()
  }, [selectedMonth, selectedYear])

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
    } finally {
      setIsLoading(false)
    }
  }

  const fetchShifts = async () => {
    const start = new Date(selectedYear, selectedMonth, 1)
    const end = new Date(selectedYear, selectedMonth + 1, 0)
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .gte('date', format(start, 'yyyy-MM-dd'))
      .lte('date', format(end, 'yyyy-MM-dd'))
    if (!error && data) setShifts(data)
  }

  const fetchWeekTemplate = async (employeeId: string) => {
    const { data, error } = await supabase
      .from('employee_week_templates')
      .select('*')
      .eq('employee_id', employeeId)
      .order('weekday')
      .order('start_time')
    if (!error && data) setWeekTemplate(data)
    else setWeekTemplate([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedEmployee) {
        // Update
        const { error } = await supabase
          .from('employees')
          .update(formData)
          .eq('id', selectedEmployee.id)

        if (error) throw error
      } else {
        // Determina l'URL di reindirizzamento in base all'ambiente
        const redirectUrl = process.env.NODE_ENV === 'production'
          ? 'https://your-app-url.com/complete-registration'
          : 'http://localhost:3000/complete-registration'

        // Invia un'email di invito per la registrazione
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: 'temporaryPassword123!', // Password temporanea
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              name: formData.name,
              surname: formData.surname
            }
          }
        })

        if (error) throw error

        // Inserisci il dipendente nel database
        const { error: insertError } = await supabase
          .from('employees')
          .insert([{
            ...formData,
            auth_id: null // L'auth_id sarà aggiornato dopo la registrazione
          }])

        if (insertError) throw insertError
      }

      setIsDialogOpen(false)
      fetchEmployees()
      resetForm()
    } catch (error) {
      console.error('Errore nel salvare il dipendente:', error)
      alert('Errore nel salvare il dipendente. Controlla la console per i dettagli.')
    }
  }

  // Funzione per generare password temporanea
  const generateTemporaryPassword = () => {
    const length = 12
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return password
  }

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee)
    setFormData({
      name: employee.name,
      surname: employee.surname,
      email: employee.email || '',
      role: employee.role || 'employee',
      weekly_hours: employee.weekly_hours || 40
    })
    setIsDialogOpen(true)
    fetchWeekTemplate(employee.id)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo dipendente?')) return

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchEmployees()
    } catch (error) {
      console.error('Errore nell\'eliminazione del dipendente:', error)
    }
  }

  const resetForm = () => {
    setSelectedEmployee(null)
    setFormData({
      name: '',
      surname: '',
      email: '',
      role: 'employee',
      weekly_hours: 40
    })
  }

  // Calcolo ore per categoria
  const getEmployeeStats = (employeeId: string) => {
    const empShifts = shifts.filter(s => s.employee_id === employeeId)
    let ordinarie = 0, straordinarie = 0, maggiorate = 0, ferie = 0, permessi = 0
    const malattiaDays = new Set<string>()
    empShifts.forEach(shift => {
      const start = parseISO(`${shift.date}T${shift.start_time}`)
      const end = parseISO(`${shift.date}T${shift.end_time}`)
      const mins = differenceInMinutes(end, start)
      const day = new Date(shift.date).getDay()
      if (shift.type === 'lavorativo') {
        if (day === 0) maggiorate += mins
        else ordinarie += mins
      } else if (shift.type === 'straordinario') {
        if (day === 0) maggiorate += mins
        else straordinarie += mins
      } else if (shift.type === 'ferie') ferie += mins
      else if (shift.type === 'permesso') permessi += mins
      else if (shift.type === 'malattia') malattiaDays.add(shift.date)
    })
    const toHM = (m: number) => m > 0 ? `${Math.floor(m/60)}h${m%60 ? ' '+(m%60)+'m' : ''}` : ''
    return {
      ordinarie: toHM(ordinarie),
      straordinarie: toHM(straordinarie),
      maggiorate: toHM(maggiorate),
      ferie: toHM(ferie),
      permessi: toHM(permessi),
      malattia: malattiaDays.size > 0 ? malattiaDays.size + (malattiaDays.size === 1 ? ' giorno' : ' giorni') : ''
    }
  }

  // Funzione per esportare in Excel
  const handleExportExcel = () => {
    const data = employees.map((employee) => {
      const stats = getEmployeeStats(employee.id)
      return {
        Nome: employee.surname + ' ' + employee.name,
        'Ore Settimanali': employee.weekly_hours,
        Ordinarie: stats.ordinarie,
        Straordinarie: stats.straordinarie,
        Maggiorate: stats.maggiorate,
        Ferie: stats.ferie,
        Permessi: stats.permessi,
        Malattia: stats.malattia
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dipendenti')
    XLSX.writeFile(wb, `report_dipendenti_${MONTHS[selectedMonth]}_${selectedYear}.xls`)
  }

  const openDetailModal = (type: string, title: string, employeeId: string, employeeName: string) => {
    setDetailModal({
      isOpen: true,
      type,
      title,
      employeeId,
      employeeName
    })
  }

  const handleAddTemplateRow = async () => {
    if (!selectedEmployee) return
    if (!newTemplate.start_time || !newTemplate.end_time) return
    const { error } = await supabase.from('employee_week_templates').insert([
      {
        ...newTemplate,
        employee_id: selectedEmployee.id
      }
    ])
    if (!error) {
      setNewTemplate({
        weekday: 0,
        start_time: '',
        end_time: '',
        type: 'lavorativo',
        note: '',
        template_name: 'Settimana standard'
      })
      fetchWeekTemplate(selectedEmployee.id)
    }
  }

  const handleDeleteTemplateRow = async (id: string) => {
    const { error } = await supabase.from('employee_week_templates').delete().eq('id', id)
    if (!error && selectedEmployee) fetchWeekTemplate(selectedEmployee.id)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Gestione Dipendenti</h1>
        
          <div className="flex gap-2 items-end">
            <div>
              <Label className="flex items-center gap-1"><CalendarIcon size={16} />Mese</Label>
              <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-36 bg-white border border-gray-300 rounded shadow-sm focus:ring-2 focus:ring-blue-200">
                  <SelectValue placeholder="Mese" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-1"><CalendarIcon size={16} />Anno</Label>
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-28 bg-white border border-gray-300 rounded shadow-sm focus:ring-2 focus:ring-blue-200">
                  <SelectValue placeholder="Anno" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 5}, (_,i) => new Date().getFullYear()-2+i).map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleExportExcel} className="ml-2">Esporta Excel</Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setSelectedEmployee(null); resetForm(); }}>Aggiungi Dipendente</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {selectedEmployee ? 'Modifica Dipendente' : 'Nuovo Dipendente'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surname">Cognome</Label>
                      <Input
                        id="surname"
                        value={formData.surname}
                        onChange={(e) => setFormData(prev => ({ ...prev, surname: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role">Ruolo</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona ruolo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Dipendente</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Amministratore</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weekly_hours">Ore Settimanali</Label>
                      <Input
                        id="weekly_hours"
                        type="number"
                        min="0"
                        max="168"
                        value={formData.weekly_hours}
                        onChange={(e) => setFormData(prev => ({ ...prev, weekly_hours: parseInt(e.target.value) }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between gap-2">
                    {selectedEmployee && (
                      <Button type="button" variant="destructive" onClick={() => { handleDelete(selectedEmployee.id); setIsDialogOpen(false); }}>
                        Elimina
                      </Button>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button type="submit">
                        {selectedEmployee ? 'Salva Modifiche' : 'Aggiungi'}
                      </Button>
                    </div>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
         
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ore Settimanali</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordinarie</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Straordinarie</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Maggiorate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ferie</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permessi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Malattia</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => {
              const stats = getEmployeeStats(employee.id)
              return (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-blue-700 hover:underline cursor-pointer" 
                      onClick={() => handleEdit(employee)}>
                    {employee.surname} {employee.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{employee.weekly_hours} ore</td>
                  <td className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-blue-600" 
                      onClick={() => openDetailModal('lavorativo', 'Ore Ordinarie', employee.id, `${employee.surname} ${employee.name}`)}>
                    {stats.ordinarie}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-blue-600" 
                      onClick={() => openDetailModal('straordinario', 'Ore Straordinarie', employee.id, `${employee.surname} ${employee.name}`)}>
                    {stats.straordinarie}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-blue-600" 
                      onClick={() => openDetailModal('maggiorate', 'Ore Maggiorate', employee.id, `${employee.surname} ${employee.name}`)}>
                    {stats.maggiorate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-blue-600" 
                      onClick={() => openDetailModal('ferie', 'Ferie', employee.id, `${employee.surname} ${employee.name}`)}>
                    {stats.ferie}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-blue-600" 
                      onClick={() => openDetailModal('permesso', 'Permessi', employee.id, `${employee.surname} ${employee.name}`)}>
                    {stats.permessi}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-blue-600" 
                      onClick={() => openDetailModal('malattia', 'Malattia', employee.id, `${employee.surname} ${employee.name}`)}>
                    {stats.malattia}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Button variant="outline" size="sm" onClick={() => { setWeekTemplateEmployee(employee); setIsWeekTemplateDialogOpen(true); fetchWeekTemplate(employee.id); }}>
                      Settimana tipo
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <DetailModal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
        title={detailModal.title}
        shifts={shifts.filter(s => s.employee_id === detailModal.employeeId)}
        type={detailModal.type}
        employeeName={detailModal.employeeName}
      />

      <Dialog open={isWeekTemplateDialogOpen} onOpenChange={setIsWeekTemplateDialogOpen}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>Settimana tipo {weekTemplateEmployee ? weekTemplateEmployee.surname + ' ' + weekTemplateEmployee.name : ''}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {weekTemplate.length === 0 && <div className="text-gray-500 text-sm">Nessuna fascia oraria inserita</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {weekTemplate.map(row => (
                  <div key={row.id} className="flex flex-col border rounded px-3 py-2 bg-gray-50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{WEEKDAYS[row.weekday]}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplateRow(row.id)}><Trash2 size={16}/></Button>
                    </div>
                    <div className="flex flex-col text-sm">
                      <span>{row.start_time.substring(0,5)} - {row.end_time.substring(0,5)}</span>
                      <span>{SHIFT_TYPES.find(t => t.value === row.type)?.label}</span>
                      {row.note && <span className="text-xs text-gray-500">{row.note}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
              <Select value={String(newTemplate.weekday)} onValueChange={v => setNewTemplate(nt => ({...nt, weekday: Number(v)}))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Giorno" />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="time" value={newTemplate.start_time} onChange={e => setNewTemplate(nt => ({...nt, start_time: e.target.value}))} />
              <Input type="time" value={newTemplate.end_time} onChange={e => setNewTemplate(nt => ({...nt, end_time: e.target.value}))} />
              <Select value={newTemplate.type} onValueChange={v => setNewTemplate(nt => ({...nt, type: v}))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleAddTemplateRow}><Plus size={18}/></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 