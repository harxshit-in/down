#!/data/data/com.termux/files/usr/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  LearnoStream COMPLETE SETUP
#  Run ONCE — then tap home screen button forever
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

G='\033[0;32m'; Y='\033[1;33m'; C='\033[0;36m'; B='\033[1m'; N='\033[0m'; R='\033[0;31m'

clear
echo -e "${C}${B}"
echo "  ██╗     ███████╗ █████╗ ██████╗ ███╗   ██╗ ██████╗ "
echo "  ██║     ██╔════╝██╔══██╗██╔══██╗████╗  ██║██╔═══██╗"
echo "  ██║     █████╗  ███████║██████╔╝██╔██╗ ██║██║   ██║"
echo "  ██║     ██╔══╝  ██╔══██║██╔══██╗██║╚██╗██║██║   ██║"
echo "  ███████╗███████╗██║  ██║██║  ██║██║ ╚████║╚██████╔╝"
echo "  ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ "
echo -e "${N}"
echo -e "${B}  Phone Server — One Time Setup${N}"
echo -e "  ─────────────────────────────────"
echo ""

step() { echo -e "${Y}▶ $1${N}"; }
ok()   { echo -e "${G}✓ $1${N}"; }
fail() { echo -e "${R}✗ $1${N}"; }

# ── 1. Packages ───────────────────────────────────────────────
step "[1/5] Installing packages..."
pkg update -y -o Dpkg::Options::="--force-confold" > /dev/null 2>&1
pkg install -y nodejs-lts termux-api > /dev/null 2>&1
ok "Packages ready"
echo ""

# ── 2. Server files ───────────────────────────────────────────
step "[2/5] Setting up server..."
mkdir -p ~/learnostream/recordings
cd ~/learnostream

cat > package.json << 'EOF'
{
  "name": "learnostream",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "cors": "^2.8.5",
    "uuid": "^9.0.0"
  }
}
EOF

cat > server.js << 'SEOF'
const express=require('express'),http=require('http'),WebSocket=require('ws'),cors=require('cors'),path=require('path'),fs=require('fs'),{v4:uuidv4}=require('uuid')
const app=express(),server=http.createServer(app),wss=new WebSocket.Server({server})
const PORT=3001,REC=path.resolve('./recordings')
if(!fs.existsSync(REC))fs.mkdirSync(REC,{recursive:true})
app.use(cors({origin:'*'}))
app.use('/recordings',express.static(REC,{setHeaders:r=>r.setHeader('Access-Control-Allow-Origin','*')}))
app.get('/health',(q,r)=>r.json({ok:true,recordings:fs.readdirSync(REC).filter(f=>f.endsWith('.webm')).length}))
const rooms={}
function room(id){if(!rooms[id])rooms[id]={broadcaster:null,viewers:new Set(),file:null,fname:null,size:0};return rooms[id]}
wss.on('connection',ws=>{
let lid=null,role=null,vid=uuidv4()
ws.on('message',async raw=>{
let m;try{m=JSON.parse(raw)}catch{return}
if(m.type==='join'){
lid=m.liveId;role=m.data.role;const r=room(lid)
if(role==='broadcaster'){
r.broadcaster=ws
const fn=lid+'_'+Date.now()+'.webm';r.fname=fn
r.file=fs.createWriteStream(path.join(REC,fn))
ws.send(JSON.stringify({type:'joined',role:'broadcaster'}))
console.log('['+lid+'] LIVE STARTED')
}else{
r.viewers.add(ws)
ws.send(JSON.stringify({type:'joined',role:'viewer',hasBroadcaster:r.broadcaster?.readyState===1}))
if(r.broadcaster?.readyState===1)r.broadcaster.send(JSON.stringify({type:'viewer-joined',viewerId:vid}))
}}
else if(m.type==='recording-chunk'&&rooms[lid]?.file){
try{const b=Buffer.from(m.data.chunk,'base64');rooms[lid].file.write(b)}catch(e){}}
else if(m.type==='offer'){const r=rooms[lid];if(r)for(const v of r.viewers)if(v.readyState===1)v.send(JSON.stringify({type:'offer',sdp:m.data.sdp}))}
else if(m.type==='answer'){rooms[lid]?.broadcaster?.send(JSON.stringify({type:'answer',sdp:m.data.sdp,viewerId:vid}))}
else if(m.type==='ice-candidate'){
const r=rooms[lid];if(!r)return
if(role==='broadcaster'){for(const v of r.viewers)if(v.readyState===1)v.send(JSON.stringify({type:'ice-candidate',candidate:m.data.candidate}))}
else if(r.broadcaster?.readyState===1)r.broadcaster.send(JSON.stringify({type:'ice-candidate',candidate:m.data.candidate,viewerId:vid}))}
else if(m.type==='stop')end(lid)
})
ws.on('close',()=>{if(!lid)return;const r=rooms[lid];if(!r)return;if(role==='broadcaster')end(lid);else r.viewers.delete(ws)})
})
function end(lid){const r=rooms[lid];if(!r||!r.broadcaster)return;r.broadcaster=null;if(r.file){r.file.end();r.file=null};for(const v of r.viewers)if(v.readyState===1)v.send(JSON.stringify({type:'stream-ended'}));console.log('['+lid+'] ENDED')}
server.listen(PORT,'0.0.0.0',()=>console.log('🎬 Server running on port '+PORT))
SEOF

