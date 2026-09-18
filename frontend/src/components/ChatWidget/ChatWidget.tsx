import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Composer } from './Composer'
import { Header } from './Header'
import { Launcher } from './Launcher'
import { Messages } from './Messages'
import { Panel } from './Panel'
import { ConversationsList } from './ConversationsList'
import type { ConnectionStatus, Message } from './types'
import { loadConfig } from '../../lib/config'
import { useChatStream } from '../../hooks/useChatStream'
import { useChatSessions } from '../../hooks/useChatHistory'
import { getErrorMessage } from '../../lib/api'
import './ChatWidget.css'

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const STATUS_LABEL: Record<string, string> = {
  connecting: 'Connecting…',
  online: 'Online',
  offline: 'Offline',
  'no-models': 'Service unavailable',
}

export function ChatWidget() {
  const config = useMemo(() => {
    try {
      return loadConfig()
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, [])

  if ('error' in config) {
    return <ChatWidgetError message={config.error} />
  }

  return <ChatWidgetInner />
}

function ChatWidgetError({ message }: { message: string }) {
  return (
    <div className="chat-widget__config-error">
      <strong>Chat widget misconfigured.</strong>
      <pre>{message}</pre>
    </div>
  )
}

function ChatWidgetInner() {
  const [status, setStatus] = useState<ConnectionStatus>('online')

  const {
    sessions,
    activeSessionId,
    activeSession,
    createSession,
    switchSession,
    deleteSession,
    updateActiveMessages,
  } = useChatSessions()

  const [view, setView] = useState<'chat' | 'list'>('chat')
  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession?.messages])

  // Always-fresh view of messages so streaming callbacks see the latest list
  const messagesRef = useRef<Message[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const { stream, stop, streaming, isTextareaDisabled } = useChatStream()

  const [isOpen, setIsOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)

  const panelWrapRef = useRef<HTMLDivElement | null>(null)
  const launcherWrapRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (open) {
        setHasUnread(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (isOpen && view === 'chat') {
      // Focus the textarea after the panel has transitioned into view
      const timer = setTimeout(() => {
        composerRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, view])

  useEffect(() => {
    if (!isOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (window.innerWidth < 480) return
      const target = e.target as Node
      const path = typeof e.composedPath === 'function' ? e.composedPath() : []

      const isInsidePanel = Boolean(
        panelWrapRef.current &&
          (panelWrapRef.current.contains(target) || path.includes(panelWrapRef.current)),
      )
      const isInsideLauncher = Boolean(
        launcherWrapRef.current &&
          (launcherWrapRef.current.contains(target) || path.includes(launcherWrapRef.current)),
      )

      if (isInsidePanel || isInsideLauncher) return
      setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [isOpen, setOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, setOpen])

  const ready = status === 'online'
  const composerDisabled = !ready || (streaming && isTextareaDisabled)
  const statusLabel = STATUS_LABEL[status] ?? 'Online'

  const handleSend = useCallback(
    async (text: string) => {
      if (!ready) return

      const userMsg: Message = { id: newId(), role: 'user', content: text }
      const assistantId = newId()

      // 1. Append user message and streaming placeholder
      updateActiveMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ])

      let assembled = ''
      let isError = false

      try {
        await stream({
          prompt: text,
          onDelta: (chunk) => {
            assembled = chunk
            updateActiveMessages((prev) => [
              ...prev.filter((m) => m.id !== assistantId),
              { id: assistantId, role: 'assistant', content: assembled, streaming: true },
            ])
          },
        })
        setStatus('online')
      } catch (err) {
        isError = true

        const errorMsg = getErrorMessage(err)
        updateActiveMessages((prev) => [
          ...prev.filter((m) => m.id !== assistantId),
          {
            id: assistantId,
            role: 'error',
            content: errorMsg,
          },
        ])
      } finally {
        if (!isError) {
          updateActiveMessages((prev) => [
            ...prev.filter((m) => m.id !== assistantId),
            { id: assistantId, role: 'assistant', content: assembled, streaming: false },
          ])
        }
        if (!isOpen) setHasUnread(true)
      }
    },
    [ready, stream, isOpen, updateActiveMessages],
  )

  const handleRetry = useCallback(
    (messageId: string) => {
      const currentMessages = messagesRef.current
      const errorIdx = currentMessages.findIndex((m) => m.id === messageId)
      if (errorIdx === -1) return

      // Find the closest preceding user message
      let prompt = ''
      for (let i = errorIdx - 1; i >= 0; i--) {
        if (currentMessages[i].role === 'user') {
          prompt = currentMessages[i].content
          break
        }
      }

      if (!prompt) {
        console.warn('Retry failed: No preceding user message found to use as prompt.')
        return
      }
      handleSend(prompt)
    },
    [handleSend],
  )

  const handleNewChat = useCallback(() => {
    if (streaming) stop()
    createSession()
    setView('chat')
  }, [streaming, stop, createSession])

  const handleSelectSession = useCallback(
    (id: string) => {
      if (streaming) stop()
      switchSession(id)
      setView('chat')
    },
    [streaming, stop, switchSession],
  )

  const handleToggleView = useCallback(() => {
    setView((prev) => (prev === 'chat' ? 'list' : 'chat'))
  }, [])

  return (
    <>
      <div ref={panelWrapRef} className="chat-widget__panel-wrap">
        <Panel open={isOpen} onClose={() => setOpen(false)}>
          <Header
            view={view}
            status={status}
            statusLabel={statusLabel}
            sessionCount={sessions.length}
            onToggleView={handleToggleView}
            onNewChat={handleNewChat}
            onClose={() => setOpen(false)}
          />

          {view === 'list' ? (
            <ConversationsList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewChat}
              onDeleteSession={deleteSession}
            />
          ) : (
            <>
              <Messages
                messages={messages}
                streaming={streaming}
                onSelectSuggestion={handleSend}
                onRetry={handleRetry}
              />
              <Composer
                ref={composerRef}
                disabled={composerDisabled}
                streaming={streaming}
                onSend={handleSend}
                onStop={stop}
              />
            </>
          )}
        </Panel>
      </div>
      <div ref={launcherWrapRef}>
        <Launcher open={isOpen} hasUnread={hasUnread} onToggle={() => setOpen(!isOpen)} />
      </div>
    </>
  )
}
