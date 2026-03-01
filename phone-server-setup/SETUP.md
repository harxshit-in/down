# 📱 Phone Media Server — Setup Guide

This Node.js server runs on your **old Android phone** and acts as the WebRTC relay + recording storage.

---

## What it does

- Relays WebRTC streams between the broadcaster (admin browser) and viewers
- Records every live stream as a `.webm` file **directly on the phone's storage**
- After stream ends, automatically creates a video document in Firestore so the recording appears in the VOD library
- Serves recordings so viewers can replay them

---

## Step 1 — Install Termux on your old phone

1. Download **Termux** from F-Droid (not Play Store — that version is outdated):
   👉 https://f-droid.org/packages/com.termux/

2. Open Termux and run:
```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts git -y
```

---

## Step 2 — Copy the server files to your phone

**Option A — via USB:**
```bash
# On your computer
adb push phone-server/ /sdcard/learnostream-server/

# In Termux
cp -r /sdcard/learnostream-server ~/learnostream-server
cd ~/learnostream-server
```

**Option B — via Git (if you pushed to GitHub):**
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/learnostream.git
cd learnostream/phone-server
```

**Option C — via Termux SSH (connect from computer):**
```bash
# In Termux
pkg install openssh
sshd
# Then from computer: scp -P 8022 -r phone-server/ user@PHONE_IP:~/
```

---

## Step 3 — Configure the server

```bash
cd ~/learnostream-server   # or wherever you copied it
cp .env.example .env
nano .env   # or: vi .env
```

Fill in:
- `FIREBASE_PROJECT_ID` = `learnkaro-5cbc3`
- `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` — download from:
  Firebase Console → Project Settings → Service Accounts → **Generate new private key**
  Copy the values from the downloaded JSON file.

---

## Step 4 — Install dependencies & start

```bash
npm install
npm start
```

You should see:
```
🎬 LearnoStream Phone Media Server
   Local:  http://localhost:3001
   Public: http://localhost:3001  ← will update after Step 5
   Recordings: /data/data/com.termux/files/home/learnostream-server/recordings
```

---

## Step 5 — Make the phone accessible from the internet (ngrok)

Your Vercel app needs to reach the phone server. Use **ngrok** (free):

```bash
# Install ngrok in Termux
pkg install wget
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm.tgz
tar xvf ngrok-v3-stable-linux-arm.tgz

# Sign up free at ngrok.com, get your auth token, then:
./ngrok config add-authtoken YOUR_TOKEN_HERE

# In a NEW Termux session (swipe right to open new tab):
./ngrok http 3001
```

ngrok gives you a URL like: `https://abc123.ngrok.io`

---

## Step 6 — Update your Vercel app

1. Go to **Vercel → Your Project → Settings → Environment Variables**
2. Add: `VITE_PHONE_SERVER_URL` = `wss://abc123.ngrok.io`
   *(replace `https://` with `wss://`)*
3. Click **Redeploy** in Vercel

Also update `phone-server/.env`:
```
PUBLIC_URL=https://abc123.ngrok.io
```
Then restart the server (`npm start`).

---

## Step 7 — Test it!

1. On your Vercel site, go to **Admin → Go Live**
2. The "Server status" indicator should show **● Server online**
3. Click **Enable Camera** → **Go Live**
4. Open `/live/YOUR_LIVE_ID` in another tab — you should see the stream!
5. When you end the stream, the recording appears in your video library

---

## Keep phone server running 24/7

Install `tmux` so the server keeps running even when Termux is backgrounded:
```bash
pkg install tmux
tmux new -s server
npm start
# Press Ctrl+B then D to detach — server keeps running!
# To reattach: tmux attach -t server
```

Also go to **Android Settings → Battery → Termux → Don't optimize** to prevent Android from killing it.

---

## Storage management

Recordings are saved to `./recordings/` on the phone.

```bash
# Check storage used
du -sh ~/learnostream-server/recordings/

# List recordings
ls -lh ~/learnostream-server/recordings/

# Delete old ones (e.g. older than 30 days)
find ~/learnostream-server/recordings/ -name "*.webm" -mtime +30 -delete
```

A typical 1-hour stream at 1.5 Mbps ≈ **675 MB**.
A 64 GB phone card holds ≈ **95 hours** of streams.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Server offline" in admin | Check ngrok is running, URL matches `VITE_PHONE_SERVER_URL` |
| Black screen for viewers | Allow camera/mic in browser; check browser WebRTC support |
| Recording not saved | Check Termux has storage permission: `termux-setup-storage` |
| Server crashes | Check `npm start` output; common issue is missing Firebase credentials |
| Viewers can't connect | ngrok free tier has connection limits; try restarting ngrok |
