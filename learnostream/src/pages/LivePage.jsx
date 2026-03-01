import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import VideoPlayer from '../components/video/VideoPlayer'
import YouTubeEmbed from '../components/video/YouTubeEmbed'
import LiveChat from '../components/live/LiveChat'
import LikeButton from '../components/video/LikeButton'
import WebRTCViewer from '../components/live/WebRTCViewer'

async function fetchLive(id) {
  const snap = await getDoc(doc(db, 'lives', id))
  if (!snap.exists()) throw new Error('Not found')
  return { id: snap.id, ...snap.data() }
}

export default function LivePage() {
  const { id } = useParams()
  const { data: live, isLoading } = useQuery({
    queryKey: ['live', id],
    queryFn: () => fetchLive(id),
    refetchInterval: 10_000,
  })

  if (isLoading) return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="aspect-video bg-dark-700 rounded-xl animate-pulse" />
    </div>
  )

  if (!live) return (
    <div className="text-center py-24 text-[var(--text-muted)]">
      <div className="text-5xl mb-4">📡</div>
      <p>Live session not found.</p>
    </div>
  )

  const isLive    = live.status === 'live'
  const isEnded   = live.status === 'ended'
  const isWebRTC  = live.provider === 'webrtc'

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main player */}
        <div className="lg:col-span-2">

          {/* WebRTC live stream */}
          {isWebRTC && isLive && live.serverUrl && (
            <WebRTCViewer liveId={id} serverUrl={live.serverUrl} />
          )}

          {/* Ended — show recording */}
          {isEnded && live.recordingUrl && (
            <VideoPlayer src={live.recordingUrl} poster={live.thumbnail} />
          )}

          {/* HLS playback (Livepeer) */}
          {!isWebRTC && live.playbackUrl && (
            <VideoPlayer src={live.playbackUrl} autoPlay={isLive} />
          )}

          {/* YouTube embed */}
          {(live.youtubeId || live.youtubeEmbedUrl) && !isWebRTC && (
            <YouTubeEmbed videoId={live.youtubeId} embedUrl={live.youtubeEmbedUrl} />
          )}

          {/* Waiting / not started */}
          {!isLive && !isEnded && !live.playbackUrl && !live.youtubeId && (
            <div className="aspect-video bg-dark-800 rounded-xl border border-dark-600 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <div className="text-5xl">📡</div>
              <p className="font-semibold">Stream not started yet</p>
              {live.scheduledAt && (
                <p className="text-sm">
                  Scheduled: {new Date(live.scheduledAt?.toDate?.() ?? live.scheduledAt).toLocaleString()}
                </p>
              )}
              <p className="text-xs">This page will update automatically when the stream begins.</p>
            </div>
          )}

          {/* Meta */}
          <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {isLive && (
                  <span className="badge bg-red-600 text-white text-xs">
                    <span className="live-dot mr-1" /> LIVE
                  </span>
                )}
                {isEnded && (
                  <span className="badge bg-dark-600 text-[var(--text-muted)] text-xs border border-dark-500">
                    ⏺ Recorded
                  </span>
                )}
                {live.category && (
                  <span className="badge bg-dark-700 text-[var(--text-muted)] border border-dark-600 text-xs">
                    {live.category}
                  </span>
                )}
              </div>
              <h1 className="font-display font-bold text-2xl">{live.title}</h1>
              {isLive && live.viewerCount > 0 && (
                <p className="text-sm text-[var(--text-muted)] mt-1">~{live.viewerCount} watching</p>
              )}
            </div>
            <LikeButton collection="lives" docId={id} initialLikes={live.likes ?? 0} />
          </div>

          {live.description && (
            <div className="mt-4 p-4 bg-dark-800 rounded-xl text-sm text-[var(--text-muted)] border border-dark-600 leading-relaxed">
              {live.description}
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        <div className="lg:col-span-1">
          <LiveChat liveId={id} readOnly={isEnded} />
        </div>
      </div>
    </div>
  )
}

