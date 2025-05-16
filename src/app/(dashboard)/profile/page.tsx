'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Trash2 } from 'lucide-react'

interface Request {
  id: string
  type: 'permesso' | 'ferie' | 'malattia'
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  created_at: string
}

interface Employee {
  id: string
  name: string
  surname: string
  email: string
  role: string
  weekly_hours: number
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
}

const typeLabels = {
  permesso: 'Permesso',
  ferie: 'Ferie',
  malattia: 'Malattia'
}

export default function ProfilePage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [editForm, setEditForm] = useState({
    type: 'permesso' as Request['type'],
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    note: ''
  })

  useEffect(() => {
    fetchEmployeeAndRequests()
  }, [])

  const fetchEmployeeAndRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch employee data
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .single()

      if (employeeError) throw employeeError
      setEmployee(employeeData)

      // Fetch requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('employee_id', employeeData.id)
        .order('created_at', { ascending: false })

      if (requestsError) throw requestsError
      setRequests(requestsData)
    } catch (error) {
      console.error('Errore nel caricamento dei dati:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (request: Request) => {
    setSelectedRequest(request)
    setEditForm({
      type: request.type,
      start_date: request.start_date,
      end_date: request.end_date || request.start_date,
      start_time: request.start_time || '',
      end_time: request.end_time || '',
      note: request.note || ''
    })
    setIsEditModalOpen(true)
  }

  const handleDelete = async (requestId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa richiesta?')) return

    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId)

      if (error) throw error
      
      // Aggiorna la lista delle richieste
      setRequests(requests.filter(r => r.id !== requestId))
      alert('Richiesta eliminata con successo')
    } catch (error) {
      console.error('Errore nell\'eliminazione della richiesta:', error)
      alert('Errore nell\'eliminazione della richiesta')
    }
  }

  const handleUpdate = async () => {
    if (!selectedRequest) return

    try {
      const updateData = {
        type: editForm.type,
        start_date: editForm.start_date,
        end_date: editForm.end_date || editForm.start_date,
        start_time: editForm.type === 'permesso' ? editForm.start_time : null,
        end_time: editForm.type === 'permesso' ? editForm.end_time : null,
        note: editForm.note || null
      }

      const { error } = await supabase
        .from('requests')
        .update(updateData)
        .eq('id', selectedRequest.id)

      if (error) throw error

      // Aggiorna la lista delle richieste
      setRequests(requests.map(r => 
        r.id === selectedRequest.id 
          ? { ...r, ...updateData }
          : r
      ))

      setIsEditModalOpen(false)
      alert('Richiesta aggiornata con successo')
    } catch (error) {
      console.error('Errore nell\'aggiornamento della richiesta:', error)
      alert('Errore nell\'aggiornamento della richiesta')
    }
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
      {employee && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">
            {employee.name} {employee.surname}
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">Email</div>
              <div className="font-medium">{employee.email}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">Ore Settimanali</div>
              <div className="font-medium">{employee.weekly_hours}h</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Le Tue Richieste</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {typeLabels[request.type]}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(new Date(request.start_date), 'd MMM yyyy', { locale: it })}
                    {request.end_date && request.end_date !== request.start_date && (
                      <> - {format(new Date(request.end_date), 'd MMM yyyy', { locale: it })}</>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {request.start_time ? (
                      <>{request.start_time.substring(0, 5)} - {request.end_time?.substring(0, 5)}</>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={statusColors[request.status]}>
                      {request.status === 'pending' && 'In attesa'}
                      {request.status === 'approved' && 'Approvata'}
                      {request.status === 'rejected' && 'Rifiutata'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {request.note || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {request.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(request)}
                          className="p-2"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(request.id)}
                          className="p-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Non hai ancora inserito nessuna richiesta
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Richiesta</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <label className="text-sm">
              Tipo di Richiesta
              <select 
                value={editForm.type} 
                onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value as Request['type'] }))}
                className="w-full border rounded px-2 py-1 mt-1"
              >
                <option value="permesso">Permesso</option>
                <option value="ferie">Ferie</option>
                <option value="malattia">Malattia</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm">
                Data Inizio
                <input 
                  type="date" 
                  value={editForm.start_date}
                  onChange={e => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                  className="w-full border rounded px-2 py-1 mt-1"
                  required
                />
              </label>

              {(editForm.type === 'ferie' || editForm.type === 'malattia') && (
                <label className="text-sm">
                  Data Fine
                  <input 
                    type="date" 
                    value={editForm.end_date}
                    onChange={e => setEditForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full border rounded px-2 py-1 mt-1"
                  />
                </label>
              )}

              {editForm.type === 'permesso' && (
                <>
                  <label className="text-sm">
                    Ora Inizio
                    <input 
                      type="time" 
                      value={editForm.start_time}
                      onChange={e => setEditForm(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full border rounded px-2 py-1 mt-1"
                      required
                    />
                  </label>
                  <label className="text-sm">
                    Ora Fine
                    <input 
                      type="time" 
                      value={editForm.end_time}
                      onChange={e => setEditForm(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full border rounded px-2 py-1 mt-1"
                      required
                    />
                  </label>
                </>
              )}
            </div>

            <label className="text-sm">
              Note (opzionale)
              <textarea 
                value={editForm.note}
                onChange={e => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                className="w-full border rounded px-2 py-1 mt-1"
                rows={3}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleUpdate}>
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 