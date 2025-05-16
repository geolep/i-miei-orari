export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      shifts: {
        Row: {
          id: string
          employee_id: string
          date: string
          start_time: string
          end_time: string
          type: 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          employee_id?: string
          date: string
          start_time: string
          end_time: string
          type: 'lavorativo' | 'permesso' | 'ferie' | 'malattia'| 'straordinario'
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          date?: string
          start_time?: string
          end_time?: string
          type?: 'lavorativo' | 'permesso' | 'ferie' | 'malattia'| 'straordinario'
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      employees: {
        Row: {
          id: string
          name: string
          surname: string
          email: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          surname: string
          email?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          surname?: string
          email?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
  }
} 