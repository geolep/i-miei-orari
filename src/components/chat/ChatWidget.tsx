'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MessageCircle, X, Plus, Trash2, Send, ChevronLeft, Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

// ─── Componente messaggio ─────────────────────────────────────────────────────

const assistantMarkdownClass =
  'text-sm leading-relaxed break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold [&_em]:italic [&_a]:text-emerald-700 [&_a]:underline'

function ChatMessage({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
          <Bot size={14} className="text-emerald-600" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
          isUser
            ? 'bg-emerald-500 text-white rounded-br-sm whitespace-pre-wrap'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <div className={assistantMarkdownClass}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        {!isUser && isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-current opacity-70 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}

// ─── Widget principale ────────────────────────────────────────────────────────

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'conversations' | 'chat'>('conversations')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const wasLoadingRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && view === 'conversations') {
      loadConversations()
    }
  }, [isOpen, view])

  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [view])

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && view === 'chat' && isOpen) {
      queueMicrotask(() => inputRef.current?.focus())
    }
    wasLoadingRef.current = isLoading
  }, [isLoading, view, isOpen])

  async function loadConversations() {
    try {
      const res = await fetch('/api/chat')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch {
      // silenzioso
    }
  }

  async function openConversation(conv: Conversation) {
    setActiveConversationId(conv.id)
    setMessages([])
    setView('chat')
    try {
      const res = await fetch(`/api/chat?conversationId=${conv.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {
      // silenzioso
    }
  }

  function startNewChat() {
    setActiveConversationId(null)
    setMessages([])
    setView('chat')
  }

  async function deleteConversation(convId: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await fetch(`/api/chat?conversationId=${convId}`, { method: 'DELETE' })
      setConversations(prev => prev.filter(c => c.id !== convId))
    } catch {
      // silenzioso
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setIsLoading(true)

    const userMsgId = crypto.randomUUID()
    const userMsg: Message = { id: userMsgId, role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])

    const streamId = crypto.randomUUID()
    const streamingMsg: Message = { id: streamId, role: 'assistant', content: '' }
    setMessages(prev => [...prev, streamingMsg])
    setStreamingMessageId(streamId)

    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: activeConversationId }),
        signal: abortControllerRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages(prev =>
          prev.map(m =>
            m.id === streamId
              ? { ...m, content: `Errore: ${err.error || 'Risposta non valida'}` }
              : m
          )
        )
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue

          try {
            const parsed = JSON.parse(payload)
            if (parsed.conversationId && !activeConversationId) {
              setActiveConversationId(parsed.conversationId)
            }
            if (parsed.delta) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === streamId ? { ...m, content: m.content + parsed.delta } : m
                )
              )
            }
          } catch {
            // ignora chunk malformati
          }
        }
      }

      // Aggiorna lista conversazioni
      await loadConversations()
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === streamId ? { ...m, content: 'Errore di connessione. Riprova.' } : m
          )
        )
      }
    } finally {
      setIsLoading(false)
      setStreamingMessageId(null)
      abortControllerRef.current = null
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return 'Oggi'
    if (diffDays === 1) return 'Ieri'
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  }

  return (
    <>
      {/* Bottone flottante */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200/60 hover:bg-emerald-600 transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
        aria-label="Apri assistente AI"
        style={{ width: 52, height: 52 }}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Pannello chat */}
      {isOpen && (
        <div className="fixed bottom-[76px] right-6 z-50 w-[380px] max-w-[calc(100vw-1.5rem)] h-[560px] max-h-[calc(100vh-100px)] bg-white rounded-2xl shadow-2xl shadow-emerald-100/80 flex flex-col border border-emerald-100 overflow-hidden">
          {/* Header — clic sulla barra per chiudere (indietro / nuova usano stopPropagation) */}
          <div
            title="Clicca per chiudere"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-500 text-white flex-shrink-0 cursor-pointer select-none hover:bg-emerald-600/95 transition-colors"
          >
            {view === 'chat' && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setView('conversations')
                  loadConversations()
                }}
                className="p-1 rounded hover:bg-emerald-600/90 transition-colors mr-1"
                aria-label="Torna alle conversazioni"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <Bot size={20} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Assistente AI</p>
              <p className="text-emerald-100 text-xs leading-tight">Orari e dipendenti</p>
            </div>
            {view === 'chat' && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  startNewChat()
                }}
                className="p-1.5 rounded hover:bg-emerald-600/90 transition-colors"
                title="Nuova conversazione"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          {/* Vista: lista conversazioni */}
          {view === 'conversations' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-3 pt-3 pb-2 flex-shrink-0">
                <Button
                  onClick={startNewChat}
                  className="w-full gap-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/90 border border-emerald-200"
                  variant="outline"
                  size="sm"
                >
                  <Plus size={16} />
                  Nuova conversazione
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-3">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                      <MessageCircle size={24} className="text-emerald-400" />
                    </div>
                    <p className="text-sm text-gray-500">
                      Nessuna conversazione ancora.<br />Inizia facendo una domanda!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => openConversation(conv)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group flex items-start gap-2"
                      >
                        <MessageCircle size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate font-medium">{conv.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(conv.updated_at)}</p>
                        </div>
                        <button
                          onClick={(e) => deleteConversation(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all flex-shrink-0"
                          aria-label="Elimina conversazione"
                        >
                          <Trash2 size={13} />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vista: chat */}
          {view === 'chat' && (
            <>
              {/* Area messaggi */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                      <Bot size={24} className="text-emerald-400" />
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Ciao! Puoi chiedermi informazioni sugli orari dei dipendenti, turni, ferie, permessi e molto altro.
                    </p>
                    <div className="flex flex-col gap-1.5 w-full mt-1">
                      {[
                        'Chi lavora oggi?',
                        'Mostrami i turni di questa settimana',
                        'Quante ore ha fatto Mario Rossi questo mese?',
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                          className="text-xs text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-emerald-50 hover:text-emerald-800 text-gray-600 border border-gray-100 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map(msg => {
                  if (
                    msg.role === 'assistant' &&
                    msg.content === '' &&
                    msg.id === streamingMessageId
                  ) {
                    return null
                  }
                  return (
                    <ChatMessage
                      key={msg.id}
                      message={msg}
                      isStreaming={msg.id === streamingMessageId}
                    />
                  )
                })}
                {isLoading && streamingMessageId && messages.find(m => m.id === streamingMessageId)?.content === '' && (
                  <div className="flex gap-2 justify-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Bot size={14} className="text-emerald-600" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
                      <Loader2 size={14} className="text-gray-400 animate-spin" />
                      <span className="text-xs text-gray-400">Elaborazione in corso…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 flex-shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Scrivi una domanda…"
                    disabled={isLoading}
                    rows={1}
                    className="flex-1 text-sm rounded-xl border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-gray-50 px-3 py-2 resize-none overflow-y-auto outline-none transition-colors leading-relaxed min-h-[36px] max-h-[120px] disabled:opacity-50"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    size="sm"
                    className="h-9 w-9 p-0 rounded-xl bg-emerald-500 hover:bg-emerald-600 flex-shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
