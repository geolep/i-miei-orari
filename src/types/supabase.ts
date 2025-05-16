export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          created_at: string | null
          id: string
          name: string
          surname: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          surname: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          surname?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string | null
          date: string
          employee_id: string | null
          end_time: string
          id: string
          note: string | null
          start_time: string
          type: Database["public"]["Enums"]["shift_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          employee_id?: string | null
          end_time: string
          id?: string
          note?: string | null
          start_time: string
          type: Database["public"]["Enums"]["shift_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          employee_id?: string | null
          end_time?: string
          id?: string
          note?: string | null
          start_time?: string
          type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      shift_type: "lavorativo" | "permesso" | "ferie" | "malattia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 