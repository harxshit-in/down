import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import VideoCard from '../components/video/VideoCard'

const CATEGORIES = ['All', 'Tech', 'Design', 'Business', 'Science', 'Arts']

async function fetchVideos({ category, search }) {
  try {
    // Simple query first — no composite index required
    let q = query(
      collection(db, 'videos'),
      where('status', '==', 'READY'),
      limit(24),
    )
    if (category && category !== 'All') {
      q = query(
        collection(db, 'videos'),
        where('status', '==', 'READY'),
        where('category', '==', category),
        limit(24),
      )
    }
    const snap = await getDocs(q)
    let vids = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    // Client-side sort so we don't need a composite index immediately
    vids.sort((a, b) => {
      const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0)
      const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0)
      return tb - ta
    })
    if (search) {
      const s = search.toLowerCase()
      vids = vids.filter((v) =>
        v.title?.toLowerCase().includes(s) || v.description?.toLowerCase().includes(s)
      )
    }
    return vids
  } catch (err) {
    console.error('fetchVideos error:', err)
    return []
  }
}

async function fetchLives() {
  try {
    const q = query(collection(db, 'lives'), where('status', '==', 'live'), limit(6))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, type: 'live', ...d.data() }))
  } catch (err) {
    console.error('fetchLives error:', err)
    return []
  }
}

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const category = params.get('cat') || 'All'

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos', category, params.get('q')],
    queryFn: () => fetchVideos({ category: category === 'All' ? null : category, search: params.get('q') }),
  })

  const { data: lives = [] } = useQuery({
    queryKey: ['lives-live'],
    queryFn: fetchLives,
    refetchInterval: 30_000,
  })

  const handleSearch = (e) => {
    e.preventDefault()
    setParams((p) => { const n = new URLSearchParams(p); n.set('q', search); return n })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Hero */}
      <section className="relative rounded-3xl overflow-hidden mb-14 bg-gradient-to-br from-dark-700 via-dark-800 to-dark-900 border border-dark-600 p-8 md:p-14">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-brand-700/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="badge bg-brand-500/20 text-brand-400 border border-brand-500/40 mb-4 text-xs">
            🔴 Live learning, on demand
          </div>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl leading-tight mb-4">
            Stream knowledge.<br />
            <span className="text-brand-400">Learn live.</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg mb-8">
            Watch expert-led sessions, attend live classes, and grow your skills—all in one place.
          </p>
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos, topics…"
              className="input flex-1"
            />
            <button type="submit" className="btn-primary shrink-0">Search</button>
          </form>
        </div>
      </section>

      {/* Live now */}
      {lives.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <span className="live-dot" />
            <h2 className="font-display font-bold text-xl">Live Now</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lives.map((live) => <VideoCard key={live.id} video={live} />)}
          </div>
        </section>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('cat', cat); return n })}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
              ${category === cat
                ? 'bg-brand-500 text-white'
                : 'bg-dark-700 text-[var(--text-muted)] hover:text-white border border-dark-600'
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Video grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-video bg-dark-700" />
              <div className="p-3.5 space-y-2">
                <div className="h-4 bg-dark-700 rounded w-3/4" />
                <div className="h-3 bg-dark-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-24 text-[var(--text-muted)]">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-lg font-medium">No videos yet</p>
          <p className="text-sm mt-1">
            {category !== 'All' ? 'Try a different category.' : 'Upload your first video from the admin dashboard.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      )}
    </div>
  )
}
