import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const CATEGORIES = ['Tech', 'Design', 'Business', 'Science', 'Arts', 'Other']
const hasLivepeer = !!import.meta.env.VITE_LIVEPEER_API_KEY

export default function ScheduleLivePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode]     = useState(hasLivepeer ? 'livepeer' : 'youtube')
  const [loading, setLoading] = useState(false)
  const [rtmpInfo, setRtmpInfo] = useState(null)

  const [form, setForm] = useState({
    title: '', description: '', category: 'Tech',
    scheduledAt: '', youtubeId: '', youtubeEmbedUrl: '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title required'); return }
    setLoading(true)

    try {
      const docData = {
        title:       form.title.trim(),
        description: form.description.trim(),
        category:    form.category,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt) : null,
        status:      'scheduled',
        provider:    mode,
        createdBy:   user.uid,
        likes:       0,
        viewerCount: 0,
        createdAt:   serverTimestamp(),
      }

      if (mode === 'youtube') {
        docData.youtubeId       = form.youtubeId.trim()
        docData.youtubeEmbedUrl = form.youtubeEmbedUrl.trim() || null
      }

      const docRef = await addDoc(collection(db, 'lives'), docData)

      // Trigger Cloud Function for Livepeer RTMP generation
      if (mode === 'livepeer') {
        try {
          const fn  = httpsCallable(functions, 'onLiveScheduled')
          const res = await fn({ liveId: docRef.id })
          setRtmpInfo(res.data)
        } catch (fnErr) {
          console.warn('Cloud function error:', fnErr)
          toast('Live session created, but RTMP generation failed. Check function logs.', { icon: '⚠️' })
        }
      }

      if (!rtmpInfo) {
        toast.success('Live session scheduled!')
        navigate('/admin')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Show RTMP info after Livepeer creation
  if (rtmpInfo) return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">📡</div>
        <h2 className="font-display font-bold text-2xl mb-2">Stream Ready!</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">Configure your streaming software with these details:</p>
        <div className="bg-dark-900 rounded-xl p-4 text-left space-y-3 text-sm font-mono border border-dark-600">
          <div>
            <span className="text-[var(--text-muted)]">RTMP Server:</span>
            <p className="text-brand-400 break-all mt-0.5">{rtmpInfo.rtmpUrl}</p>
          </div>
          {rtmpInfo.streamKey && (
            <div>
              <span className="text-[var(--text-muted)]">Stream Key:</span>
              <p className="text-white break-all mt-0.5">{rtmpInfo.streamKey}</p>
            </div>
          )}
          {rtmpInfo.playbackUrl && (
            <div>
              <span className="text-[var(--text-muted)]">Playback URL:</span>
              <p className="text-green-400 break-all mt-0.5">{rtmpInfo.playbackUrl}</p>
            </div>
          )}
        </div>
        <button onClick={() => navigate('/admin')} className="btn-primary w-full mt-6">
          Go to Dashboard
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-1">Schedule Live Session</h1>
        <p className="text-[var(--text-muted)] text-sm">Set up a live stream via Livepeer or embed a YouTube Live.</p>
      </div>

      {/* Provider toggle */}
      <div className="flex gap-3 mb-6">
        {hasLivepeer && (
          <button
            type="button"
            onClick={() => setMode('livepeer')}
            className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${mode === 'livepeer' ? 'border-brand-500 bg-brand-500/10 text-brand-400' : 'border-dark-600 text-[var(--text-muted)]'}`}
          >
            🎙 Livepeer Studio
          </button>
        )}
        <button
          type="button"
          onClick={() => setMode('youtube')}
          className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${mode === 'youtube' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-dark-600 text-[var(--text-muted)]'}`}
        >
          ▶ YouTube Live
        </button>
      </div>

      {!hasLivepeer && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-sm">
          <p className="text-blue-400 font-semibold mb-1">ℹ Livepeer not configured</p>
          <p className="text-[var(--text-muted)]">Add <code className="font-mono text-white">VITE_LIVEPEER_API_KEY</code> to enable RTMP streaming via Livepeer. Using YouTube Live embed for now.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Title <span className="text-red-400">*</span></label>
          <input value={form.title} onChange={set('title')} className="input" placeholder="Live session title" required />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Description</label>
          <textarea value={form.description} onChange={set('description')} className="input resize-none h-20" placeholder="What will you cover?" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Category</label>
            <select value={form.category} onChange={set('category')} className="input">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Scheduled Date & Time</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} className="input" />
          </div>
        </div>

        {/* YouTube-specific */}
        {mode === 'youtube' && (
          <div className="space-y-4 p-4 bg-dark-800 rounded-xl border border-dark-600">
            <div>
              <label className="text-sm font-medium mb-1.5 block">YouTube Video/Stream ID</label>
              <input value={form.youtubeId} onChange={set('youtubeId')} className="input" placeholder="e.g. dQw4w9WgXcQ" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Or Full Embed URL (optional)</label>
              <input value={form.youtubeEmbedUrl} onChange={set('youtubeEmbedUrl')} className="input" placeholder="https://www.youtube.com/embed/…" />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Get the embed URL from YouTube Studio → Live Dashboard → Share → Embed.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Scheduling…' : mode === 'livepeer' ? 'Generate RTMP Stream' : 'Schedule Live'}
          </button>
          <button type="button" onClick={() => navigate('/admin')} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  )
}
