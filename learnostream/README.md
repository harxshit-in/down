# 🎬 LearnoStream

> Stream knowledge. Learn live.

A production-grade video learning platform built with React (Vite), Firebase, and Livepeer Studio.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎥 VOD Playback | HLS via Livepeer Studio + hls.js |
| 📡 Live Streams | Livepeer RTMP or YouTube Live embed |
| 🔐 Auth | Email/Password + Google OAuth |
| 👑 Admin | Upload, schedule live, manage content |
| 💬 Realtime Chat | Firestore-powered live chat |
| ❤️ Likes & Comments | Per-video engagement |
| 🔍 Search | Title/description search with category filters |
| 📱 Responsive | Mobile-first Tailwind UI |
| 🔒 Security | Firestore + Storage rules; role-based access |
| 🚀 CI/CD | GitHub Actions → Firebase Hosting |

---

## 🚀 Quick Start

### 1. Clone & install

```bash
git clone https://github.com/yourname/learnostream.git
cd learnostream
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your values in `.env`:

```env
VITE_FIREBASE_API_KEY=AIzaSyCn4B2cubk2sEKA6uJ9PGrRVZGUZk3RdpU
VITE_FIREBASE_AUTH_DOMAIN=learnkaro-5cbc3.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=learnkaro-5cbc3
VITE_FIREBASE_STORAGE_BUCKET=learnkaro-5cbc3.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=305527830545
VITE_FIREBASE_APP_ID=1:305527830545:web:0a3646db4ca80af805d9b0

# Optional – enables Livepeer transcoding
VITE_LIVEPEER_API_KEY=your_livepeer_key_here
```

### 3. Start dev server

```bash
npm run dev
```

Open http://localhost:5173

---

## 🏗 Project Structure

```
learnostream/
├── src/
│   ├── components/
│   │   ├── auth/         # ProtectedRoute, AdminRoute
│   │   ├── common/       # Layout, Navbar, Footer
│   │   ├── live/         # LiveChat
│   │   └── video/        # VideoCard, VideoPlayer, YouTubeEmbed, Comments, LikeButton
│   ├── hooks/
│   │   └── useAuth.jsx   # Firebase Auth context
│   ├── lib/
│   │   └── firebase.js   # Firebase init
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── SignupPage.jsx
│   │   ├── VideoPage.jsx
│   │   ├── LivePage.jsx
│   │   ├── EmbedPage.jsx
│   │   ├── AdminDashboard.jsx
│   │   └── admin/
│   │       ├── UploadPage.jsx
│   │       └── ScheduleLivePage.jsx
│   ├── styles/
│   │   └── global.css
│   └── tests/
│       └── components.test.jsx
├── functions/
│   └── src/
│       └── index.js      # Cloud Functions (Livepeer integration)
├── e2e/
│   └── main.spec.js      # Playwright E2E tests
├── scripts/
│   └── create-admin.js   # Admin user creation
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
└── .github/workflows/deploy.yml
```

---

## 👑 Creating an Admin User

```bash
# Requires a Firebase service account
export GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json

node scripts/create-admin.js admin@example.com SecurePass123 "Admin User"
```

This sets:
- Firebase Auth user
- Custom claim `{ admin: true }` (for Storage rules)
- Firestore `/users/{uid}` doc with `role: "admin"` (for Firestore rules)

> **Note:** The new admin must sign out and sign back in for custom claims to take effect.

---

## 📡 Livepeer Studio Setup

1. Sign up at [livepeer.studio](https://livepeer.studio)
2. Create an API key in the dashboard
3. Add it to `.env`:
   ```
   VITE_LIVEPEER_API_KEY=your_key
   ```
4. Set it as a Cloud Functions environment variable:
   ```bash
   firebase functions:config:set livepeer.api_key="your_key"
   ```

Without a Livepeer key, the admin UI shows a YouTube Live fallback flow.

---

## 🎥 YouTube Live Fallback

When `VITE_LIVEPEER_API_KEY` is not set:

1. Admin goes to **Schedule Live** → selects "YouTube Live"
2. Enters the YouTube video/stream ID or full embed URL
3. LearnoStream stores it and embeds it on the live page

---

## 🚀 Deploying to Vercel

The frontend deploys to **Vercel**. Firebase still handles Auth, Firestore, Storage, and Cloud Functions.

---

### Option A — One-click via Vercel Dashboard (easiest)

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → **Import** your repo
3. Vercel auto-detects Vite. In **Environment Variables**, add:

| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIzaSyCn4B2cubk2sEKA6uJ9PGrRVZGUZk3RdpU` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `learnkaro-5cbc3.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `learnkaro-5cbc3` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `learnkaro-5cbc3.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `305527830545` |
| `VITE_FIREBASE_APP_ID` | `1:305527830545:web:0a3646db4ca80af805d9b0` |
| `VITE_LIVEPEER_API_KEY` | *(your Livepeer key, optional)* |

