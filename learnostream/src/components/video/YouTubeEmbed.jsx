export default function YouTubeEmbed({ videoId, embedUrl }) {
  const src = embedUrl || `${import.meta.env.VITE_YOUTUBE_EMBED_TEMPLATE || 'https://www.youtube.com/embed/'}${videoId}?autoplay=1&rel=0`
  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <iframe
        src={src}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title="YouTube Live Stream"
      />
    </div>
  )
}
