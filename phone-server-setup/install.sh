#!/data/data/com.termux/files/usr/bin/bash

# ============================================================
#  LearnoStream Phone Server — ONE CLICK SETUP
#  Just paste this ONE command in Termux and everything runs!
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo ""
echo -e "${CYAN}${BOLD}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   LearnoStream Phone Server Setup     ║${NC}"
echo -e "${CYAN}${BOLD}╚═══════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Update & install packages ────────────────────────
echo -e "${YELLOW}[1/7] Installing required packages...${NC}"
pkg update -y -o Dpkg::Options::="--force-confold" 2>/dev/null
pkg install -y nodejs-lts wget unzip 2>/dev/null
echo -e "${GREEN}✓ Packages installed${NC}"
echo ""

# ── Step 2: Storage permission ────────────────────────────────
echo -e "${YELLOW}[2/7] Setting up storage access...${NC}"
termux-setup-storage 2>/dev/null || true
mkdir -p ~/learnostream/recordings
echo -e "${GREEN}✓ Storage ready at ~/learnostream/recordings${NC}"
echo ""

# ── Step 3: Create server files ───────────────────────────────
echo -e "${YELLOW}[3/7] Creating server files...${NC}"
cd ~/learnostream
mkdir -p recordings

# Write package.json
cat > package.json << 'PKGJSON'
{
  "name": "learnostream-phone-server",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "cors": "^2.8.5",
    "uuid": "^9.0.0",
    "firebase-admin": "^12.0.0",
    "dotenv": "^16.3.1"
  }
}
PKGJSON

# Write main server.js
cat > server.js << 'SERVERJS'
require('dotenv').config()
const express   = require('express')
const http      = require('http')
const WebSocket = require('ws')
const cors      = require('cors')
const path      = require('path')
const fs        = require('fs')
const { v4: uuidv4 } = require('uuid')

const app    = express()
const server = http.createServer(app)
const wss    = new WebSocket.Server({ server })
const PORT   = process.env.PORT || 3001
const PUBLIC = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '')
const REC    = path.resolve('./recordings')

if (!fs.existsSync(REC)) fs.mkdirSync(REC, { recursive: true })

app.use(cors({ origin: '*' }))
app.use(express.json())
app.use('/recordings', express.static(REC, {
  setHeaders: res => res.setHeader('Access-Control-Allow-Origin', '*')
}))

// Firebase (optional - only if credentials provided)
let db = null
try {
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const admin = require('firebase-admin')
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    })
    db = admin.firestore()
    console.log('✓ Firebase connected')
  } else {
    console.log('ℹ Firebase not configured — metadata updates disabled')
  }
} catch(e) { console.log('Firebase error:', e.message) }

const rooms = {}

function getRoom(id) {
  if (!rooms[id]) rooms[id] = { broadcaster: null, viewers: new Set(), fileStream: null, filename: null, startedAt: null, size: 0 }
  return rooms[id]
}

async function updateFirestore(path, data) {
  if (!db) return
  try { await db.doc(path).update(data) } catch(e) { console.log('Firestore err:', e.message) }
}

