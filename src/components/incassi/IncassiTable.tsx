'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Euro } from 'lucide-react';
import IncassiForm from './IncassiForm';

interface Incasso {
  id: string;
  data: string;
  importo: number;
  note?: string;
  created_at: string;
}

interface IncassiTableProps {
  incassi: Incasso[];
  onDelete: () => void;
  onEdit: () => void;
}

export default function IncassiTable({ incassi, onDelete, onEdit }: IncassiTableProps) {
  const [editingIncasso, setEditingIncasso] = useState<Incasso | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo incasso?')) return;

    try {
      const { error } = await supabase
        .from('incassi')
        .delete()
        .eq('id', id);

      if (error) throw error;
      onDelete();
    } catch (error) {
      console.error('Errore nell\'eliminazione:', error);
      alert('Errore nell\'eliminazione dell\'incasso');
    }
  };

  const handleEdit = (incasso: Incasso) => {
    setEditingIncasso(incasso);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingIncasso(null);
    onEdit();
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingIncasso(null);
  };

  if (incassi.length === 0) {
    return (
      <div className="text-center py-8">
        <Euro className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun incasso</h3>
        <p className="mt-1 text-sm text-gray-500">
          Inizia aggiungendo il tuo primo incasso.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-900">
              Data
            </th>
            <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-900">
              Importo
            </th>
            <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-900">
              Note
            </th>
            <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-900">
              Azioni
            </th>
          </tr>
        </thead>
        <tbody>
          {incassi.map((incasso) => (
            <tr key={incasso.id} className="hover:bg-gray-50">
              <td className="border border-gray-200 px-4 py-2 text-sm text-gray-900">
                {new Date(incasso.data).toLocaleDateString('it-IT', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </td>
              <td className="border border-gray-200 px-4 py-2 text-sm font-medium text-green-600">
                €{incasso.importo.toFixed(2)}
              </td>
              <td className="border border-gray-200 px-4 py-2 text-sm text-gray-900">
                {incasso.note || '-'}
              </td>
              <td className="border border-gray-200 px-4 py-2 text-sm text-gray-900">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(incasso)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(incasso.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Form Modale per Modifica */}
      {isFormOpen && (
        <IncassiForm 
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          incassoToEdit={editingIncasso}
        />
      )}
    </div>
  );
} 