/**
 * LearnoStream Phone Media Server
 * ================================
 * Runs on your old Android phone (via Termux or any Node environment).
 * Handles:
 *  - WebRTC signaling (broadcaster ↔ viewers via WebSocket)
 *  - Recording incoming MediaRecorder chunks → local .webm files
 *  - Serving recorded videos back to viewers
 *  - Updating Firestore live/video docs with status & playback URL
 */

require('dotenv').config()

const express   = require('express')
const http      = require('http')
const WebSocket = require('ws')
const cors      = require('cors')
const path      = require('path')
const fs        = require('fs')
const { v4: uuidv4 } = require('uuid')
const admin     = require('firebase-admin')

// ─── Firebase Admin Init ────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
})
const db = admin.firestore()

// ─── Setup ──────────────────────────────────────────────────────────────────
const app        = express()
const server     = http.createServer(app)
const wss        = new WebSocket.Server({ server })
const PORT       = process.env.PORT || 3001
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '')
const REC_DIR    = path.resolve(process.env.RECORDINGS_DIR || './recordings')

if (!fs.existsSync(REC_DIR)) fs.mkdirSync(REC_DIR, { recursive: true })

app.use(cors({ origin: '*' }))
app.use(express.json())

// Serve recordings publicly so Vercel app can embed them
app.use('/recordings', express.static(REC_DIR, {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Accept-Ranges', 'bytes')
  }
}))

// ─── State ──────────────────────────────────────────────────────────────────
// rooms[liveId] = { broadcaster: ws, viewers: Set<ws>, recordChunks: [], fileStream, filename, startedAt }
const rooms = {}

function getRoom(liveId) {
  if (!rooms[liveId]) {
    rooms[liveId] = {
      broadcaster:  null,
      viewers:      new Set(),
      recordChunks: [],
      fileStream:   null,
      filename:     null,
      startedAt:    null,
    }
  }
  return rooms[liveId]
}

function broadcastToViewers(liveId, message, excludeWs = null) {
  const room = rooms[liveId]
  if (!room) return
  const data = JSON.stringify(message)
  for (const viewer of room.viewers) {
    if (viewer !== excludeWs && viewer.readyState === WebSocket.OPEN) {
      viewer.send(data)
    }
  }
}

// ─── WebSocket Signaling ─────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  let myLiveId = null
  let myRole   = null  // 'broadcaster' | 'viewer'
  let viewerId = uuidv4()

  ws.on('message', async (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    const { type, liveId, data } = msg

    // ── JOIN ──────────────────────────────────────────────────────────────
    if (type === 'join') {
      myLiveId = liveId
      myRole   = data.role
      const room = getRoom(liveId)

      if (myRole === 'broadcaster') {
        // Only one broadcaster per room
        if (room.broadcaster && room.broadcaster.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room already has a broadcaster' }))
          ws.close()
          return
        }
        room.broadcaster = ws
        room.startedAt   = new Date()

        // Start recording file
        const filename  = `${liveId}_${Date.now()}.webm`
        room.filename   = filename
        room.fileStream = fs.createWriteStream(path.join(REC_DIR, filename))

        // Update Firestore: status = live
        try {
          await db.collection('lives').doc(liveId).update({
            status:      'live',
            serverUrl:   PUBLIC_URL,
            startedAt:   admin.firestore.FieldValue.serverTimestamp(),
          })
        } catch (e) { console.error('Firestore update failed:', e.message) }

        ws.send(JSON.stringify({ type: 'joined', role: 'broadcaster', viewerCount: room.viewers.size }))
        console.log(`[${liveId}] Broadcaster connected`)

      } else {
        // Viewer
        room.viewers.add(ws)
        ws.send(JSON.stringify({
          type: 'joined',
          role: 'viewer',
          hasBroadcaster: !!room.broadcaster && room.broadcaster.readyState === WebSocket.OPEN,
        }))

        // Tell broadcaster a new viewer arrived (for WebRTC offer)
        if (room.broadcaster && room.broadcaster.readyState === WebSocket.OPEN) {
          room.broadcaster.send(JSON.stringify({ type: 'viewer-joined', viewerId }))
        }

        // Update viewer count in Firestore (debounced via simple counter)
        updateViewerCount(liveId, room.viewers.size)
        console.log(`[${liveId}] Viewer joined (total: ${room.viewers.size})`)
      }
    }

    // ── RECORDING CHUNK from broadcaster ─────────────────────────────────
    else if (type === 'recording-chunk') {
      const room = rooms[liveId]
      if (!room || !room.fileStream) return
      // data is base64-encoded chunk
      try {
        const buf = Buffer.from(data.chunk, 'base64')
        room.fileStream.write(buf)
      } catch (e) { console.error('Write chunk error:', e.message) }
    }

    // ── WebRTC Signaling: offer / answer / ice-candidate ─────────────────
    else if (type === 'offer') {
      // Broadcaster → specific viewer (or all if no viewerId)
      const room = rooms[liveId]
      if (!room) return
      const target = data.viewerId
      for (const viewer of room.viewers) {
        if (!target || viewer._viewerId === target) {
          if (viewer.readyState === WebSocket.OPEN) {
            viewer.send(JSON.stringify({ type: 'offer', sdp: data.sdp }))
          }
        }
      }
    }
    else if (type === 'answer') {
      // Viewer → broadcaster
      const room = rooms[liveId]
      if (room?.broadcaster?.readyState === WebSocket.OPEN) {
        room.broadcaster.send(JSON.stringify({ type: 'answer', sdp: data.sdp, viewerId }))
      }
    }
    else if (type === 'ice-candidate') {
      const room = rooms[liveId]
      if (!room) return
      if (myRole === 'broadcaster') {
        // broadcaster's ICE → all viewers
        broadcastToViewers(liveId, { type: 'ice-candidate', candidate: data.candidate })
      } else {
        // viewer's ICE → broadcaster
        if (room.broadcaster?.readyState === WebSocket.OPEN) {
          room.broadcaster.send(JSON.stringify({ type: 'ice-candidate', candidate: data.candidate, viewerId }))
        }
      }
    }

    // ── STOP STREAM ───────────────────────────────────────────────────────
    else if (type === 'stop') {
      await handleBroadcasterLeft(liveId, ws)
    }
  })

  // Store viewerId on the ws object for targeting
  ws._viewerId = viewerId

  ws.on('close', async () => {
    if (!myLiveId) return
    const room = rooms[myLiveId]
    if (!room) return

    if (myRole === 'broadcaster') {
      await handleBroadcasterLeft(myLiveId, ws)
    } else {
      room.viewers.delete(ws)
      broadcastToViewers(myLiveId, { type: 'viewer-left', viewerId })
      updateViewerCount(myLiveId, room.viewers.size)
      console.log(`[${myLiveId}] Viewer left (total: ${room.viewers.size})`)
    }
  })

  ws.on('error', (err) => console.error('WS error:', err.message))
})