npm install --silent 2>/dev/null
ok "Server files ready"
echo ""

# ── 3. Cloudflared ────────────────────────────────────────────
step "[3/5] Installing cloudflared tunnel..."
if [ ! -f ~/learnostream/cloudflared ]; then
  ARCH=$(uname -m)
  if [[ "$ARCH" == "aarch64" ]]; then
    URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
  else
    URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
  fi
  wget -q --show-progress "$URL" -O ~/learnostream/cloudflared 2>&1
  chmod +x ~/learnostream/cloudflared
fi
ok "Cloudflared ready"
echo ""

# ── 4. Home screen shortcut ───────────────────────────────────
step "[4/5] Setting up home screen button..."
mkdir -p ~/.shortcuts

cat > ~/.shortcuts/🔴\ LearnoStream << 'SHORTCUT'
#!/data/data/com.termux/files/usr/bin/bash
pkill -f "node server.js" 2>/dev/null
pkill -f "cloudflared" 2>/dev/null
sleep 1

cd ~/learnostream
node server.js > /tmp/ls-server.log 2>&1 &
sleep 4

if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
  termux-toast "❌ Server failed! Check ~/learnostream"
  exit 1
fi
termux-toast "✅ Node server started!"

~/learnostream/cloudflared tunnel --url http://localhost:3001 --no-quic > /tmp/ls-tunnel.log 2>&1 &

echo "Waiting for tunnel URL..."
for i in $(seq 1 20); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/ls-tunnel.log 2>/dev/null | head -1)
  if [ -n "$URL" ]; then break; fi
  sleep 2
done

if [ -z "$URL" ]; then
  termux-toast "❌ Tunnel failed. Check internet!"
  exit 1
fi

WSS=$(echo "$URL" | sed 's/https/wss/')
echo "$WSS" > ~/learnostream/current-url.txt
echo "$WSS" | termux-clipboard-set

termux-notification \
  --title "🔴 LearnoStream LIVE" \
  --content "WSS URL auto-copied! Paste in Vercel: $WSS" \
  --ongoing --id 99

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SERVER IS RUNNING!"
echo ""
echo "WSS URL (auto-copied to clipboard):"
echo "$WSS"
echo ""
echo "Paste in Vercel:"
echo "VITE_PHONE_SERVER_URL=$WSS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Keep this window open while streaming!"
SHORTCUT

chmod +x ~/.shortcuts/🔴\ LearnoStream

# Also create a plain-name version in case emoji doesn't work
cat > ~/.shortcuts/LearnoStream << 'SHORTCUT2'
#!/data/data/com.termux/files/usr/bin/bash
bash ~/.shortcuts/🔴\ LearnoStream
SHORTCUT2
chmod +x ~/.shortcuts/LearnoStream

ok "Home screen button created!"
echo ""

# ── 5. Test ────────────────────────────────────────────────────
step "[5/5] Testing server..."
node ~/learnostream/server.js > /tmp/ls-test.log 2>&1 &
sleep 3
TEST=$(curl -s http://localhost:3001/health 2>/dev/null)
pkill -f "node server.js" 2>/dev/null

if echo "$TEST" | grep -q "ok"; then
  ok "Server test passed!"
else
  fail "Server test failed — but setup is complete, try running manually"
fi
echo ""

# ── Done! ─────────────────────────────────────────────────────
echo -e "${C}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${G}${B}  ✅  SETUP COMPLETE!${N}"
echo -e "${C}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo ""
echo -e "${B}  To start streaming — choose ONE:${N}"
echo ""
echo -e "  ${G}Option A (Home Screen):${N}"
echo "  1. Install 'Termux:Widget' app from F-Droid"
echo "  2. Long press home screen → add widget → Termux Widget"  
echo "  3. Tap '🔴 LearnoStream' button"
echo ""
echo -e "  ${G}Option B (Termux command):${N}"
echo -e "  ${Y}bash ~/.shortcuts/LearnoStream${N}"
echo ""
echo "  The WSS URL will be auto-copied to your clipboard!"
echo "  Just paste it in Vercel → Env Variables → Redeploy"
echo ""
