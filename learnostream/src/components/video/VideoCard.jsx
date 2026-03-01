import { Link } from 'react-router-dom'

export default function VideoCard({ video }) {
  const isLive = video.type === 'live'
  const href   = isLive ? `/live/${video.id}` : `/video/${video.id}`

  return (
    <Link to={href} className="card group block hover:border-brand-500/50 transition-colors duration-200">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-dark-700 overflow-hidden">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-dark-500">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {isLive && (
            <span className="badge bg-red-600 text-white gap-1.5">
              <span className="live-dot"></span> LIVE
            </span>
          )}
          {video.category && (
            <span className="badge bg-dark-900/80 text-[var(--text-muted)] border border-dark-600">
              {video.category}
            </span>
          )}
        </div>

        {/* Duration */}
        {video.duration && !isLive && (
          <span className="absolute bottom-2 right-2 badge bg-dark-900/80 text-white font-mono text-xs">
            {video.duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-brand-400 transition-colors">
          {video.title}
        </h3>
        {video.description && (
          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{video.description}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {video.views != null && <span>{video.views.toLocaleString()} views</span>}
          {video.likes != null && <span>❤ {video.likes}</span>}
        </div>
      </div>
    </Link>
  )
}
