import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { storage, db, functions } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const CATEGORIES = ['Tech', 'Design', 'Business', 'Science', 'Arts', 'Other']

export default function UploadPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [form, setForm] = useState({
    title: '', description: '', category: 'Tech', privacy: 'public',
  })
  const [file, setFile]       = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [phase, setPhase]     = useState('') // 'uploading' | 'processing' | 'done'

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('video/')) { toast.error('Please select a video file'); return }
    if (f.size > 2 * 1024 * 1024 * 1024) { toast.error('File too large (max 2 GB)'); return }
    setFile(f)
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) { toast.error('Please select a video file'); return }
    if (!form.title.trim()) { toast.error('Title is required'); return }

    setUploading(true)
    setPhase('uploading')

    try {
      // 1. Upload to Firebase Storage
      const storagePath = `videos/${user.uid}/${Date.now()}_${file.name}`
      const storageRef  = ref(storage, storagePath)
      const task        = uploadBytesResumable(storageRef, file)

      await new Promise((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve,
        )
      })

      const downloadUrl = await getDownloadURL(storageRef)
      setPhase('processing')

      // 2. Create Firestore doc
      const docRef = await addDoc(collection(db, 'videos'), {
        title:       form.title.trim(),
        description: form.description.trim(),
        category:    form.category,
        privacy:     form.privacy,
        status:      'PENDING',
        storagePath,
        originalUrl: downloadUrl,
        uploadedBy:  user.uid,
        views:       0,
        likes:       0,
        createdAt:   serverTimestamp(),
      })

      // 3. Trigger Cloud Function (Livepeer transcoding)
      if (import.meta.env.VITE_LIVEPEER_API_KEY) {
        try {
          const triggerTranscode = httpsCallable(functions, 'onVideoUpload')
          await triggerTranscode({ videoId: docRef.id, storagePath, downloadUrl })
        } catch (fnErr) {
          console.warn('Cloud function error (non-fatal):', fnErr)
        }
      }

      setPhase('done')
      toast.success('Video uploaded successfully!')
      navigate('/admin')
    } catch (err) {
      console.error(err)
      toast.error('Upload failed: ' + err.message)
      setUploading(false)
      setPhase('')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-1">Upload Video</h1>
        <p className="text-[var(--text-muted)] text-sm">Upload an MP4 — it will be transcoded to HLS automatically via Livepeer.</p>
      </div>

      <form onSubmit={handleUpload} className="space-y-5">
        {/* File drop */}
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors duration-200
            ${file ? 'border-brand-500/60 bg-brand-500/5' : 'border-dark-500 hover:border-brand-500/40 bg-dark-800/50'}`}
        >
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
          <div className="text-4xl mb-3">{file ? '✅' : '🎬'}</div>
          {file ? (
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div>
              <p className="font-medium mb-1">Click to select video</p>
              <p className="text-sm text-[var(--text-muted)]">MP4, MOV, WebM · Max 2 GB</p>
            </div>
          )}
        </div>

        {/* Form fields */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Title <span className="text-red-400">*</span></label>
          <input value={form.title} onChange={set('title')} className="input" placeholder="Enter video title" required />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Description</label>
          <textarea value={form.description} onChange={set('description')} className="input resize-none h-24" placeholder="What is this video about?" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Category</label>
            <select value={form.category} onChange={set('category')} className="input">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Privacy</label>
            <select value={form.privacy} onChange={set('privacy')} className="input">
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        {/* Progress */}
        {uploading && (
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[var(--text-muted)]">
                {phase === 'uploading' ? 'Uploading…' : phase === 'processing' ? 'Triggering transcoding…' : 'Done!'}
              </span>
              <span className="font-mono text-brand-400">{progress}%</span>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={uploading} className="btn-primary flex-1">
            {uploading ? 'Uploading…' : 'Upload Video'}
          </button>
          <button type="button" onClick={() => navigate('/admin')} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>

      {/* Livepeer status notice */}
      {!import.meta.env.VITE_LIVEPEER_API_KEY && (
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm">
          <p className="font-semibold text-yellow-400 mb-1">⚠ Livepeer not configured</p>
          <p className="text-[var(--text-muted)]">
            Add <code className="font-mono text-white">VITE_LIVEPEER_API_KEY</code> to your <code>.env</code> file to enable automatic HLS transcoding.
            Videos will remain in PENDING status until manually processed.
          </p>
        </div>
      )}
    </div>
  )
}
