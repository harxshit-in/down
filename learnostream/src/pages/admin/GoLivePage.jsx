import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const CATEGORIES = ['Tech', 'Design', 'Business', 'Science', 'Arts', 'Other']
const SERVER_URL  = import.meta.env.VITE_PHONE_SERVER_URL || 'ws://localhost:3001'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export default function GoLivePage() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  // Form
  const [title, setTitle]           = useState('')
  const [description, setDesc]      = useState('')
  const [category, setCategory]     = useState('Tech')

  // Stream state
  const [phase, setPhase]           = useState('setup')   // setup | preview | live | ended
  const [liveId, setLiveId]         = useState(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [duration, setDuration]     = useState(0)
  const [recordingSize, setRecSize] = useState(0)

  // Refs
  const localVideoRef   = useRef(null)
  const wsRef           = useRef(null)
  const streamRef       = useRef(null)
  const mediaRecRef     = useRef(null)
  const peersRef        = useRef({})   // viewerId → RTCPeerConnection
  const timerRef        = useRef(null)
  const liveDocIdRef    = useRef(null)

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => { stopEverything(true) }, [])

  // ── Get camera/mic preview ───────────────────────────────────────────────
  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      setPhase('preview')
    } catch (err) {
      toast.error('Camera/mic access denied: ' + err.message)
    }
  }

  // ── Switch camera ────────────────────────────────────────────────────────
  const switchCamera = async () => {
    if (!streamRef.current) return
    const current  = streamRef.current.getVideoTracks()[0]
    const facing   = current?.getSettings().facingMode
    const newFacing = facing === 'user' ? 'environment' : 'user'
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: true,
      })
      // Replace track in all peer connections
      const newTrack = newStream.getVideoTracks()[0]
      for (const pc of Object.values(peersRef.current)) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        sender?.replaceTrack(newTrack)
      }
      // Update local preview
      current.stop()
      streamRef.current.removeTrack(current)
      streamRef.current.addTrack(newTrack)
      if (localVideoRef.current) localVideoRef.current.srcObject = streamRef.current
    } catch (e) {
      toast.error('Could not switch camera')
    }
  }

  // ── Start going live ─────────────────────────────────────────────────────
  const goLive = async () => {
    if (!title.trim()) { toast.error('Enter a title first'); return }
    if (!streamRef.current)  { toast.error('No camera stream'); return }

    // 1. Create Firestore live document
    const docRef = await addDoc(collection(db, 'lives'), {
      title:       title.trim(),
      description: description.trim(),
      category,
      status:      'scheduled',
      provider:    'webrtc',
      createdBy:   user.uid,
      likes:       0,
      viewerCount: 0,
      serverUrl:   SERVER_URL.replace('ws://', 'http://').replace('wss://', 'https://'),
      createdAt:   serverTimestamp(),
    })
    const id = docRef.id
    setLiveId(id)
    liveDocIdRef.current = id

    // 2. Connect to phone server WebSocket
    const wsUrl = SERVER_URL.startsWith('http')
      ? SERVER_URL.replace('http', 'ws')
      : SERVER_URL

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', liveId: id, data: { role: 'broadcaster' } }))
    }

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data)

      if (msg.type === 'joined') {
        // Start recording via MediaRecorder
        startRecording(id)
        setPhase('live')
        // Start duration timer
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
        toast.success('🔴 You are live!')
      }

      else if (msg.type === 'viewer-joined') {
        // Create RTCPeerConnection for this viewer
        const pc = createPeerConnection(id, msg.viewerId, ws)
        peersRef.current[msg.viewerId] = pc
        // Create offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        ws.send(JSON.stringify({
          type: 'offer', liveId: id,
          data: { sdp: offer, viewerId: msg.viewerId },
        }))
        setViewerCount(v => v + 1)
      }

      else if (msg.type === 'answer') {
        const pc = peersRef.current[msg.viewerId]
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        }
      }

      else if (msg.type === 'ice-candidate') {
        const pc = peersRef.current[msg.viewerId] || Object.values(peersRef.current)[0]
        if (pc && msg.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch {}
        }
      }

      else if (msg.type === 'viewer-left') {
        setViewerCount(v => Math.max(0, v - 1))
        peersRef.current[msg.viewerId]?.close()
        delete peersRef.current[msg.viewerId]
      }

      else if (msg.type === 'error') {
        toast.error(msg.message)
      }
    }

    ws.onerror = () => toast.error('Server connection failed. Is the phone server running?')
    ws.onclose = () => {
      if (phase === 'live') toast('Connection to server closed')
    }
  }

  // ── Create WebRTC peer connection for a viewer ────────────────────────────
  const createPeerConnection = (liveId, viewerId, ws) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add all tracks from our stream
    for (const track of streamRef.current.getTracks()) {
      pc.addTrack(track, streamRef.current)
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({
          type: 'ice-candidate', liveId,
          data: { candidate: e.candidate, viewerId },
        }))
      }
    }

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        delete peersRef.current[viewerId]
        setViewerCount(v => Math.max(0, v - 1))
      }
    }

    return pc
  }

  // ── MediaRecorder: send chunks to phone server ───────────────────────────
  const startRecording = (id) => {
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm'

    const rec = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: 1_500_000,
    })
    mediaRecRef.current = rec

    rec.ondataavailable = (e) => {
      if (e.data.size === 0 || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      // Convert chunk to base64 and send to server for storage
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        setRecSize(s => s + e.data.size)
        wsRef.current.send(JSON.stringify({
          type: 'recording-chunk',
          liveId: id,
          data: { chunk: base64 },
        }))
      }
      reader.readAsDataURL(e.data)
    }

    rec.start(2000) // send chunk every 2 seconds
  }

  // ── Stop stream ───────────────────────────────────────────────────────────
  const stopEverything = useCallback(async (silent = false) => {
    clearInterval(timerRef.current)

    mediaRecRef.current?.stop()
    mediaRecRef.current = null

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop', liveId: liveDocIdRef.current }))
      wsRef.current.close()
    }
    wsRef.current = null

    for (const pc of Object.values(peersRef.current)) pc.close()
    peersRef.current = {}

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    if (!silent) {
      setPhase('ended')
      if (!silent) toast.success('Stream ended. Recording saved!')
    }
  }, [])

  const endStream = async () => {
    await stopEverything()
    // Navigate to admin after short delay
    setTimeout(() => navigate('/admin'), 2500)
  }

  // ── Duration formatter ────────────────────────────────────────────────────
  const fmtDuration = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `${m}:${String(sec).padStart(2,'0')}`
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1">Go Live</h1>
          <p className="text-[var(--text-muted)] text-sm">Stream directly from your browser — no extra software needed</p>
        </div>
        {phase === 'live' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 px-3 py-1.5 rounded-full">
              <span className="live-dot" />
              <span className="text-red-400 font-semibold text-sm">LIVE · {fmtDuration(duration)}</span>
            </div>
            <div className="text-sm text-[var(--text-muted)]">👁 {viewerCount} watching</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Video preview */}
        <div className="lg:col-span-3">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {phase === 'setup' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dark-900/80">
                <div className="text-5xl">📷</div>
                <p className="text-[var(--text-muted)] text-sm">Camera preview will appear here</p>
                <button onClick={startPreview} className="btn-primary">
                  Enable Camera & Mic
                </button>
              </div>
            )}

            {phase === 'ended' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-dark-900/90">
                <div className="text-5xl">✅</div>
                <p className="font-display font-bold text-xl">Stream Ended</p>
                <p className="text-[var(--text-muted)] text-sm">Recording saved to your phone server</p>
                <p className="text-sm text-brand-400">{(recordingSize / 1024 / 1024).toFixed(1)} MB recorded</p>
              </div>
            )}

            {/* Live overlay */}
            {phase === 'live' && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="badge bg-red-600 text-white text-xs"><span className="live-dot mr-1" />LIVE</span>
              </div>
            )}

            {/* Camera switch button (mobile) */}
            {(phase === 'preview' || phase === 'live') && (
              <button
                onClick={switchCamera}
                className="absolute bottom-3 right-3 bg-dark-900/70 border border-dark-600 rounded-full p-2.5 text-white hover:bg-dark-800 transition-colors"
                title="Switch camera"
              >
                🔄
              </button>
            )}
          </div>

          {/* Recording size indicator */}
          {phase === 'live' && recordingSize > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording: {(recordingSize / 1024 / 1024).toFixed(1)} MB saved to phone
            </div>
          )}
        </div>

        {/* Controls panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stream info form */}
          <div className={`card p-5 space-y-4 ${phase === 'live' ? 'opacity-60 pointer-events-none' : ''}`}>
            <h3 className="font-semibold">Stream Info</h3>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title <span className="text-red-400">*</span></label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="input text-sm"
                placeholder="What are you streaming?"
                disabled={phase === 'live'}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <textarea
                value={description}
                onChange={e => setDesc(e.target.value)}
                className="input text-sm resize-none h-16"
                placeholder="Tell viewers what to expect…"
                disabled={phase === 'live'}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="input text-sm" disabled={phase === 'live'}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            {phase === 'setup' && (
              <button onClick={startPreview} className="btn-primary w-full py-3 text-base">
                📷 Enable Camera
              </button>
            )}

            {phase === 'preview' && (
              <button onClick={goLive} className="btn-primary w-full py-3 text-base bg-red-600 hover:bg-red-700">
                🔴 Go Live
              </button>
            )}

            {phase === 'live' && (
              <>
                <div className="p-3 bg-dark-800 rounded-xl border border-dark-600 text-xs text-[var(--text-muted)] space-y-1.5">
                  <div className="flex justify-between">
                    <span>Stream URL</span>
                    <a href={`/live/${liveId}`} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                      View page →
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span>Viewers</span>
                    <span className="text-white font-semibold">{viewerCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <span className="font-mono text-white">{fmtDuration(duration)}</span>
                  </div>
                </div>
                <button
                  onClick={endStream}
                  className="w-full py-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 hover:bg-red-900/50 transition-colors font-semibold"
                >
                  ⏹ End Stream
                </button>
              </>
            )}

            {phase === 'ended' && (
              <button onClick={() => navigate('/admin')} className="btn-primary w-full py-3">
                Back to Dashboard
              </button>
            )}
          </div>

          {/* Server status */}
          <ServerStatus serverUrl={SERVER_URL} />
        </div>
      </div>

      {/* Share link while live */}
      {phase === 'live' && liveId && (
        <div className="mt-6 p-4 bg-brand-500/10 border border-brand-500/30 rounded-xl flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-400 mb-0.5">Share your stream</p>
            <p className="text-xs text-[var(--text-muted)] font-mono break-all">
              {window.location.origin}/live/{liveId}
            </p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/live/${liveId}`); toast.success('Link copied!') }}
            className="btn-ghost text-sm shrink-0"
          >
            Copy Link
          </button>
        </div>
      )}
    </div>
  )
}

// Server status indicator
function ServerStatus({ serverUrl }) {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const httpUrl = serverUrl
      .replace('wss://', 'https://')
      .replace('ws://', 'http://')

    fetch(`${httpUrl}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? setStatus('online') : setStatus('error'))
      .catch(() => setStatus('offline'))
  }, [serverUrl])

  const colors = { online: 'text-green-400', offline: 'text-red-400', error: 'text-yellow-400', checking: 'text-[var(--text-muted)]' }
  const labels = { online: '● Server online', offline: '● Server offline', error: '● Server error', checking: '○ Checking server…' }

  return (
    <div className={`text-xs ${colors[status]} flex items-center justify-between`}>
      <span>{labels[status]}</span>
      {status === 'offline' && (
        <a href="#setup" className="text-brand-400 hover:underline">Setup guide ↓</a>
      )}
    </div>
  )
}
