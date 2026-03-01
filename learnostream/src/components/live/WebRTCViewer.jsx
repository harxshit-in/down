import { useEffect, useRef, useState } from 'react'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export default function WebRTCViewer({ liveId, serverUrl }) {
  const videoRef = useRef(null)
  const wsRef    = useRef(null)
  const pcRef    = useRef(null)
  const [connState, setConnState] = useState('connecting') // connecting | live | ended | error

  useEffect(() => {
    let destroyed = false

    const wsUrl = serverUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (destroyed) return
      ws.send(JSON.stringify({ type: 'join', liveId, data: { role: 'viewer' } }))
    }

    ws.onmessage = async (event) => {
      if (destroyed) return
      const msg = JSON.parse(event.data)

      if (msg.type === 'joined') {
        if (!msg.hasBroadcaster) {
          setConnState('waiting')
        }
      }

      else if (msg.type === 'offer') {
        // Create peer connection
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        pcRef.current = pc

        pc.ontrack = (e) => {
          if (videoRef.current && e.streams[0]) {
            videoRef.current.srcObject = e.streams[0]
            setConnState('live')
          }
        }

        pc.onicecandidate = (e) => {
          if (e.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ice-candidate',
              liveId,
              data: { candidate: e.candidate },
            }))
          }
        }

        pc.onconnectionstatechange = () => {
          if (['disconnected', 'failed'].includes(pc.connectionState)) {
            setConnState('ended')
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        ws.send(JSON.stringify({
          type: 'answer',
          liveId,
          data: { sdp: answer },
        }))
      }

      else if (msg.type === 'ice-candidate') {
        try {
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(msg.candidate))
        } catch {}
      }

      else if (msg.type === 'stream-ended') {
        setConnState('ended')
        if (videoRef.current) videoRef.current.srcObject = null
      }
    }

    ws.onerror = () => setConnState('error')
    ws.onclose = () => {
      if (!destroyed && connState !== 'ended') setConnState('ended')
    }

    return () => {
      destroyed = true
      pcRef.current?.close()
      if (ws.readyState === WebSocket.OPEN) ws.close()
    }
  }, [liveId, serverUrl])

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-500 ${connState === 'live' ? 'opacity-100' : 'opacity-0'}`}
      />

      {connState !== 'live' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
          {connState === 'connecting' || connState === 'waiting' ? (
            <>
              <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">{connState === 'connecting' ? 'Connecting to stream…' : 'Waiting for broadcaster…'}</p>
            </>
          ) : connState === 'ended' ? (
            <>
              <div className="text-4xl">📴</div>
              <p className="font-semibold">Stream has ended</p>
              <p className="text-xs">The recording will appear on this page shortly.</p>
            </>
          ) : (
            <>
              <div className="text-4xl">⚠️</div>
              <p className="font-semibold text-red-400">Connection failed</p>
              <button onClick={() => window.location.reload()} className="btn-ghost text-sm">Retry</button>
            </>
          )}
        </div>
      )}

      {connState === 'live' && (
        <div className="absolute top-3 left-3">
          <span className="badge bg-red-600 text-white text-xs"><span className="live-dot mr-1" />LIVE</span>
        </div>
      )}
    </div>
  )
}
