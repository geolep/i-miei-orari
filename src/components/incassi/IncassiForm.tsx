'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';

const incassoSchema = z.object({
  data: z.string().min(1, 'La data è obbligatoria'),
  importo: z.string().min(1, 'L\'importo è obbligatorio')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'L\'importo deve essere un numero positivo'
    }),
  note: z.string().optional()
});

type IncassoFormData = z.infer<typeof incassoSchema>;

interface Incasso {
  id: string;
  data: string;
  importo: number;
  note?: string;
  created_at: string;
}

interface IncassiFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  incassoToEdit?: Incasso | null;
}

export default function IncassiForm({ isOpen, onClose, onSuccess, incassoToEdit }: IncassiFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!incassoToEdit;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<IncassoFormData>({
    resolver: zodResolver(incassoSchema),
    defaultValues: {
      data: '',
      importo: '',
      note: ''
    }
  });

  useEffect(() => {
    if (incassoToEdit) {
      reset({
        data: incassoToEdit.data,
        importo: incassoToEdit.importo.toString(),
        note: incassoToEdit.note || ''
      });
    } else {
      reset({
        data: new Date().toISOString().split('T')[0],
        importo: '',
        note: ''
      });
    }
  }, [incassoToEdit, reset]);

  const onSubmit = async (data: IncassoFormData) => {
    setLoading(true);
    try {
      const incassoData = {
        data: data.data,
        importo: parseFloat(data.importo),
        note: data.note || null
      };

      if (isEditing && incassoToEdit) {
        // Aggiorna incasso esistente
        const { error } = await supabase
          .from('incassi')
          .update(incassoData)
          .eq('id', incassoToEdit.id);

        if (error) throw error;
      } else {
        // Inserisci nuovo incasso
        const { error } = await supabase
          .from('incassi')
          .insert([incassoData]);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      alert('Errore nel salvataggio dell\'incasso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifica Incasso' : 'Nuovo Incasso'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              {...register('data')}
              className={errors.data ? 'border-red-500' : ''}
            />
            {errors.data && (
              <p className="text-sm text-red-500">{errors.data.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="importo">Importo (€)</Label>
            <Input
              id="importo"
              type="number"
              step="0.01"
              min="0"
              {...register('importo')}
              className={errors.importo ? 'border-red-500' : ''}
              placeholder="0.00"
            />
            {errors.importo && (
              <p className="text-sm text-red-500">{errors.importo.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (opzionale)</Label>
            <Textarea
              id="note"
              {...register('note')}
              placeholder="Aggiungi note o descrizione..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : (isEditing ? 'Aggiorna' : 'Salva')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 