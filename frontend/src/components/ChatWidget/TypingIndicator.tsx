export function TypingIndicator() {
  return (
    <div className="chat-widget__typing-row" role="status" aria-label="Assistant is typing">
      <div className="chat-widget__typing">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
