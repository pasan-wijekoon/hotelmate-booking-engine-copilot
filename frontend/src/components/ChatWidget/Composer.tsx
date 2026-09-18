import { useEffect, useRef, forwardRef, type KeyboardEvent } from 'react'
import { SendIcon, StopIcon } from './icons'

type Props = {
  disabled: boolean
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}

const MAX_HEIGHT = 96

export const Composer = forwardRef<HTMLTextAreaElement, Props>(({ disabled, streaming, onSend, onStop }, ref) => {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  // Merge internal ref with forwarded ref
  const combinedRef = (node: HTMLTextAreaElement | null) => {
    innerRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      (ref as any).current = node
    }
  }

  const autoResize = () => {
    const ta = innerRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`
  }

  useEffect(() => {
    autoResize()
  }, [])

  const send = () => {
    const ta = innerRef.current
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
          ref={combinedRef}
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
})

Composer.displayName = 'Composer'
