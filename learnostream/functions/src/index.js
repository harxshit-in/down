const functions  = require('firebase-functions')
const admin      = require('firebase-admin')
const axios      = require('axios')

admin.initializeApp()
const db = admin.firestore()

// ─────────────────────────────────────────────────────────
// Helper: call Livepeer Studio API
// ─────────────────────────────────────────────────────────
const LIVEPEER_BASE = 'https://livepeer.studio/api'

function livepeerHeaders() {
  const key = process.env.LIVEPEER_API_KEY || functions.config().livepeer?.api_key
  if (!key) throw new Error('LIVEPEER_API_KEY not configured')
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

// ─────────────────────────────────────────────────────────
// onVideoUpload – triggered by admin calling this function
// Creates Livepeer asset from a URL, polls for HLS playback URL
// ─────────────────────────────────────────────────────────
exports.onVideoUpload = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated')

  // Verify admin role
  const userDoc = await db.collection('users').doc(context.auth.uid).get()
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only')
  }

  const { videoId, downloadUrl } = data
  if (!videoId || !downloadUrl) {
    throw new functions.https.HttpsError('invalid-argument', 'videoId and downloadUrl required')
  }

  try {
    const headers = livepeerHeaders()

    // 1. Import asset via URL
    const importRes = await axios.post(
      `${LIVEPEER_BASE}/asset/upload/url`,
      { url: downloadUrl, name: `video-${videoId}` },
      { headers }
    )

    const assetId = importRes.data.asset?.id
    if (!assetId) throw new Error('No assetId returned from Livepeer')

    // 2. Update Firestore: PROCESSING
    await db.collection('videos').doc(videoId).update({
      status: 'PROCESSING',
      livepeerAssetId: assetId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // 3. Poll for readiness (up to 5 min)
    let playbackUrl = null
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const assetRes = await axios.get(`${LIVEPEER_BASE}/asset/${assetId}`, { headers })
      const asset = assetRes.data
      if (asset.status?.phase === 'ready' && asset.playbackId) {
        playbackUrl = `https://livepeercdn.studio/hls/${asset.playbackId}/index.m3u8`
        break
      }
      if (asset.status?.phase === 'failed') {
        throw new Error('Livepeer transcoding failed')
      }
    }

    if (!playbackUrl) throw new Error('Transcoding timed out')

    // 4. Update Firestore: READY
    await db.collection('videos').doc(videoId).update({
      status: 'READY',
      playbackUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { success: true, playbackUrl }
  } catch (err) {
    console.error('onVideoUpload error:', err.message)
    await db.collection('videos').doc(videoId).update({
      status: 'ERROR',
      errorMessage: err.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {})
    throw new functions.https.HttpsError('internal', err.message)
  }
})

// ─────────────────────────────────────────────────────────
// onLiveScheduled – callable: creates a Livepeer stream & returns RTMP details
// ─────────────────────────────────────────────────────────
exports.onLiveScheduled = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated')

  const userDoc = await db.collection('users').doc(context.auth.uid).get()
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only')
  }

  const { liveId } = data
  if (!liveId) throw new functions.https.HttpsError('invalid-argument', 'liveId required')

  try {
    const headers = livepeerHeaders()

    // Create stream on Livepeer
    const streamRes = await axios.post(
      `${LIVEPEER_BASE}/stream`,
      {
        name: `live-${liveId}`,
        profiles: [
          { name: '720p', bitrate: 2000000, fps: 30, width: 1280, height: 720 },
          { name: '480p', bitrate: 1000000, fps: 30, width: 854,  height: 480 },
        ],
      },
      { headers }
    )

    const stream      = streamRes.data
    const rtmpUrl     = `rtmp://rtmp.livepeer.com/live`
    const streamKey   = stream.streamKey
    const playbackUrl = stream.playbackId
      ? `https://livepeercdn.studio/hls/${stream.playbackId}/index.m3u8`
      : null

    // Update Firestore
    await db.collection('lives').doc(liveId).update({
      livepeerStreamId: stream.id,
      rtmpInfo: { server: rtmpUrl, streamKey },
      playbackUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { rtmpUrl, streamKey, playbackUrl }
  } catch (err) {
    console.error('onLiveScheduled error:', err.message)
    throw new functions.https.HttpsError('internal', err.message)
  }
})

// ─────────────────────────────────────────────────────────
// Firestore trigger: auto-generate thumbnail from Livepeer
// when a video transitions to READY
// ─────────────────────────────────────────────────────────
exports.onVideoReady = functions.firestore
  .document('videos/{videoId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after  = change.after.data()

    // Only act on READY transitions
    if (before.status !== 'READY' && after.status === 'READY' && after.livepeerAssetId) {
      try {
        const headers = livepeerHeaders()
        // Fetch asset for thumbnail
        const res = await axios.get(`${LIVEPEER_BASE}/asset/${after.livepeerAssetId}`, { headers })
        const asset = res.data
        const thumbnail = asset.videoSpec?.duration
          ? `https://image.livepeer.studio/asset/${after.livepeerAssetId}/thumbnails/keyframes_0.webp`
          : null

        if (thumbnail) {
          await change.after.ref.update({ thumbnail })
        }
      } catch (err) {
        console.warn('Thumbnail fetch failed:', err.message)
      }
    }
  })
