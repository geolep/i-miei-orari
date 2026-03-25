import { supabaseAdmin } from './supabase-server'
import { format, parseISO, differenceInMinutes, parse, addDays, getDay } from 'date-fns'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type ShiftType = 'lavorativo' | 'permesso' | 'ferie' | 'malattia' | 'straordinario'

// ─── Festività italiane ───────────────────────────────────────────────────────

function calculateEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function getItalianHolidays(year: number): Set<string> {
  const holidays = new Set<string>()
  holidays.add(`${year}-01-01`)
  holidays.add(`${year}-01-06`)
  holidays.add(`${year}-04-25`)
  holidays.add(`${year}-05-01`)
  holidays.add(`${year}-06-02`)
  holidays.add(`${year}-08-15`)
  holidays.add(`${year}-11-01`)
  holidays.add(`${year}-12-08`)
  holidays.add(`${year}-12-25`)
  holidays.add(`${year}-12-26`)
  const easter = calculateEaster(year)
  const easterMonday = new Date(easter)
  easterMonday.setDate(easterMonday.getDate() + 1)
  holidays.add(format(easter, 'yyyy-MM-dd'))
  holidays.add(format(easterMonday, 'yyyy-MM-dd'))
  return holidays
}

function minutesToHM(mins: number): string {
  if (mins <= 0) return '0h'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/** Indice giorno come in employee_week_templates: 0=Lunedì … 6=Domenica */
function mondayBasedWeekday(d: Date): number {
  const gd = d.getDay()
  return gd === 0 ? 6 : gd - 1
}

function normalizeTime(t: string): string {
  const s = t.trim()
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s
  throw new Error(`Formato orario non valido: ${t}`)
}

function isMondayYmd(dateStr: string): boolean {
  const d = parse(dateStr, 'yyyy-MM-dd', new Date())
  return getDay(d) === 1
}

type PendingShiftPayloadV1 = {
  v: 1
  rows: Array<{
    employee_id: string
    date: string
    start_time: string
    end_time: string
    type: ShiftType
    note: string | null
  }>
}

// ─── Handler dei tool ─────────────────────────────────────────────────────────

async function getAllEmployees() {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, name, surname, email, role, weekly_hours')
    .not('role', 'eq', 'admin')
    .order('surname')
  if (error) throw new Error(`Errore caricamento dipendenti: ${error.message}`)
  return data || []
}

async function searchEmployee(query: string) {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, name, surname, email, role, weekly_hours')
    .not('role', 'eq', 'admin')
    .or(`name.ilike.%${query}%,surname.ilike.%${query}%,email.ilike.%${query}%`)
    .order('surname')
  if (error) throw new Error(`Errore ricerca dipendente: ${error.message}`)
  return data || []
}

async function getEmployeeShifts(employee_id: string, start_date: string, end_date: string) {
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('name, surname')
    .eq('id', employee_id)
    .single()

  const { data, error } = await supabaseAdmin
    .from('shifts')
    .select('*')
    .eq('employee_id', employee_id)
    .gte('date', start_date)
    .lte('date', end_date)
    .order('date')
    .order('start_time')
  if (error) throw new Error(`Errore caricamento turni: ${error.message}`)

  return {
    employee: employee ? `${employee.surname} ${employee.name}` : employee_id,
    shifts: (data || []).map(s => ({
      id: s.id,
      data: s.date,
      orario: `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`,
      tipo: s.type,
      ore: minutesToHM(differenceInMinutes(
        parseISO(`${s.date}T${s.end_time}`),
        parseISO(`${s.date}T${s.start_time}`)
      )),
      note: s.note || null,
    })),
  }
}

async function getShiftsByDate(date: string) {
  const { data, error } = await supabaseAdmin
    .from('shifts')
    .select('*, employee:employees(name, surname)')
    .eq('date', date)
    .order('start_time')
  if (error) throw new Error(`Errore caricamento turni per data: ${error.message}`)

  return (data || []).map((s: any) => ({
    dipendente: s.employee ? `${s.employee.surname} ${s.employee.name}` : s.employee_id,
    orario: `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`,
    tipo: s.type,
    ore: minutesToHM(differenceInMinutes(
      parseISO(`${date}T${s.end_time}`),
      parseISO(`${date}T${s.start_time}`)
    )),
    note: s.note || null,
  }))
}

async function getEmployeeMonthlySummary(employee_id: string, month: number, year: number) {
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('name, surname, weekly_hours')
    .eq('id', employee_id)
    .single()

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)

  const { data, error } = await supabaseAdmin
    .from('shifts')
    .select('*')
    .eq('employee_id', employee_id)
    .gte('date', format(start, 'yyyy-MM-dd'))
    .lte('date', format(end, 'yyyy-MM-dd'))
  if (error) throw new Error(`Errore caricamento turni mensili: ${error.message}`)

  const holidays = getItalianHolidays(year)
  let ordinarie = 0, straordinarie = 0, maggiorate = 0, ferie = 0, permessi = 0
  const malattiaDays = new Set<string>()

  ;(data || []).forEach(shift => {
    const mins = differenceInMinutes(
      parseISO(`${shift.date}T${shift.end_time}`),
      parseISO(`${shift.date}T${shift.start_time}`)
    )
    const dayOfWeek = new Date(shift.date).getDay()
    const isMaggiorata = dayOfWeek === 0 || holidays.has(shift.date)

    if (shift.type === 'lavorativo') {
      if (isMaggiorata) maggiorate += mins
      else ordinarie += mins
    } else if (shift.type === 'straordinario') {
      if (isMaggiorata) maggiorate += mins
      else straordinarie += mins
    } else if (shift.type === 'ferie') {
      ferie += mins
    } else if (shift.type === 'permesso') {
      permessi += mins
    } else if (shift.type === 'malattia') {
      malattiaDays.add(shift.date)
    }
  })

  const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

  return {
    dipendente: employee ? `${employee.surname} ${employee.name}` : employee_id,
    ore_settimanali: employee?.weekly_hours ?? null,
    periodo: `${MONTHS_IT[month - 1]} ${year}`,
    ordinarie: minutesToHM(ordinarie),
    straordinarie: minutesToHM(straordinarie),
    maggiorate: minutesToHM(maggiorate),
    ferie: minutesToHM(ferie),
    permessi: minutesToHM(permessi),
    malattia: malattiaDays.size > 0
      ? `${malattiaDays.size} ${malattiaDays.size === 1 ? 'giorno' : 'giorni'}`
      : '0 giorni',
  }
}

