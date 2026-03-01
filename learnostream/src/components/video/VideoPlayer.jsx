import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

export default function VideoPlayer({ src, poster, autoPlay = false }) {
  const videoRef = useRef(null)
  const hlsRef   = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!src || !video) return

    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play().catch(() => {})
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = src
      if (autoPlay) video.play().catch(() => {})
    } else {
      // Fallback for non-HLS
      video.src = src
      if (autoPlay) video.play().catch(() => {})
    }

    return () => {
      hlsRef.current?.destroy()
    }
  }, [src, autoPlay])

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        poster={poster}
        controls
        className="w-full h-full"
        playsInline
      />
    </div>
  )
}