4. Click **Deploy** — done! You get a `https://learnostream.vercel.app` URL instantly.

> **Every push to `main`** triggers an automatic redeploy.

---

### Option B — Vercel CLI (manual)

```bash
# Install CLI
npm i -g vercel

# Link project (first time)
vercel

# Deploy to production
vercel --prod
```

---

### Option C — GitHub Actions (automated CI/CD)

The included `.github/workflows/deploy.yml` handles:
- ✅ Run unit tests
- 🚀 Deploy frontend to Vercel
- ☁️ Deploy Cloud Functions + Firestore/Storage rules to Firebase

Add these secrets in **GitHub → Settings → Secrets → Actions**:

| Secret | How to get it |
|---|---|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Run `vercel` locally, check `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Same `.vercel/project.json` file |
| `FIREBASE_TOKEN` | Run `firebase login:ci` |
| `VITE_FIREBASE_*` | Your Firebase config values |
| `VITE_LIVEPEER_API_KEY` | Optional |

---

### Fix Firebase Auth → add Vercel domain

After deploying, you **must** whitelist your Vercel domain in Firebase:

1. Go to [Firebase Console](https://console.firebase.google.com) → **Authentication** → **Settings** → **Authorized domains**
2. Add your Vercel URL: `learnostream.vercel.app` (or your custom domain)

Without this, Google OAuth and email sign-in will be blocked.

---

### Deploy Firebase backend (Cloud Functions + Rules)

The frontend on Vercel still needs the Firebase backend. Deploy it once:

```bash
# Install Firebase CLI
npm i -g firebase-tools
firebase login

# Deploy functions + security rules
firebase deploy --only functions,firestore:rules,firestore:indexes,storage --project learnkaro-5cbc3
```

---

## 🧪 Testing

```bash
# Unit tests (Vitest)
npm test

# E2E tests (Playwright) – requires dev server running
npm run test:e2e
```

---

## 🔒 Security Rules Summary

### Firestore

- **`/users/{uid}`** – Users can read/write own profile; admins can update any
- **`/videos/{id}`** – Public videos are publicly readable; only admins can write
- **`/videos/{id}/comments`** – Authenticated users can create (self-tagged only)
- **`/lives/{id}`** – Publicly readable; admin-only write
- **`/lives/{id}/chat`** – Authenticated users can create chat messages

### Storage

- **`/videos/**`** – Admin custom claim required to write; public read
- **`/thumbnails/**`** – Admin write; public read
- **`/avatars/{uid}/**`** – User can write own avatar; public read

---

## 💰 Free Tier / Cost Notes

| Service | Free Quota | Notes |
|---|---|---|
| Firebase Hosting | 10 GB/mo transfer | Should be fine for modest traffic |
| Firestore | 1 GiB storage, 50k reads/day | Keep metadata lean |
| Firebase Storage | 5 GB storage, 1 GB/day download | Store originals in cold; use Livepeer CDN for playback |
| Firebase Auth | 10k/month phone auth; email/Google free | No issues |
| Cloud Functions | 2M invocations/month free | Transcoding calls are infrequent |
| Livepeer Studio | Free sandbox tier available | Check [livepeer.studio/pricing](https://livepeer.studio/pricing) |

**Likely quota pressure points:**
- Storage: large video files hit 5 GB quickly. Consider moving originals to cold storage after transcoding.
- Firestore reads: If you have many viewers refreshing the live page, add caching.
- Livepeer: Free tier has bandwidth/storage limits; check their dashboard.

---

## 🗺 Firestore Data Model

```
/users/{uid}
  displayName, email, role ("viewer"|"admin"), createdAt

/videos/{videoId}
  title, description, category, privacy
  status ("PENDING"|"PROCESSING"|"READY"|"ERROR")
  originalUrl, playbackUrl (HLS), thumbnail
  storagePath, livepeerAssetId
  views, likes, uploadedBy, createdAt

  /comments/{commentId}
    uid, name, text, createdAt

/lives/{liveId}
  title, description, category, status ("scheduled"|"live"|"ended")
  provider ("livepeer"|"youtube")
  scheduledAt, playbackUrl, youtubeId, youtubeEmbedUrl
  livepeerStreamId, rtmpInfo { server, streamKey }
  viewerCount, likes, createdBy, createdAt

  /chat/{messageId}
    uid, name, text, createdAt
```

---

## 📝 License

MIT
