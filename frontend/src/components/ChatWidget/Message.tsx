import { lazy, Suspense } from 'react'
import type { Message as MessageT } from './types'

// Lazy-load the syntax highlighter so the initial bundle stays small.
const MarkdownView = lazy(() => import('./MarkdownView'))

export function Message({ message }: { message: MessageT }) {
  switch (message.role) {
    case 'user':
      return (
        <div className="chat-widget__row chat-widget__row--user">
          <div className="chat-widget__msg chat-widget__msg--user">{message.content}</div>
        </div>
      )

    case 'assistant':
      return (
        <div className="chat-widget__row chat-widget__row--bot">
          <div className="chat-widget__msg chat-widget__msg--bot">
            <Suspense fallback={<span>{message.content}</span>}>
              <MarkdownView content={message.content} />
            </Suspense>
          </div>
        </div>
      )

    case 'system':
      return <div className="chat-widget__system-note">{message.content}</div>

    case 'error':
      return (
        <div className="chat-widget__row chat-widget__row--bot">
          <div className="chat-widget__msg chat-widget__msg--bot chat-widget__msg--error">
            <div className="chat-widget__error-badge">
              <svg
                className="chat-widget__error-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Error</span>
            </div>
            <div className="chat-widget__error-text">{message.content}</div>
          </div>
        </div>
      )
  }
}
