import { useState, useEffect } from 'react'
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function Comments({ videoId }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)

  useEffect(() => {
    const q = query(
      collection(db, 'videos', videoId, 'comments'),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [videoId])

  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim() || !user) return
    setSending(true)
    try {
      await addDoc(collection(db, 'videos', videoId, 'comments'), {
        text: text.trim().slice(0, 500),
        uid:  user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Viewer',
        createdAt: serverTimestamp(),
      })
      setText('')
    } catch {
      toast.error('Failed to post comment')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="mt-8">
      <h2 className="font-display font-semibold text-lg mb-4">
        Comments <span className="text-[var(--text-muted)] font-normal text-base">({comments.length})</span>
      </h2>

      {user ? (
        <form onSubmit={submit} className="flex gap-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 font-semibold shrink-0">
            {(user.displayName || user.email)?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment..."
              className="input resize-none text-sm h-20"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="btn-primary text-sm self-end"
            >
              {sending ? 'Posting…' : 'Post Comment'}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-[var(--text-muted)] text-sm mb-6">
          <a href="/login" className="text-brand-400 hover:underline">Sign in</a> to comment.
        </p>
      )}

      <div className="space-y-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center text-sm font-semibold shrink-0">
              {c.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{c.name}</span>
                {c.createdAt && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {c.createdAt.toDate?.().toLocaleDateString() ?? ''}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-0.5 leading-relaxed">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