// ─── Helpers ────────────────────────────────────────────────────────────────
async function handleBroadcasterLeft(liveId, ws) {
  const room = rooms[liveId]
  if (!room) return

  console.log(`[${liveId}] Broadcaster disconnected, finalizing recording…`)

  // Close recording file
  if (room.fileStream) {
    room.fileStream.end()
    room.fileStream = null
  }

  // Tell all viewers stream ended
  broadcastToViewers(liveId, { type: 'stream-ended' })

  // Build playback URL for the recording
  const playbackUrl = room.filename
    ? `${PUBLIC_URL}/recordings/${room.filename}`
    : null

  // Update Firestore: ended + recording URL
  try {
    const update = {
      status:  'ended',
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    if (playbackUrl) update.recordingUrl = playbackUrl

    await db.collection('lives').doc(liveId).update(update)

    // Also create a video document so it appears in the VOD library
    if (playbackUrl && room.filename) {
      const liveDoc = await db.collection('lives').doc(liveId).get()
      const liveData = liveDoc.data() || {}

      await db.collection('videos').add({
        title:       liveData.title || `Live Recording – ${new Date().toLocaleDateString()}`,
        description: liveData.description || 'Recorded live stream',
        category:    liveData.category || 'Other',
        status:      'READY',
        privacy:     'public',
        playbackUrl,
        type:        'recorded-live',
        sourceLiveId: liveId,
        duration:    room.startedAt ? formatDuration((Date.now() - room.startedAt) / 1000) : null,
        views:       0,
        likes:       0,
        createdAt:   admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log(`[${liveId}] VOD created: ${playbackUrl}`)
    }
  } catch (e) { console.error('Firestore finalize error:', e.message) }

  room.broadcaster = null
}

const viewerCountTimers = {}
function updateViewerCount(liveId, count) {
  clearTimeout(viewerCountTimers[liveId])
  viewerCountTimers[liveId] = setTimeout(async () => {
    try {
      await db.collection('lives').doc(liveId).update({ viewerCount: count })
    } catch {}
  }, 2000)
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`
}

// ─── REST API ────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_, res) => res.json({ ok: true, rooms: Object.keys(rooms).length }))

// List recordings
app.get('/recordings-list', (_, res) => {
  try {
    const files = fs.readdirSync(REC_DIR)
      .filter(f => f.endsWith('.webm'))
      .map(f => {
        const stat = fs.statSync(path.join(REC_DIR, f))
        return { name: f, url: `${PUBLIC_URL}/recordings/${f}`, size: stat.size, mtime: stat.mtime }
      })
      .sort((a, b) => b.mtime - a.mtime)
    res.json(files)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Active rooms info
app.get('/rooms', (_, res) => {
  const info = {}
  for (const [id, room] of Object.entries(rooms)) {
    info[id] = {
      hasBroadcaster: !!room.broadcaster && room.broadcaster.readyState === WebSocket.OPEN,
      viewers: room.viewers.size,
      recording: !!room.fileStream,
      filename: room.filename,
    }
  }
  res.json(info)
})

// ─── Start ───────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 LearnoStream Phone Media Server`)
  console.log(`   Local:  http://localhost:${PORT}`)
  console.log(`   Public: ${PUBLIC_URL}`)
  console.log(`   Recordings: ${REC_DIR}`)
  console.log(`\n   WebSocket: ws://localhost:${PORT}`)
  console.log(`   Recordings served at: ${PUBLIC_URL}/recordings/\n`)
})
