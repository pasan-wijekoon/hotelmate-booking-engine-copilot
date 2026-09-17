import type { ChatSession } from './types'
import { PlusIcon, TrashIcon } from './icons'

type Props = {
  sessions: ChatSession[]
  activeSessionId: string
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteSession: (id: string) => void
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / (1000 * 60))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ConversationsList({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: Props) {
  return (
    <div className="chat-widget__sessions-list">
      <div className="chat-widget__sessions-header">
        <button
          type="button"
          className="chat-widget__new-chat-btn"
          onClick={onNewSession}
        >
          <PlusIcon size={16} />
          <span>New conversation</span>
        </button>
      </div>

      <div className="chat-widget__sessions-scroll">
        {sessions.length === 0 ? (
          <div className="chat-widget__sessions-empty">
            No conversations yet.
          </div>
        ) : (
          sessions.map((s) => {
            const isCurrent = s.id === activeSessionId
            const lastMsg = s.messages[s.messages.length - 1]
            const snippet = lastMsg ? lastMsg.content : 'No messages yet'

            return (
              <div
                key={s.id}
                className={`chat-widget__session-card${isCurrent ? ' chat-widget__session-card--active' : ''}`}
                onClick={() => onSelectSession(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectSession(s.id)
                  }
                }}
              >
                <div className="chat-widget__session-content">
                  <div className="chat-widget__session-title-row">
                    <span className="chat-widget__session-title" title={s.title}>
                      {s.title}
                    </span>
                    <span className="chat-widget__session-time">
                      {formatTime(s.updatedAt)}
                    </span>
                  </div>
                  <p className="chat-widget__session-snippet">
                    {snippet}
                  </p>
                </div>
                <button
                  type="button"
                  className="chat-widget__session-delete-btn"
                  aria-label="Delete conversation"
                  title="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteSession(s.id)
                  }}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
