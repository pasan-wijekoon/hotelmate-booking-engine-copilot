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

  return <ChatWidgetInner apiUrl={config.apiUrl} timeoutMs={config.timeoutMs} />
}

function ChatWidgetError({ message }: { message: string }) {
  return (
    <div className="chat-widget__config-error">
      <strong>Chat widget misconfigured.</strong>
      <pre>{message}</pre>
    </div>
  )
}

type InnerProps = { apiUrl: string; timeoutMs: number }

function ChatWidgetInner({ apiUrl, timeoutMs }: InnerProps) {
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

  const { stream, stop, streaming } = useChatStream(apiUrl, timeoutMs)

  const [isOpen, setIsOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)

  const panelWrapRef = useRef<HTMLDivElement | null>(null)
  const launcherWrapRef = useRef<HTMLDivElement | null>(null)

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (open) {
        setHasUnread(false)
        setTimeout(() => {
          const ta = panelWrapRef.current?.querySelector<HTMLTextAreaElement>(
            '.chat-widget__textarea',
          )
          ta?.focus()
        }, 200)
      }
    },
    [],
  )

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
  const composerDisabled = !ready || streaming
  const statusLabel = STATUS_LABEL[status] ?? 'Online'

  const handleSend = useCallback(
    async (text: string) => {
      if (!ready) return

      const userMsg: Message = { id: newId(), role: 'user', content: text }
      const assistantId = newId()

      const currentList = messagesRef.current
      const updatedWithUser = [...currentList, userMsg]
      const updatedWithPlaceholder = [
        ...updatedWithUser,
        { id: assistantId, role: 'assistant', content: '', streaming: true } as Message,
      ]

      updateActiveMessages(updatedWithPlaceholder)

      let assembled = ''
      let isError = false

      try {
        await stream({
          prompt: text,
          onDelta: (chunk) => {
            assembled = chunk
            updateActiveMessages([
              ...updatedWithUser,
              { id: assistantId, role: 'assistant', content: assembled, streaming: true },
            ])
          },
        })
        setStatus('online')
      } catch (err) {
        isError = true
        setStatus('offline')
        let errorMsg =
          err instanceof Error && err.message
            ? err.message
            : `Unable to connect to AI service at ${apiUrl}.`
        if (errorMsg === 'Failed to fetch' || errorMsg.includes('NetworkError')) {
          errorMsg = `Connection Failed\nUnable to connect to ${apiUrl}. Please verify that your backend server is running and accessible.`
        }
        updateActiveMessages([
          ...updatedWithUser,
          {
            id: assistantId,
            role: 'error',
            content: errorMsg,
          },
        ])
      } finally {
        if (!isError) {
          updateActiveMessages([
            ...updatedWithUser,
            { id: assistantId, role: 'assistant', content: assembled, streaming: false },
          ])
        }
        if (!isOpen) setHasUnread(true)
      }
    },
    [ready, stream, isOpen, apiUrl, updateActiveMessages],
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
              />
              <Composer
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
