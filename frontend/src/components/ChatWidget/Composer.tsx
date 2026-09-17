import { useEffect, useRef, type KeyboardEvent } from 'react'
import { SendIcon, StopIcon } from './icons'

type Props = {
  disabled: boolean
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}

const MAX_HEIGHT = 96

export function Composer({ disabled, streaming, onSend, onStop }: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  const autoResize = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`
  }

  useEffect(() => {
    autoResize()
  }, [])

  const send = () => {
    const ta = taRef.current
    if (!ta) return
    const text = ta.value.trim()
    if (!text || streaming) return
    onSend(text)
    ta.value = ''
    autoResize()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="chat-widget__composer">
      <div className="chat-widget__composer-inner">
        <textarea
          ref={taRef}
          rows={1}
          placeholder={streaming ? 'HotelMate is replying…' : 'Write a message…'}
          disabled={disabled}
          onInput={autoResize}
          onKeyDown={onKeyDown}
          className="chat-widget__textarea"
        />
        {streaming ? (
          <button
            type="button"
            className="chat-widget__send-btn chat-widget__send-btn--stop"
            aria-label="Stop response"
            onClick={onStop}
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="button"
            className="chat-widget__send-btn"
            aria-label="Send message"
            disabled={disabled}
            onClick={send}
          >
            <SendIcon />
          </button>
        )}
      </div>
    </div>
  )
}