wss.on('connection', ws => {
  let myId = null, myRole = null, viewerId = uuidv4()
  ws._viewerId = viewerId

  ws.on('message', async raw => {
    let msg; try { msg = JSON.parse(raw) } catch { return }
    const { type, liveId, data } = msg

    if (type === 'join') {
      myId = liveId; myRole = data.role
      const room = getRoom(liveId)

      if (myRole === 'broadcaster') {
        room.broadcaster = ws
        room.startedAt   = Date.now()
        const fn = `${liveId}_${Date.now()}.webm`
        room.filename   = fn
        room.fileStream = fs.createWriteStream(path.join(REC, fn))
        ws.send(JSON.stringify({ type: 'joined', role: 'broadcaster' }))
        await updateFirestore(`lives/${liveId}`, { status: 'live', serverUrl: PUBLIC })
        console.log(`[${liveId}] 🔴 Broadcaster connected`)
      } else {
        room.viewers.add(ws)
        ws.send(JSON.stringify({ type: 'joined', role: 'viewer', hasBroadcaster: !!(room.broadcaster?.readyState === 1) }))
        if (room.broadcaster?.readyState === 1) room.broadcaster.send(JSON.stringify({ type: 'viewer-joined', viewerId }))
        console.log(`[${liveId}] 👁 Viewer joined (${room.viewers.size} total)`)
        if (db) db.doc(`lives/${liveId}`).update({ viewerCount: room.viewers.size }).catch(()=>{})
      }
    }

    else if (type === 'recording-chunk' && rooms[liveId]?.fileStream) {
      try {
        const buf = Buffer.from(data.chunk, 'base64')
        rooms[liveId].fileStream.write(buf)
        rooms[liveId].size += buf.length
      } catch(e) {}
    }

    else if (type === 'offer') {
      const room = rooms[liveId]; if (!room) return
      for (const v of room.viewers) {
        if (v.readyState === 1) v.send(JSON.stringify({ type: 'offer', sdp: data.sdp }))
      }
    }
    else if (type === 'answer') {
      rooms[liveId]?.broadcaster?.send(JSON.stringify({ type: 'answer', sdp: data.sdp, viewerId }))
    }
    else if (type === 'ice-candidate') {
      const room = rooms[liveId]; if (!room) return
      if (myRole === 'broadcaster') {
        for (const v of room.viewers) if (v.readyState === 1) v.send(JSON.stringify({ type: 'ice-candidate', candidate: data.candidate }))
      } else {
        room.broadcaster?.send(JSON.stringify({ type: 'ice-candidate', candidate: data.candidate, viewerId }))
      }
    }
    else if (type === 'stop') { await finalize(liveId) }
  })

  ws.on('close', async () => {
    if (!myId) return
    const room = rooms[myId]
    if (!room) return
    if (myRole === 'broadcaster') {
      await finalize(myId)
    } else {
      room.viewers.delete(ws)
      if (room.broadcaster?.readyState === 1) room.broadcaster.send(JSON.stringify({ type: 'viewer-left', viewerId }))
      if (db) db.doc(`lives/${myId}`).update({ viewerCount: room.viewers.size }).catch(()=>{})
    }
  })
})

async function finalize(liveId) {
  const room = rooms[liveId]; if (!room || !room.broadcaster) return
  room.broadcaster = null
  console.log(`[${liveId}] ⏹ Stream ended, saving recording...`)

  if (room.fileStream) { room.fileStream.end(); room.fileStream = null }

  for (const v of room.viewers) if (v.readyState === 1) v.send(JSON.stringify({ type: 'stream-ended' }))

  const playbackUrl = room.filename ? `${PUBLIC}/recordings/${room.filename}` : null
  const durationSec = room.startedAt ? Math.floor((Date.now() - room.startedAt) / 1000) : 0
  const sizeMB      = (room.size / 1024 / 1024).toFixed(1)

  console.log(`[${liveId}] 💾 Saved: ${room.filename} (${sizeMB} MB, ${Math.floor(durationSec/60)}m${durationSec%60}s)`)

  if (db && playbackUrl) {
    try {
      await db.doc(`lives/${liveId}`).update({ status: 'ended', recordingUrl: playbackUrl })
      const liveDoc  = await db.doc(`lives/${liveId}`).get()
      const liveData = liveDoc.data() || {}
      await db.collection('videos').add({
        title:       liveData.title || 'Live Recording',
        description: liveData.description || '',
        category:    liveData.category || 'Other',
        status:      'READY',
        privacy:     'public',
        playbackUrl,
        type:        'recorded-live',
        sourceLiveId: liveId,
        views: 0, likes: 0,
        createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      })
      console.log(`[${liveId}] ✓ VOD created in Firestore`)
    } catch(e) { console.log('Firestore finalize error:', e.message) }
  }
}

app.get('/health',     (_, res) => res.json({ ok: true, recordings: fs.readdirSync(REC).length }))
app.get('/recordings-list', (_, res) => {
  const files = fs.readdirSync(REC).filter(f => f.endsWith('.webm')).map(f => {
    const s = fs.statSync(path.join(REC, f))
    return { name: f, url: `${PUBLIC}/recordings/${f}`, sizeMB: (s.size/1024/1024).toFixed(1), date: s.mtime }
  }).sort((a,b) => new Date(b.date) - new Date(a.date))
  res.json(files)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('🎬 LearnoStream Phone Server RUNNING!')
  console.log(`   Local URL:    http://localhost:${PORT}`)
  console.log(`   Public URL:   ${PUBLIC}`)
  console.log(`   Recordings:   ${REC}`)
  console.log('')
})
SERVERJS

echo -e "${GREEN}✓ Server files created${NC}"
echo ""

# ── Step 4: Install npm packages ──────────────────────────────
echo -e "${YELLOW}[4/7] Installing Node packages (may take 2-3 min)...${NC}"
npm install --prefer-offline 2>&1 | tail -3
echo -e "${GREEN}✓ Packages installed${NC}"
echo ""

