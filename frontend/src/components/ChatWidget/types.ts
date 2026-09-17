export type Role = 'user' | 'assistant' | 'system' | 'error'

export type Message =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; content: string; streaming?: boolean }
  | { id: string; role: 'system'; content: string }
  | { id: string; role: 'error'; content: string }

export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'no-models'

export type ChatSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
}
