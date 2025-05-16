'use client'

import { useState, useEffect } from 'react'
import { format, addMinutes } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'

interface Request {
  id: string
  employee_id: string
  type: 'permesso' | 'ferie' | 'malattia'
  start_date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  created_at: string
  employee: {
    name: string
    surname: string
    email: string
    weekly_hours: number
  }
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

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const { data: requestsData, error } = await supabase
        .from('requests')
        .select(`
          *,
          employee:employees (
            name,
            surname,
            email,
            weekly_hours
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequests(requestsData)
    } catch (error) {
      console.error('Errore nel caricamento delle richieste:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateDailyHours = (weeklyHours: number) => {
    const dailyMinutes = (weeklyHours * 60) / 6 // Dividiamo le ore settimanali per 6 giorni
    const hours = Math.floor(dailyMinutes / 60)
    const minutes = Math.round(dailyMinutes % 60)
    return {
      start: '10:00',
      end: format(addMinutes(new Date().setHours(10, 0), dailyMinutes), 'HH:mm')
    }
  }

  const handleApprove = async (request: Request) => {
    try {
      // Aggiorniamo lo stato della richiesta
      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: 'approved' })
        .eq('id', request.id)

      if (updateError) throw updateError

      // Se la richiesta è approvata, inseriamo gli shifts corrispondenti
      if (request.type === 'permesso') {
        // Per i permessi, usiamo gli orari specificati nella richiesta
        const { error: shiftError } = await supabase
          .from('shifts')
          .insert({
            employee_id: request.employee_id,
            date: request.start_date,
            start_time: request.start_time,
            end_time: request.end_time,
            type: 'permesso'
          })

        if (shiftError) throw shiftError
      } else {
        // Per ferie e malattia, calcoliamo gli orari in base alle ore settimanali
        const { start, end } = calculateDailyHours(request.employee.weekly_hours)
        
        // Creiamo un array di date tra start_date e end_date
        const startDate = new Date(request.start_date)
        const endDate = new Date(request.end_date || request.start_date)
        const dates: string[] = []
        
        for (let date = startDate; date <= endDate; date.setDate(date.getDate() + 1)) {
          // Escludiamo le domeniche (0 = domenica)
          if (date.getDay() !== 0) {
            dates.push(format(date, 'yyyy-MM-dd'))
          }
        }

        // Inseriamo uno shift per ogni giorno
        const shifts = dates.map(date => ({
          employee_id: request.employee_id,
          date,
          start_time: start,
          end_time: end,
          type: request.type // 'ferie' o 'malattia'
        }))

        const { error: shiftsError } = await supabase
          .from('shifts')
          .insert(shifts)

        if (shiftsError) throw shiftsError
      }

      // Aggiorniamo la lista delle richieste
      setRequests(requests.map(r => 
        r.id === request.id 
          ? { ...r, status: 'approved' }
          : r
      ))

      alert('Richiesta approvata con successo')
    } catch (error) {
      console.error('Errore nell\'approvazione della richiesta:', error)
      alert('Errore nell\'approvazione della richiesta')
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)

      if (error) throw error

      setRequests(requests.map(r => 
        r.id === requestId 
          ? { ...r, status: 'rejected' }
          : r
      ))

      alert('Richiesta rifiutata')
    } catch (error) {
      console.error('Errore nel rifiuto della richiesta:', error)
      alert('Errore nel rifiuto della richiesta')
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
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Gestione Richieste</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dipendente</th>
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
                    {request.employee.name} {request.employee.surname}
                  </td>
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
                          onClick={() => handleApprove(request)}
                          className="p-2 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(request.id)}
                          className="p-2 text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Non ci sono richieste da gestire
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 