import { ArrowLeftIcon, CloseIcon, HistoryIcon, PlusIcon } from './icons'
import type { ConnectionStatus } from './types'

type Props = {
  view: 'chat' | 'list'
  status: ConnectionStatus
  statusLabel: string
  sessionCount: number
  onToggleView: () => void
  onNewChat: () => void
  onClose: () => void
}

export function Header({
  view,
  status,
  statusLabel,
  sessionCount,
  onToggleView,
  onNewChat,
  onClose,
}: Props) {
  const isList = view === 'list'
  const isOffline = status === 'offline'

  return (
    <div className="chat-widget__header">
      {isList ? (
        <>
          <button
            type="button"
            className="chat-widget__icon-btn"
            aria-label="Back to chat"
            title="Back to chat"
            onClick={onToggleView}
          >
            <ArrowLeftIcon />
          </button>
          <div className="chat-widget__titles">
            <h1 className="chat-widget__title">Conversations</h1>
            <div className="chat-widget__status-line">
              <span className="chat-widget__status-label">
                {sessionCount} {sessionCount === 1 ? 'chat session' : 'chats sessions'} 
              </span>
            </div>
          </div>
          <button
            type="button"
            className="chat-widget__icon-btn chat-widget__icon-btn--primary"
            aria-label="New conversation"
            title="New conversation"
            onClick={onNewChat}
          >
            <PlusIcon />
          </button>
        </>
      ) : (
        <>
          <div className="chat-widget__avatar">
            <img
              src="/favicon.png"
              alt="HotelMate Logo"
              className="chat-widget__avatar-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <div className="chat-widget__titles">
            <h1 className="chat-widget__title">HotelMate Assistant</h1>
            <div className="chat-widget__status-line">
              <span
                className={`chat-widget__dot${isOffline ? ' chat-widget__dot--offline' : ' chat-widget__dot--online'}`}
              />
              <span className="chat-widget__status-label">
                {isOffline ? statusLabel : 'Online'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="chat-widget__icon-btn"
            aria-label="New conversation"
            title="New conversation"
            onClick={onNewChat}
          >
            <PlusIcon />
          </button>

          <button
            type="button"
            className="chat-widget__icon-btn"
            aria-label="View conversations history"
            title="Conversations history"
            onClick={onToggleView}
          >
            <HistoryIcon />
          </button>
        </>
      )}

      <button
        type="button"
        className="chat-widget__icon-btn"
        aria-label="Close chat"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </div>
  )
}
