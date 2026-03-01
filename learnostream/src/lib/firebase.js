import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

// Hardcoded fallback ensures app never crashes if env vars are missing at build time.
// Always prefer env vars (set them in Vercel dashboard → Settings → Environment Variables).
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'AIzaSyCn4B2cubk2sEKA6uJ9PGrRVZGUZk3RdpU',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'learnkaro-5cbc3.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'learnkaro-5cbc3',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'learnkaro-5cbc3.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| '305527830545',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:305527830545:web:0a3646db4ca80af805d9b0',
}

// Prevent duplicate app initialization (e.g. hot-reload in dev)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const auth           = getAuth(app)
export const db             = getFirestore(app)
export const storage        = getStorage(app)
export const functions      = getFunctions(app)
export const googleProvider = new GoogleAuthProvider()
