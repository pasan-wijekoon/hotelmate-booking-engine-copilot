import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatSession, Message } from '../components/ChatWidget/types'

const SESSIONS_STORAGE_KEY = 'chatbot-frontend:sessions'
const ACTIVE_SESSION_STORAGE_KEY = 'chatbot-frontend:active-session'
const LEGACY_STORAGE_KEY = 'chatbot-frontend:history'

function newSessionId(): string {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function deriveTitle(messages: Message[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user')
  if (!firstUserMsg || !firstUserMsg.content.trim()) {
    return 'New Conversation'
  }
  const clean = firstUserMsg.content.trim().replace(/[\r\n]+/g, ' ')
  return clean.length > 34 ? `${clean.slice(0, 34)}…` : clean
}

function loadSessionsFromStorage(): { sessions: ChatSession[]; activeId: string } {
  try {
    const rawSessions = localStorage.getItem(SESSIONS_STORAGE_KEY)
    if (rawSessions) {
      const parsed: unknown = JSON.parse(rawSessions)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validSessions = parsed.filter((s): s is ChatSession => {
          return (
            typeof s === 'object' &&
            s !== null &&
            typeof s.id === 'string' &&
            typeof s.title === 'string' &&
            Array.isArray(s.messages)
          )
        })

        if (validSessions.length > 0) {
          const storedActiveId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
          const activeExists = validSessions.some((s) => s.id === storedActiveId)
          const activeId = activeExists && storedActiveId ? storedActiveId : validSessions[0].id
          return { sessions: validSessions, activeId }
        }
      }
    }

    // Migrate from legacy single-session storage if exists
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      const parsedLegacy: unknown = JSON.parse(legacyRaw)
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        const legacyMessages = parsedLegacy.filter((m): m is Message => {
          if (typeof m !== 'object' || m === null) return false
          const msg = m as Partial<Message>
          return (
            typeof msg.id === 'string' &&
            (msg.role === 'user' ||
              msg.role === 'assistant' ||
              msg.role === 'system' ||
              msg.role === 'error') &&
            typeof msg.content === 'string'
          )
        })

        if (legacyMessages.length > 0) {
          const legacySession: ChatSession = {
            id: newSessionId(),
            title: deriveTitle(legacyMessages),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: legacyMessages,
          }
          return { sessions: [legacySession], activeId: legacySession.id }
        }
      }
    }
  } catch {
    // Ignore parse errors and fall through to default initial session
  }

  const defaultSession: ChatSession = {
    id: newSessionId(),
    title: 'New Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  }
  return { sessions: [defaultSession], activeId: defaultSession.id }
}

function saveSessionsToStorage(sessions: ChatSession[], activeId: string): void {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeId)
  } catch {
    // Quota or private mode
  }
}

type SessionsState = {
  sessions: ChatSession[]
  activeSessionId: string
}

/**
 * Manages multiple chat sessions, auto-saves to localStorage,
 * supports creating, switching, and deleting conversations.
 */
export function useChatSessions() {
  const [state, setState] = useState<SessionsState>(() => loadSessionsFromStorage())
  const hasMountedRef = useRef(false)

  // Persist sessions whenever state changes (skip first render)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    saveSessionsToStorage(state.sessions, state.activeSessionId)
  }, [state])

  const { sessions, activeSessionId } = state
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0]

  const createSession = useCallback((): ChatSession => {
    const newSession: ChatSession = {
      id: newSessionId(),
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }
    setState((prev) => ({
      sessions: [newSession, ...prev.sessions],
      activeSessionId: newSession.id,
    }))
    return newSession
  }, [])

  const switchSession = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeSessionId: id }))
  }, [])

  const deleteSession = useCallback((id: string) => {
    setState((prev) => {
      const filtered = prev.sessions.filter((s) => s.id !== id)
      if (filtered.length === 0) {
        const fresh: ChatSession = {
          id: newSessionId(),
          title: 'New Conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        }
        return {
          sessions: [fresh],
          activeSessionId: fresh.id,
        }
      }

      const nextActiveId = prev.activeSessionId === id
        ? filtered[0].id
        : prev.activeSessionId

      return {
        sessions: filtered,
        activeSessionId: nextActiveId,
      }
    })
  }, [])

  const updateActiveMessages = useCallback(
    (updateFn: (prevMessages: Message[]) => Message[]) => {
      setState((prev) => {
        return {
          ...prev,
          sessions: prev.sessions.map((session) => {
            if (session.id !== prev.activeSessionId) return session
            const messages = updateFn(session.messages)
            const title =
              session.title === 'New Conversation' || session.messages.length <= 1
                ? deriveTitle(messages)
                : session.title
            return {
              ...session,
              title,
              updatedAt: Date.now(),
              messages,
            }
          }),
        }
      })
    },
    [],
  )

  const clearCurrentSession = useCallback(() => {
    updateActiveMessages(() => [])
  }, [updateActiveMessages])

  const clearAllSessions = useCallback(() => {
    const fresh: ChatSession = {
      id: newSessionId(),
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }
    setState({
      sessions: [fresh],
      activeSessionId: fresh.id,
    })
    try {
      localStorage.removeItem(SESSIONS_STORAGE_KEY)
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // Ignore
    }
  }, [])

  return {
    sessions,
    activeSessionId,
    activeSession,
    createSession,
    switchSession,
    deleteSession,
    updateActiveMessages,
    clearCurrentSession,
    clearAllSessions,
  }
}
