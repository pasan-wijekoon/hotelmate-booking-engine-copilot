
import { useEffect, useRef } from 'react'
import type { Message as MessageT } from './types'
import { Message } from './Message'
import { TypingIndicator } from './TypingIndicator'
import { useAutoScroll } from '../../hooks/useAutoScroll'

type Props = {
  messages: MessageT[]
  streaming: boolean
  onSelectSuggestion: (text: string) => Promise<void>
}

export function Messages({
  messages,
  streaming,
}: Props) {
  // Show typing indicator only while streaming
  // and the last message is from the user.
  const last = messages[messages.length - 1]
  const showTyping = streaming && last?.role === 'user'

  const { ref } = useAutoScroll<HTMLDivElement>([
    messages,
    streaming,
  ])

  // After mount, scroll to the bottom on the first render
  // so persisted conversation history opens at the end.
  const didInitialScroll = useRef(false)

  useEffect(() => {
    if (didInitialScroll.current) {
      return
    }

    didInitialScroll.current = true

    const element = ref.current

    if (element) {
      element.scrollTop = element.scrollHeight
    }
  }, [ref])

 

  return (
    <div
      className="chat-widget__messages"
      ref={ref}
    >
      {messages.length === 0 && (
        <div className="chat-widget__welcome-card">
          <div className="chat-widget__welcome-avatar">
            <img
              src="/favicon.png"
              alt="HotelMate"
            />
          </div>

          <h2 className="chat-widget__welcome-title">
            Welcome to Hotel ABC
          </h2>

          <p className="chat-widget__welcome-desc">
            How can we make your stay more comfortable today?
          </p>

         
        </div>
      )}

      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
        />
      ))}

      {showTyping && <TypingIndicator />}
    </div>
  )
}