# ── Step 5: Download ngrok ────────────────────────────────────
echo -e "${YELLOW}[5/7] Downloading ngrok (tunnel tool)...${NC}"
ARCH=$(uname -m)
if [[ "$ARCH" == "aarch64" ]]; then
  NGROK_URL="https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz"
elif [[ "$ARCH" == "armv7l" ]]; then
  NGROK_URL="https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm.tgz"
else
  NGROK_URL="https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz"
fi

if [ ! -f ~/learnostream/ngrok ]; then
  wget -q --show-progress "$NGROK_URL" -O ngrok.tgz
  tar xf ngrok.tgz
  rm ngrok.tgz
  chmod +x ngrok
  echo -e "${GREEN}✓ ngrok downloaded${NC}"
else
  echo -e "${GREEN}✓ ngrok already exists${NC}"
fi
echo ""

# ── Step 6: Create .env file ──────────────────────────────────
echo -e "${YELLOW}[6/7] Configuring environment...${NC}"
if [ ! -f .env ]; then
  cat > .env << 'ENVFILE'
PORT=3001
PUBLIC_URL=http://localhost:3001

# Firebase credentials (paste from your service account JSON)
# Get it: Firebase Console → Project Settings → Service Accounts → Generate key
FIREBASE_PROJECT_ID=learnkaro-5cbc3
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
ENVFILE
  echo -e "${GREEN}✓ .env file created${NC}"
else
  echo -e "${GREEN}✓ .env already exists${NC}"
fi
echo ""

# ── Step 7: Create helper scripts ────────────────────────────
echo -e "${YELLOW}[7/7] Creating helper scripts...${NC}"

# start.sh — starts server + ngrok together
cat > ~/learnostream/start.sh << 'STARTSH'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/learnostream

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

clear
echo -e "${CYAN}${BOLD}Starting LearnoStream Phone Server...${NC}"
echo ""

# Check ngrok token
if ! grep -q "authtoken" ~/.config/ngrok/ngrok.yml 2>/dev/null; then
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}First time setup: Enter your ngrok token${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "1. Go to: https://dashboard.ngrok.com/signup (free)"
  echo "2. Copy your auth token"
  echo "3. Paste it here:"
  echo ""
  read -p "ngrok auth token: " TOKEN
  ./ngrok config add-authtoken "$TOKEN"
  echo ""
fi

# Start ngrok in background
echo -e "${YELLOW}→ Starting tunnel...${NC}"
./ngrok http 3001 --log=stdout > ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok URL
sleep 3
PUBLIC_URL=""
for i in $(seq 1 15); do
  PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*' | grep https | head -1 | cut -d'"' -f4)
  if [ -n "$PUBLIC_URL" ]; then break; fi
  sleep 1
done

if [ -z "$PUBLIC_URL" ]; then
  echo -e "${RED}✗ Could not get ngrok URL. Check ngrok.log${NC}"
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

# Update .env with public URL
sed -i "s|PUBLIC_URL=.*|PUBLIC_URL=${PUBLIC_URL}|" .env
echo -e "${GREEN}✓ Tunnel URL: ${PUBLIC_URL}${NC}"

# Show what to put in Vercel
WSS_URL=$(echo "$PUBLIC_URL" | sed 's/https/wss/')
echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Add this to Vercel Environment Variables:${NC}"
echo ""
echo -e "  ${BOLD}VITE_PHONE_SERVER_URL${NC}"
echo -e "  ${GREEN}${WSS_URL}${NC}"
echo ""
echo -e "  Vercel → Project → Settings → Env Variables → Redeploy"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Start Node server
echo -e "${YELLOW}→ Starting media server...${NC}"
echo ""
node server.js
STARTSH

chmod +x ~/learnostream/start.sh

echo -e "${GREEN}✓ Helper scripts created${NC}"
echo ""

# ── Done! ─────────────────────────────────────────────────────
echo -e "${CYAN}${BOLD}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║           ✅  SETUP COMPLETE!         ║${NC}"
echo -e "${CYAN}${BOLD}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}To start the server, run:${NC}"
echo ""
echo -e "  ${GREEN}${BOLD}bash ~/learnostream/start.sh${NC}"
echo ""
echo -e "${YELLOW}Note: The first time you run start.sh it will ask${NC}"
echo -e "${YELLOW}for your free ngrok token (takes 30 seconds to get).${NC}"
echo ""
echo -e "Recordings will be saved to:"
echo -e "  ${CYAN}~/learnostream/recordings/${NC}"
echo ""
