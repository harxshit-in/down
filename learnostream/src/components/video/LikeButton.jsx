import { useState, useEffect } from 'react'
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function LikeButton({ collection: col, docId, initialLikes = 0 }) {
  const { user } = useAuth()
  const [likes, setLikes]   = useState(initialLikes)
  const [liked, setLiked]   = useState(false)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (!user) { toast.error('Sign in to like'); return }
    if (loading) return
    setLoading(true)
    try {
      const ref = doc(db, col, docId)
      const delta = liked ? -1 : 1
      await updateDoc(ref, { likes: increment(delta) })
      setLikes((l) => l + delta)
      setLiked(!liked)
    } catch {
      toast.error('Action failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 text-sm font-medium
        ${liked
          ? 'bg-brand-500/20 border-brand-500/60 text-brand-400'
          : 'border-dark-600 text-[var(--text-muted)] hover:border-brand-500/50 hover:text-white'
        }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      {likes.toLocaleString()}
    </button>
  )
}
