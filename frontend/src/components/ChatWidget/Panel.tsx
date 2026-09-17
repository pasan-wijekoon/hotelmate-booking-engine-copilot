import type { ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function Panel({ open, onClose, children }: Props) {
  return (
    <div
      className={`chat-widget__panel${open ? ' chat-widget__panel--open' : ''}`}
      role="dialog"
      aria-label="Chat"
      aria-modal="false"
    >
      {/* Hidden helper so click-outside can detect panel contents */}
      <button
        type="button"
        className="chat-widget__panel-close-handle"
        aria-label="Close chat"
        onClick={onClose}
        tabIndex={-1}
      />
      {children}
    </div>
  )
}
