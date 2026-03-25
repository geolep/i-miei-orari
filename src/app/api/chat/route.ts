import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import OpenAI from 'openai'
import { chatTools, executeTool, type ToolExecutionContext } from '@/lib/chat-tools'
import { supabaseAdmin } from '@/lib/supabase-server'
import { Database } from '@/lib/database.types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `Sei un assistente intelligente per la gestione degli orari dei dipendenti dell'applicazione "I Miei Orari".
Rispondi SEMPRE in italiano. Sei preciso, conciso e professionale.
Usa i tool disponibili per recuperare i dati aggiornati prima di rispondere.
Quando mostri orari o statistiche, formattali in modo leggibile (usa elenchi puntati o tabelle testuali).
Se non trovi un dipendente, suggerisci di verificare il nome o di usare la ricerca parziale.
La data di oggi è ${new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

## INSERIMENTO TURNI — flusso obbligatorio in DUE fasi

### FASE 1 — Raccolta dati e riepilogo (NON inserire ancora)
1. Identifica il dipendente con search_employee o get_all_employees.
2. Se servono orari predefiniti, chiama get_predefined_shifts.
3. Se serve la settimana tipo, chiama get_employee_week_template.
4. Costruisci mentalmente i turni da inserire.
5. Mostra all'utente un riepilogo chiaro e leggibile:
   - Dipendente, data/e, orario (inizio–fine), tipo (lavorativo/ferie/…), eventuali note.
   - Esempio: "Inserirò per **Rossi Mario** il giorno **lunedì 28 aprile** dalle **09:00 alle 17:00** (lavorativo). Confermi?"
6. Termina il messaggio con una domanda di conferma esplicita. NON chiamare ancora nessun tool di inserimento.

### FASE 2 — Inserimento (solo dopo conferma esplicita)
Quando l'utente risponde con una conferma (sì / ok / confermo / procedi / va bene / esatto):
- Chiama il tool di inserimento appropriato:
  - insert_employee_shift con mode=manual, predefined o week_template_day.
  - apply_employee_week_template per l'intera settimana.
- Dopo il successo, comunica all'utente che i turni sono stati inseriti e dici all'utente di ricaricare la dashboard..
- NON chiedere una seconda conferma. NON rifare la raccolta dati.

## MODIFICA TURNO — flusso obbligatorio in DUE fasi

### FASE 1 — Identificazione e riepilogo (NON modificare ancora)
1. Identifica il dipendente con search_employee o get_all_employees.
2. Chiama get_employee_shifts per recuperare i turni del periodo indicato (i risultati contengono un campo "id" interno al sistema).
3. Individua il turno da modificare.
4. Mostra all'utente un riepilogo chiaro con i valori ATTUALI e quelli NUOVI:
   - Esempio: "Modificherò il turno di **Rossi Mario** del **lunedì 28 aprile**: orario attuale 09:00–17:00 (lavorativo) → nuovo orario **10:00–18:00**. Confermi?"
5. Termina con una domanda di conferma. NON chiamare ancora update_employee_shift.

### FASE 2 — Modifica (solo dopo conferma esplicita)
Quando l'utente conferma:
- Chiama update_employee_shift con lo shift_id del turno e i soli campi da aggiornare.
- Dopo il successo, comunica i nuovi valori del turno e dici all'utente di ricaricare la dashboard.
- NON chiedere una seconda conferma.

### REGOLE ASSOLUTE
- Non chiamare MAI insert_employee_shift, apply_employee_week_template o update_employee_shift prima che l'utente abbia confermato esplicitamente.
- Se l'utente rifiuta o cambia idea, non inserire né modificare nulla.
- Non mostrare mai UUID o identificativi tecnici all'utente.`

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { data: employeeData, error: roleError } = await supabaseAdmin
      .from('employees')
      .select('role, name, surname')
      .eq('email', user.email!)
      .single()

    if (roleError || !employeeData) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 403 })
    }

    if (!['admin', 'manager'].includes(employeeData.role)) {
      return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
    }

    const { message, conversationId: existingConversationId } = await req.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Messaggio non valido' }, { status: 400 })
    }

    let conversationId = existingConversationId

    if (!conversationId) {
      const title = message.length > 60 ? message.substring(0, 60) + '…' : message
      const { data: conv, error: convError } = await supabaseAdmin
        .from('chat_conversations')
        .insert({ user_id: user.id, title })
        .select('id')
        .single()
      if (convError) throw convError
      conversationId = conv.id
    }

    await supabaseAdmin.from('chat_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message.trim(),
    })

    const { data: history } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(40)

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(history || []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    // Loop tool calling (non-streaming finché ci sono tool calls)
    let toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []

    const toolContext: ToolExecutionContext = {
      userId: user.id,
      conversationId,
    }

    while (true) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [...messages, ...toolMessages],
        tools: chatTools,
        tool_choice: 'auto',
        stream: false,
      })

      const choice = response.choices[0]

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        const assistantMsg: OpenAI.Chat.ChatCompletionMessageParam = {
          role: 'assistant',
          content: choice.message.content ?? null,
          tool_calls: choice.message.tool_calls,
        }
        toolMessages.push(assistantMsg)

        for (const toolCall of choice.message.tool_calls) {
          let toolResult: unknown
          try {
            if (toolCall.type !== 'function') {
              toolResult = { errore: 'Tipo di tool call non supportato' }
            } else {
              const args = JSON.parse(toolCall.function.arguments)
              toolResult = await executeTool(toolCall.function.name, args, toolContext)
            }
          } catch (err) {
            toolResult = { errore: err instanceof Error ? err.message : 'Errore sconosciuto' }
          }

          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          })
        }
        continue
      }

      // Risposta finale: stream
      const finalStream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [...messages, ...toolMessages],
        stream: true,
      })

      let fullContent = ''

      const readableStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`))

            for await (const chunk of finalStream) {
              const delta = chunk.choices[0]?.delta?.content
              if (delta) {
                fullContent += delta
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`))
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()

            await supabaseAdmin.from('chat_messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: fullContent,
            })

            await supabaseAdmin
              .from('chat_conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', conversationId)
          } catch (err) {
            controller.error(err)
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }
  } catch (err) {
    console.error('[Chat API Error]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Errore interno del server' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { data: employeeData } = await supabaseAdmin
      .from('employees')
      .select('role')
      .eq('email', user.email!)
      .single()

    if (!employeeData || !['admin', 'manager'].includes(employeeData.role)) {
      return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
    }

    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversationId')

    if (conversationId) {
      const { data: messages } = await supabaseAdmin
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      const { data: conversation } = await supabaseAdmin
        .from('chat_conversations')
        .select('id, title, user_id')
        .eq('id', conversationId)
        .single()

      if (!conversation || conversation.user_id !== user.id) {
        return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 })
      }

      return NextResponse.json({ messages: messages || [] })
    }

    const { data: conversations } = await supabaseAdmin
      .from('chat_conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ conversations: conversations || [] })
  } catch (err) {
    console.error('[Chat API GET Error]', err)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId mancante' }, { status: 400 })
    }

    const { data: conv } = await supabaseAdmin
      .from('chat_conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single()

    if (!conv || conv.user_id !== user.id) {
      return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 })
    }

    await supabaseAdmin.from('chat_conversations').delete().eq('id', conversationId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Chat API DELETE Error]', err)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