async function getPendingRequests() {
  const { data, error } = await supabaseAdmin
    .from('requests')
    .select('*, employee:employees(name, surname, email, weekly_hours)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Errore caricamento richieste: ${error.message}`)

  return (data || []).map((r: any) => ({
    id: r.id,
    dipendente: r.employee ? `${r.employee.surname} ${r.employee.name}` : r.employee_id,
    tipo: r.type,
    data_inizio: r.start_date,
    data_fine: r.end_date || r.start_date,
    note: r.note || null,
    creata_il: r.created_at,
  }))
}

async function getEmployeeWeekTemplate(employee_id: string) {
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('name, surname')
    .eq('id', employee_id)
    .single()

  const { data, error } = await supabaseAdmin
    .from('employee_week_templates')
    .select('*')
    .eq('employee_id', employee_id)
    .order('weekday')
    .order('start_time')
  if (error) throw new Error(`Errore caricamento template settimanale: ${error.message}`)

  const DAYS_IT = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

  return {
    dipendente: employee ? `${employee.surname} ${employee.name}` : employee_id,
    template: (data || []).map(t => ({
      giorno: DAYS_IT[t.weekday] ?? `Giorno ${t.weekday}`,
      orario: `${t.start_time.substring(0, 5)} - ${t.end_time.substring(0, 5)}`,
      tipo: t.type,
      note: t.note || null,
    })),
  }
}

async function getPredefinedShifts() {
  const { data, error } = await supabaseAdmin
    .from('predefined_shifts')
    .select('id, start_time, end_time, type')
    .order('start_time')
  if (error) throw new Error(`Errore caricamento orari predefiniti: ${error.message}`)
  return (data || []).map(s => ({
    id: s.id,
    start_time: s.start_time,
    end_time: s.end_time,
    tipo: s.type,
    etichetta: `${s.start_time.substring(0, 5)}–${s.end_time.substring(0, 5)} (${s.type})`,
  }))
}

export type ToolExecutionContext = {
  userId: string
  conversationId: string
}

function requireContext(ctx: ToolExecutionContext | undefined): ToolExecutionContext {
  if (!ctx?.userId || !ctx.conversationId) {
    throw new Error('Contesto mancante: userId e conversationId sono obbligatori per questa operazione')
  }
  return ctx
}

function formatEmployeeLabel(name: string | null, surname: string | null, id: string) {
  if (name && surname) return `${surname} ${name}`
  return id
}

async function insertEmployeeShift(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext | undefined
) {
  requireContext(ctx)
  const mode = args.mode as string
  const employee_id = args.employee_id as string
  const date = args.date as string

  if (!employee_id || !date) {
    throw new Error('employee_id e date sono obbligatori')
  }

  const { data: employee, error: empErr } = await supabaseAdmin
    .from('employees')
    .select('name, surname')
    .eq('id', employee_id)
    .maybeSingle()
  if (empErr) throw new Error(`Errore dipendente: ${empErr.message}`)
  if (!employee) throw new Error('Dipendente non trovato')

  const dipLabel = formatEmployeeLabel(employee.name, employee.surname, employee_id)
  let rows: PendingShiftPayloadV1['rows'] = []

  if (mode === 'manual') {
    const type = args.type as ShiftType
    const start_time = normalizeTime(String(args.start_time ?? ''))
    const end_time = normalizeTime(String(args.end_time ?? ''))
    const note = args.note != null && args.note !== '' ? String(args.note) : null
    if (!type) throw new Error('type è obbligatorio in modalità manual')
    rows = [{ employee_id, date, start_time, end_time, type, note }]
  } else if (mode === 'predefined') {
    const predefined_shift_id = args.predefined_shift_id as string
    if (!predefined_shift_id) throw new Error('predefined_shift_id è obbligatorio')
    const { data: pre, error: preErr } = await supabaseAdmin
      .from('predefined_shifts')
      .select('start_time, end_time, type')
      .eq('id', predefined_shift_id)
      .maybeSingle()
    if (preErr) throw new Error(`Errore orario predefinito: ${preErr.message}`)
    if (!pre) throw new Error('Orario predefinito non trovato')
    rows = [{
      employee_id,
      date,
      start_time: normalizeTime(pre.start_time),
      end_time: normalizeTime(pre.end_time),
      type: pre.type,
      note: null,
    }]
  } else if (mode === 'week_template_day') {
    const d = parse(date, 'yyyy-MM-dd', new Date())
    const weekday = mondayBasedWeekday(d)
    const { data: templates, error: tErr } = await supabaseAdmin
      .from('employee_week_templates')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('weekday', weekday)
      .order('start_time')
    if (tErr) throw new Error(`Errore settimana tipo: ${tErr.message}`)
    if (!templates?.length) {
      throw new Error('Nessuna fascia nella settimana tipo per questo giorno della settimana')
    }
    rows = templates.map(t => ({
      employee_id,
      date,
      start_time: normalizeTime(t.start_time),
      end_time: normalizeTime(t.end_time),
      type: t.type,
      note: t.note ?? null,
    }))
  } else {
    throw new Error('mode deve essere manual, predefined o week_template_day')
  }

  const { error: insErr } = await supabaseAdmin.from('shifts').insert(rows)
  if (insErr) throw new Error(`Errore inserimento turni: ${insErr.message}`)

  const riepilogo = rows.map((r, i) =>
    `${i + 1}. ${dipLabel} — ${r.date} ${r.start_time.substring(0, 5)}–${r.end_time.substring(0, 5)} (${r.type})${r.note ? ` — ${r.note}` : ''}`
  )

  return {
    success: true,
    inseriti: rows.length,
    riepilogo,
  }
}

async function applyEmployeeWeekTemplate(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext | undefined
) {
  requireContext(ctx)
  const employee_id = args.employee_id as string
  const week_start_monday = args.week_start_monday as string

  if (!employee_id || !week_start_monday) {
    throw new Error('employee_id e week_start_monday sono obbligatori')
  }
  if (!isMondayYmd(week_start_monday)) {
    throw new Error('week_start_monday deve essere un lunedì (formato YYYY-MM-DD)')
  }

  const { data: employee, error: empErr } = await supabaseAdmin
    .from('employees')
    .select('name, surname')
    .eq('id', employee_id)
    .maybeSingle()
  if (empErr) throw new Error(`Errore dipendente: ${empErr.message}`)
  if (!employee) throw new Error('Dipendente non trovato')

  const { data: templates, error: tErr } = await supabaseAdmin
    .from('employee_week_templates')
    .select('*')
    .eq('employee_id', employee_id)
    .order('weekday')
    .order('start_time')

  if (tErr) throw new Error(`Errore settimana tipo: ${tErr.message}`)
  if (!templates?.length) throw new Error('Nessuna settimana tipo per questo dipendente')

  const weekStart = parse(week_start_monday, 'yyyy-MM-dd', new Date())
  const rows: PendingShiftPayloadV1['rows'] = templates.map(t => ({
    employee_id,
    date: format(addDays(weekStart, t.weekday), 'yyyy-MM-dd'),
    start_time: normalizeTime(t.start_time),
    end_time: normalizeTime(t.end_time),
    type: t.type,
    note: t.note ?? null,
  }))

  const { error: insErr } = await supabaseAdmin.from('shifts').insert(rows)
  if (insErr) throw new Error(`Errore inserimento turni: ${insErr.message}`)

  const dipLabel = formatEmployeeLabel(employee.name, employee.surname, employee_id)
  const dateMin = rows.reduce((a, r) => (r.date < a ? r.date : a), rows[0].date)
  const dateMax = rows.reduce((a, r) => (r.date > a ? r.date : a), rows[0].date)

  return {
    success: true,
    inseriti: rows.length,
    periodo: `${dateMin} … ${dateMax}`,
    dipendente: dipLabel,
  }
}

async function updateEmployeeShift(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext | undefined
) {
  requireContext(ctx)
  const shift_id = args.shift_id as string
  if (!shift_id) throw new Error('shift_id è obbligatorio')

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('shifts')
    .select('*, employee:employees(name, surname)')
    .eq('id', shift_id)
    .maybeSingle()
  if (fetchErr) throw new Error(`Errore recupero turno: ${fetchErr.message}`)
  if (!existing) throw new Error('Turno non trovato')

  const updates: Record<string, unknown> = {}

  if (args.start_time != null && args.start_time !== '') {
    updates.start_time = normalizeTime(String(args.start_time))
  }
  if (args.end_time != null && args.end_time !== '') {
    updates.end_time = normalizeTime(String(args.end_time))
  }
  if (args.type != null && args.type !== '') {
    updates.type = args.type as ShiftType
  }
  if (Object.prototype.hasOwnProperty.call(args, 'note')) {
    updates.note = args.note != null && args.note !== '' ? String(args.note) : null
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Nessun campo da aggiornare: fornire almeno uno tra start_time, end_time, type, note')
  }

  const { error: updErr } = await supabaseAdmin
    .from('shifts')
    .update(updates)
    .eq('id', shift_id)
  if (updErr) throw new Error(`Errore aggiornamento turno: ${updErr.message}`)

  const emp = (existing as any).employee
  const dipLabel = emp ? `${emp.surname} ${emp.name}` : existing.employee_id
  const newStart = (updates.start_time ?? existing.start_time) as string
  const newEnd = (updates.end_time ?? existing.end_time) as string
  const newType = (updates.type ?? existing.type) as string

  return {
    success: true,
    dipendente: dipLabel,
    data: existing.date,
    orario: `${String(newStart).substring(0, 5)}–${String(newEnd).substring(0, 5)}`,
    tipo: newType,
    note: (updates.note !== undefined ? updates.note : existing.note) ?? null,
  }
}

// ─── Definizioni OpenAI ───────────────────────────────────────────────────────

export const chatTools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_all_employees',
      description: 'Restituisce la lista di tutti i dipendenti (esclusi gli admin) con nome, cognome, email, ruolo e ore settimanali.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_employee',
      description: 'Cerca un dipendente per nome, cognome o email (ricerca parziale, case-insensitive).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Testo da cercare nel nome, cognome o email del dipendente' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_employee_shifts',
      description: 'Restituisce i turni di un dipendente specifico in un intervallo di date.',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'string', description: 'UUID del dipendente' },
          start_date: { type: 'string', description: 'Data inizio nel formato YYYY-MM-DD' },
          end_date: { type: 'string', description: 'Data fine nel formato YYYY-MM-DD' },
        },
        required: ['employee_id', 'start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_shifts_by_date',
      description: 'Restituisce tutti i turni di tutti i dipendenti in una data specifica.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Data nel formato YYYY-MM-DD' },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_employee_monthly_summary',
      description: 'Restituisce il riepilogo mensile delle ore di un dipendente: ordinarie, straordinarie, maggiorate (domenica/festivi), ferie, permessi, giorni di malattia.',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'string', description: 'UUID del dipendente' },
          month: { type: 'number', description: 'Mese (1=Gennaio … 12=Dicembre)' },
          year: { type: 'number', description: 'Anno (es. 2026)' },
        },
        required: ['employee_id', 'month', 'year'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_pending_requests',
      description: 'Restituisce tutte le richieste di permesso, ferie o malattia in attesa di approvazione.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_employee_week_template',
      description: 'Restituisce il template della settimana tipo (orari standard) di un dipendente.',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'string', description: 'UUID del dipendente' },
        },
        required: ['employee_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_predefined_shifts',
      description:
        'Elenco degli orari predefiniti globali (fasce orarie salvate in anagrafica). Usali per scegliere predefined_shift_id in preview_employee_shift.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'insert_employee_shift',
      description:
        'Inserisce immediatamente il turno per UN giorno. mode=manual: usa start_time, end_time, type; mode=predefined: usa predefined_shift_id; mode=week_template_day: copia tutte le fasce di quel giorno dalla settimana tipo.',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['manual', 'predefined', 'week_template_day'],
            description: 'manual: orari manuali; predefined: da tabella predefiniti; week_template_day: copia dalla settimana tipo per quel giorno della settimana',
          },
          employee_id: { type: 'string', description: 'UUID del dipendente' },
          date: { type: 'string', description: 'Data YYYY-MM-DD' },
          start_time: { type: 'string', description: 'Solo se mode=manual, es. 09:00' },
          end_time: { type: 'string', description: 'Solo se mode=manual' },
          type: {
            type: 'string',
            enum: ['lavorativo', 'permesso', 'ferie', 'malattia', 'straordinario'],
            description: 'Solo se mode=manual',
          },
          note: { type: 'string', description: 'Opzionale, solo mode=manual' },
          predefined_shift_id: { type: 'string', description: 'Solo se mode=predefined, UUID da get_predefined_shifts' },
        },
        required: ['mode', 'employee_id', 'date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'apply_employee_week_template',
      description:
        'Applica immediatamente l\'intera settimana tipo alla settimana che inizia il lunedì week_start_monday.',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'string', description: 'UUID del dipendente' },
          week_start_monday: {
            type: 'string',
            description: 'Data del lunedì della settimana target, formato YYYY-MM-DD',
          },
        },
        required: ['employee_id', 'week_start_monday'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_employee_shift',
      description:
        'Modifica un turno già esistente identificato da shift_id (ottenuto con get_employee_shifts). ' +
        'Aggiorna solo i campi forniti: start_time, end_time, type, note. Gli altri rimangono invariati.',
      parameters: {
        type: 'object',
        properties: {
          shift_id: { type: 'string', description: 'UUID del turno da modificare (campo id restituito da get_employee_shifts)' },
          start_time: { type: 'string', description: 'Nuovo orario di inizio, es. 09:00 (opzionale)' },
          end_time: { type: 'string', description: 'Nuovo orario di fine, es. 17:00 (opzionale)' },
          type: {
            type: 'string',
            enum: ['lavorativo', 'permesso', 'ferie', 'malattia', 'straordinario'],
            description: 'Nuovo tipo di turno (opzionale)',
          },
          note: { type: 'string', description: 'Nuova nota (opzionale; passare stringa vuota per cancellare la nota)' },
        },
        required: ['shift_id'],
      },
    },
  },
]

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context?: ToolExecutionContext
): Promise<unknown> {
  switch (name) {
    case 'get_all_employees':
      return getAllEmployees()
    case 'search_employee':
      return searchEmployee(args.query as string)
    case 'get_employee_shifts':
      return getEmployeeShifts(
        args.employee_id as string,
        args.start_date as string,
        args.end_date as string
      )
    case 'get_shifts_by_date':
      return getShiftsByDate(args.date as string)
    case 'get_employee_monthly_summary':
      return getEmployeeMonthlySummary(
        args.employee_id as string,
        args.month as number,
        args.year as number
      )
    case 'get_pending_requests':
      return getPendingRequests()
    case 'get_employee_week_template':
      return getEmployeeWeekTemplate(args.employee_id as string)
    case 'get_predefined_shifts':
      return getPredefinedShifts()
    case 'insert_employee_shift':
      return insertEmployeeShift(args, context)
    case 'apply_employee_week_template':
      return applyEmployeeWeekTemplate(args, context)
    case 'update_employee_shift':
      return updateEmployeeShift(args, context)
    default:
      throw new Error(`Tool sconosciuto: ${name}`)
  }
}
