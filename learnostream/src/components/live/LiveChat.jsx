import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'

export default function LiveChat({ liveId }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const q = query(
      collection(db, 'lives', liveId, 'chat'),
      orderBy('createdAt', 'asc'),
      limit(100),
    )
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [liveId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || !user) return
    setSending(true)
    try {
      await addDoc(collection(db, 'lives', liveId, 'chat'), {
        text: text.trim().slice(0, 300),
        uid:  user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Viewer',
        createdAt: serverTimestamp(),
      })
      setText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-dark-600 flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">Live Chat</h3>
        <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">
          <span className="live-dot"></span> Live
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 text-sm">
        {messages.length === 0 && (
          <p className="text-[var(--text-muted)] text-xs text-center mt-8">
            Be the first to chat!
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col">
            <span className="text-brand-400 font-semibold text-xs">{m.name}</span>
            <span className="text-[var(--text)] leading-snug">{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="border-t border-dark-600 p-3 flex gap-2">
        {user ? (
          <>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say something..."
              className="input text-sm py-2 flex-1"
              maxLength={300}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="btn-primary text-sm py-2 px-3 shrink-0"
            >
              Send
            </button>
          </>
        ) : (
          <p className="text-xs text-[var(--text-muted)] text-center w-full py-2">
            <a href="/login" className="text-brand-400 hover:underline">Sign in</a> to chat
          </p>
        )}
      </form>
    </div>
  )
}
