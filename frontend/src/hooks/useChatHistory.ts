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

/**
 * Manages multiple chat sessions, auto-saves to localStorage,
 * supports creating, switching, and deleting conversations.
 */
export function useChatSessions() {
  const [initialData] = useState(() => loadSessionsFromStorage())
  const [sessions, setSessions] = useState<ChatSession[]>(initialData.sessions)
  const [activeSessionId, setActiveSessionId] = useState<string>(initialData.activeId)

  const hasMountedRef = useRef(false)

  // Persist sessions whenever sessions or activeSessionId changes (skip first render)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    saveSessionsToStorage(sessions, activeSessionId)
  }, [sessions, activeSessionId])

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0]

  const createSession = useCallback((): ChatSession => {
    const newSession: ChatSession = {
      id: newSessionId(),
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    return newSession
  }, [])

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id)
  }, [])

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id)
      if (filtered.length === 0) {
        const fresh: ChatSession = {
          id: newSessionId(),
          title: 'New Conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        }
        setActiveSessionId(fresh.id)
        return [fresh]
      }
      return filtered
    })

    setActiveSessionId((currentActiveId) => {
      if (currentActiveId === id) {
        const remaining = sessions.filter((s) => s.id !== id)
        return remaining[0]?.id ?? newSessionId()
      }
      return currentActiveId
    })
  }, [sessions])

  const updateActiveMessages = useCallback(
    (messages: Message[]) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSessionId) return session
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
      )
    },
    [activeSessionId],
  )

  const clearCurrentSession = useCallback(() => {
    updateActiveMessages([])
  }, [updateActiveMessages])

  const clearAllSessions = useCallback(() => {
    const fresh: ChatSession = {
      id: newSessionId(),
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }
    setSessions([fresh])
    setActiveSessionId(fresh.id)
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
