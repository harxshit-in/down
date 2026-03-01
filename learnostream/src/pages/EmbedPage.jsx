import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import VideoPlayer from '../components/video/VideoPlayer'
import YouTubeEmbed from '../components/video/YouTubeEmbed'

async function fetchContent(id) {
  // Try videos first, then lives
  let snap = await getDoc(doc(db, 'videos', id))
  if (snap.exists()) return { id: snap.id, kind: 'video', ...snap.data() }
  snap = await getDoc(doc(db, 'lives', id))
  if (snap.exists()) return { id: snap.id, kind: 'live', ...snap.data() }
  throw new Error('Not found')
}

export default function EmbedPage() {
  const { id } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['embed', id], queryFn: () => fetchContent(id) })

  if (isLoading) return <div className="w-full aspect-video bg-black animate-pulse" />

  if (!data) return <div className="w-full aspect-video bg-black flex items-center justify-center text-white text-sm">Content unavailable</div>

  return (
    <div className="bg-black min-h-screen">
      {data.playbackUrl ? (
        <VideoPlayer src={data.playbackUrl} poster={data.thumbnail} autoPlay />
      ) : data.youtubeId || data.youtubeEmbedUrl ? (
        <YouTubeEmbed videoId={data.youtubeId} embedUrl={data.youtubeEmbedUrl} />
      ) : (
        <div className="aspect-video bg-black flex items-center justify-center text-white text-sm">
          Stream not available
        </div>
      )}
    </div>
  )
}
