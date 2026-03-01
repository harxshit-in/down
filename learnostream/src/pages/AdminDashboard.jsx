import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

async function fetchStats() {
  const [videoSnap, liveSnap] = await Promise.all([
    getDocs(query(collection(db, 'videos'), limit(10))),
    getDocs(query(collection(db, 'lives'),  limit(10))),
  ])
  const videos = videoSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const lives  = liveSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  videos.sort((a,b) => (b.createdAt?.toDate?.()??0) - (a.createdAt?.toDate?.()??0))
  lives.sort((a,b)  => (b.createdAt?.toDate?.()??0) - (a.createdAt?.toDate?.()??0))
  const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0)
  return { videos, lives, totalViews }
}

const statusColor = {
  READY:      'bg-green-500/20 text-green-400 border-green-500/30',
  PROCESSING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PENDING:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ERROR:      'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: fetchStats })

  const stats = [
    { label: 'Videos',       value: data?.videos.length ?? '—', icon: '🎬' },
    { label: 'Live Sessions', value: data?.lives.length  ?? '—', icon: '📡' },
    { label: 'Total Views',   value: data?.totalViews?.toLocaleString() ?? '—', icon: '👁' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl">Admin Dashboard</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Manage content and live sessions</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/upload" className="btn-ghost flex items-center gap-2 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Upload Video
          </Link>
          <Link to="/admin/go-live" className="btn-primary flex items-center gap-2 text-sm bg-red-600 hover:bg-red-700">
            <span className="live-dot" />
            Go Live Now
          </Link>
        </div>
      </div>

      {/* Go Live banner */}
      <div className="card p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-red-500/20 bg-gradient-to-r from-red-950/30 to-dark-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center text-3xl shrink-0">📡</div>
          <div>
            <h2 className="font-display font-bold text-lg">Start a Live Stream</h2>
            <p className="text-[var(--text-muted)] text-sm">
              Stream directly from your browser. Viewers watch live via WebRTC.
              Recording saves automatically to your phone server.
            </p>
          </div>
        </div>
        <Link to="/admin/go-live" className="shrink-0 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors flex items-center gap-2">
          <span className="live-dot" /> Go Live
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="card p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-500/15 rounded-xl flex items-center justify-center text-2xl">{s.icon}</div>
            <div>
              <div className="text-2xl font-display font-bold">{s.value}</div>
              <div className="text-sm text-[var(--text-muted)]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent videos */}
      <section className="mb-10">
        <h2 className="font-display font-semibold text-xl mb-4">Recent Videos</h2>
        {isLoading ? (
          <div className="space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-14 bg-dark-700 rounded-xl animate-pulse"/>)}</div>
        ) : (
          <div className="card divide-y divide-dark-600">
            {data?.videos.length === 0 && (
              <p className="text-[var(--text-muted)] text-sm p-4">
                No videos yet. <Link to="/admin/upload" className="text-brand-400 hover:underline">Upload one</Link> or <Link to="/admin/go-live" className="text-red-400 hover:underline">go live</Link>.
              </p>
            )}
            {data?.videos.map((v) => (
              <div key={v.id} className="flex items-center gap-4 p-4">
                <div className="w-16 h-10 rounded bg-dark-700 overflow-hidden shrink-0">
                  {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{v.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{v.views ?? 0} views · {v.category} {v.type === 'recorded-live' ? '· 🔴 Recorded' : ''}</p>
                </div>
                <span className={`badge border text-xs ${statusColor[v.status] || statusColor.PENDING}`}>{v.status}</span>
                <Link to={`/video/${v.id}`} className="text-xs text-brand-400 hover:underline shrink-0">View</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Live sessions */}
      <section>
        <h2 className="font-display font-semibold text-xl mb-4">Live Sessions</h2>
        <div className="card divide-y divide-dark-600">
          {data?.lives.length === 0 && (
            <p className="text-[var(--text-muted)] text-sm p-4">
              No live sessions yet. <Link to="/admin/go-live" className="text-red-400 hover:underline">Start one now</Link>.
            </p>
          )}
          {data?.lives.map((l) => (
            <div key={l.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{l.title}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {l.createdAt ? new Date(l.createdAt?.toDate?.() ?? l.createdAt).toLocaleString() : ''}
                  {l.provider === 'webrtc' ? ' · WebRTC' : ''}
                </p>
              </div>
              <span className={`badge border text-xs ${
                l.status === 'live'    ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                l.status === 'ended'   ? 'bg-dark-700 text-[var(--text-muted)] border-dark-600' :
                                         'bg-blue-500/20 text-blue-400 border-blue-500/30'
              }`}>
                {l.status === 'live' ? <><span className="live-dot mr-1"/>LIVE</> : l.status}
              </span>
              <Link to={`/live/${l.id}`} className="text-xs text-brand-400 hover:underline shrink-0">View</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
