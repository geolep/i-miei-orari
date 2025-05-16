import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
} from './ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Database } from '@/lib/database.types'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Shift = Omit<Database['public']['Tables']['shifts']['Row'], 'type'> & { type: ShiftType }
type ShiftType = 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'

interface ShiftDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (shiftData: Partial<Shift>) => Promise<void>
  onDelete?: () => Promise<void>
  selectedDate: Date
  selectedShift?: Shift
  employeeId: string
  employeeName: string
}

const QUICK_TIMES = [
  { label: '09:30 - 12:30', start: '09:30', end: '12:30' },
  { label: '10:00 - 13:00', start: '10:00', end: '13:00' },
  { label: '15:50 - 19:30', start: '15:50', end: '19:30' },
  { label: '12:50 - 19:30', start: '12:50', end: '19:30' },
  { label: '10:00 - 16:40', start: '10:00', end: '16:40' },
]

export default function ShiftDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedDate,
  selectedShift,
  employeeId,
  employeeName,
}: ShiftDialogProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const shiftData: Partial<Shift> = {
      employee_id: employeeId,
      date: format(selectedDate, 'yyyy-MM-dd'),
      start_time: formData.get('start_time') as string,
      end_time: formData.get('end_time') as string,
      type: formData.get('type') as ShiftType,
      note: formData.get('note') as string,
    }

    if (selectedShift) {
      shiftData.id = selectedShift.id
    }

    await onSave(shiftData)
    onClose()
  }

  const handleQuickTimeSelect = (start: string, end: string) => {
    const startInput = document.getElementById('start_time') as HTMLInputElement
    const endInput = document.getElementById('end_time') as HTMLInputElement
    if (startInput && endInput) {
      startInput.value = start
      endInput.value = end
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        
        <DialogContent className="sm:max-w-[425px] bg-white shadow-lg">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <DialogTitle className="text-xl font-semibold">
              Aggiungi Orario
            </DialogTitle>
            
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-4">
              <div>
                <Label className="text-gray-700">Tipo Orario</Label>
                <Select
                  name="type"
                  defaultValue={selectedShift?.type || 'lavorativo'}
                >
                  <SelectTrigger className="w-full mt-1 bg-white">
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent className="w-full mt-1 bg-white">
                    <SelectItem value="lavorativo">Turno Lavorativo</SelectItem>
                    <SelectItem value="permesso">Permesso</SelectItem>
                    <SelectItem value="ferie">Ferie</SelectItem>
                    <SelectItem value="malattia">Malattia</SelectItem>
                    <SelectItem value="straordinario">Straordinario</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-700">Dipendente</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded-md text-gray-700 border border-gray-200">
                  {employeeName}
                  <input 
                    type="hidden" 
                    name="employee_id" 
                    value={selectedShift?.employee_id || employeeId} 
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700">Giorno</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded-md text-gray-700 border border-gray-200">
                  {format(selectedDate, 'EEEE d MMMM', { locale: it })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time" className="text-gray-700">Ora Inizio</Label>
                  <Input
                    id="start_time"
                    name="start_time"
                    type="time"
                    defaultValue={selectedShift?.start_time || ''}
                    className="mt-1 bg-white"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_time" className="text-gray-700">Ora Fine</Label>
                  <Input
                    id="end_time"
                    name="end_time"
                    type="time"
                    defaultValue={selectedShift?.end_time || ''}
                    className="mt-1 bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700">Note (opzionale)</Label>
                <textarea
                  name="note"
                  rows={3}
                  className={cn(
                    "mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2",
                    "focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  )}
                  defaultValue={selectedShift?.note || ''}
                />
              </div>

              <div>
                <Label className="text-gray-700">Orari Veloci:</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_TIMES.map((time) => (
                    <button
                      key={time.label}
                      type="button"
                      className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 border border-blue-200"
                      onClick={() => handleQuickTimeSelect(time.start, time.end)}
                    >
                      {time.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 border-t pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="bg-white"
              >
                Annulla
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Salva Orario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
} 