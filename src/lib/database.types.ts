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
      },
      employee_week_templates: {
        Row: {
          id: string
          employee_id: string
          template_name: string | null
          weekday: number
          start_time: string
          end_time: string
          type: 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'
          note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          template_name?: string | null
          weekday: number
          start_time: string
          end_time: string
          type: 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'
          note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          template_name?: string | null
          weekday?: number
          start_time?: string
          end_time?: string
          type?: 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'
          note?: string | null
          created_at?: string | null
        }
      },
      incassi: {
        Row: {
          id: string
          data: string
          importo: number
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          data: string
          importo: number
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          data?: string
          importo?: number
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      chat_conversations: {
        Row: {
          id: string
          user_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
        }
      }
      predefined_shifts: {
        Row: {
          id: string
          start_time: string
          end_time: string
          type: 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'
          created_at: string | null
        }
        Insert: {
          id?: string
          start_time: string
          end_time: string
          type: 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'
          created_at?: string | null
        }
        Update: {
          id?: string
          start_time?: string
          end_time?: string
          type?: 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'
          created_at?: string | null
        }
      }
      shop_schedule_periods: {
        Row: {
          id: string
          name: string
          valid_from: string
          valid_to: string | null
          notes: string | null
          created_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          valid_from: string
          valid_to?: string | null
          notes?: string | null
          created_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          valid_from?: string
          valid_to?: string | null
          notes?: string | null
          created_at?: string | null
          created_by?: string | null
        }
      }
      shop_schedule_hours: {
        Row: {
          id: string
          period_id: string
          weekday: number
          is_closed: boolean
          open_time_1: string | null
          close_time_1: string | null
          open_time_2: string | null
          close_time_2: string | null
        }
        Insert: {
          id?: string
          period_id: string
          weekday: number
          is_closed?: boolean
          open_time_1?: string | null
          close_time_1?: string | null
          open_time_2?: string | null
          close_time_2?: string | null
        }
        Update: {
          id?: string
          period_id?: string
          weekday?: number
          is_closed?: boolean
          open_time_1?: string | null
          close_time_1?: string | null
          open_time_2?: string | null
          close_time_2?: string | null
        }
      }
      shop_closures: {
        Row: {
          id: string
          start_date: string
          end_date: string
          reason: string | null
          created_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          start_date: string
          end_date: string
          reason?: string | null
          created_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          start_date?: string
          end_date?: string
          reason?: string | null
          created_at?: string | null
          created_by?: string | null
        }
      }
      chat_pending_shift_actions: {
        Row: {
          id: string
          user_id: string
          conversation_id: string
          payload: Json
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id: string
          payload: Json
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string
          payload?: Json
          expires_at?: string
          created_at?: string
        }
      }
    }
  }
} 