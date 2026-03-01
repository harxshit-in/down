import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore'
import { db } from '../lib/firebase'
import VideoPlayer from '../components/video/VideoPlayer'
import Comments from '../components/video/Comments'
import LikeButton from '../components/video/LikeButton'
import { useEffect } from 'react'

async function fetchVideo(id) {
  const snap = await getDoc(doc(db, 'videos', id))
  if (!snap.exists()) throw new Error('Video not found')
  return { id: snap.id, ...snap.data() }
}

export default function VideoPage() {
  const { id } = useParams()
  const { data: video, isLoading, error } = useQuery({
    queryKey: ['video', id],
    queryFn: () => fetchVideo(id),
  })

  // Track view
  useEffect(() => {
    if (!id) return
    updateDoc(doc(db, 'videos', id), { views: increment(1) }).catch(() => {})
  }, [id])

  if (isLoading) return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="aspect-video bg-dark-700 rounded-xl animate-pulse mb-6" />
      <div className="h-7 bg-dark-700 rounded w-1/2 mb-3 animate-pulse" />
      <div className="h-4 bg-dark-700 rounded w-1/3 animate-pulse" />
    </div>
  )

  if (error || !video) return (
    <div className="text-center py-24 text-[var(--text-muted)]">
      <p className="text-lg">Video not found.</p>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Player */}
      {video.playbackUrl ? (
        <VideoPlayer src={video.playbackUrl} poster={video.thumbnail} />
      ) : (
        <div className="aspect-video bg-dark-700 rounded-xl flex items-center justify-center text-[var(--text-muted)]">
          <div className="text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p>Video is being processed…</p>
            <span className="badge bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 mt-2">
              Status: {video.status}
            </span>
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {video.category && (
              <span className="badge bg-brand-500/20 text-brand-400 border border-brand-500/30 mb-2 text-xs">
                {video.category}
              </span>
            )}
            <h1 className="font-display font-bold text-2xl md:text-3xl leading-tight">{video.title}</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              {video.views?.toLocaleString() ?? 0} views
              {video.createdAt && ` · ${new Date(video.createdAt?.toDate?.() ?? video.createdAt).toLocaleDateString()}`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <LikeButton collection="videos" docId={id} initialLikes={video.likes ?? 0} />
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href) }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dark-600 hover:border-brand-500/50 text-[var(--text-muted)] hover:text-white transition-all text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Share
            </button>
            <a
              href={`/embed/${id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dark-600 hover:border-brand-500/50 text-[var(--text-muted)] hover:text-white transition-all text-sm"
            >
              Embed
            </a>
          </div>
        </div>

        {video.description && (
          <div className="mt-4 p-4 bg-dark-800 rounded-xl text-sm text-[var(--text-muted)] leading-relaxed border border-dark-600">
            {video.description}
          </div>
        )}
      </div>

      {/* Comments */}
      <Comments videoId={id} />
    </div>
  )
}
