import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = () => {}
    try {
      unsub = onAuthStateChanged(auth, async (fbUser) => {
        setUser(fbUser)
        if (fbUser) {
          try {
            const snap = await getDoc(doc(db, 'users', fbUser.uid))
            setProfile(snap.exists() ? snap.data() : { role: 'viewer' })
          } catch {
            setProfile({ role: 'viewer' })
          }
        } else {
          setProfile(null)
        }
        setLoading(false)
      }, () => {
        // Auth error (e.g. network offline)
        setLoading(false)
      })
    } catch {
      setLoading(false)
    }
    return unsub
  }, [])

  const login = (email, pass) => signInWithEmailAndPassword(auth, email, pass)

  const signup = async (email, pass, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass)
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName,
      email,
      role: 'viewer',
      createdAt: new Date().toISOString(),
    })
    return cred
  }

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider)
    const ref  = doc(db, 'users', cred.user.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: cred.user.displayName,
        email:       cred.user.email,
        role:        'viewer',
        createdAt:   new Date().toISOString(),
      })
    }
    return cred
  }

  const logout = () => signOut(auth)

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
