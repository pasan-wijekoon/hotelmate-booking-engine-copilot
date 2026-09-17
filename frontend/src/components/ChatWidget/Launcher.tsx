import { ChatIcon, CloseIcon } from './icons'

type Props = {
  open: boolean
  hasUnread: boolean
  onToggle: () => void
}

export function Launcher({ open, hasUnread, onToggle }: Props) {
  return (
    <button
      type="button"
      className={`chat-widget__launcher${open ? ' chat-widget__launcher--open' : ''}`}
      aria-label={open ? 'Close chat' : 'Open chat'}
      aria-expanded={open}
      onClick={onToggle}
    >
      <ChatIcon className="chat-widget__icon-chat" />
      <CloseIcon className="chat-widget__icon-close" />
      <span
        className={`chat-widget__launcher-badge${hasUnread ? ' chat-widget__launcher-badge--show' : ''}`}
        aria-hidden="true"
      />
    </button>
  )
}
