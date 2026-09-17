import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = { content: string }

export default function MarkdownView({ content }: Props) {
  return (
    <div className="chat-widget__markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: _className, children, ...props }) {
            return (
              <code className="chat-widget__inline-code" {...props}>
                {children}
              </code>
            )
          },
          pre({ children, ...props }) {
            return (
              <pre className="chat-widget__pre-block" {...props}>
                {children}
              </pre>
            )
          },
          a({ children, ...props }) {
            return (
              <a target="_blank" rel="noreferrer noopener" {...props}>
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
