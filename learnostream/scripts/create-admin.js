#!/usr/bin/env node
/**
 * create-admin.js
 * ───────────────
 * One-time script to create an admin user in Firebase Auth + Firestore.
 *
 * Usage:
 *   node scripts/create-admin.js <email> <password> <displayName>
 *
 * Prerequisites:
 *   npm install firebase-admin
 *   export GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
 *   OR set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY env vars
 */

const admin = require('firebase-admin')

// ── Init ──────────────────────────────────────────────────────────────────
const app = admin.initializeApp({
  credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? admin.credential.applicationDefault()
    : admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID   || 'learnkaro-5cbc3',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
  projectId: process.env.FIREBASE_PROJECT_ID || 'learnkaro-5cbc3',
})

const auth = admin.auth()
const db   = admin.firestore()

async function createAdmin(email, password, displayName) {
  console.log(`\n🔑 Creating admin user: ${email}`)

  // 1. Create / get Auth user
  let userRecord
  try {
    userRecord = await auth.getUserByEmail(email)
    console.log('  ↳ Auth user already exists, updating…')
  } catch {
    userRecord = await auth.createUser({ email, password, displayName })
    console.log('  ↳ Auth user created:', userRecord.uid)
  }

  // 2. Set custom claim: { admin: true } (used by Storage rules)
  await auth.setCustomUserClaims(userRecord.uid, { admin: true })
  console.log('  ↳ Custom claims set: { admin: true }')

  // 3. Write Firestore profile
  await db.collection('users').doc(userRecord.uid).set({
    displayName,
    email,
    role:      'admin',
    createdAt: new Date().toISOString(),
  }, { merge: true })

  console.log('  ↳ Firestore profile written with role: admin')
  console.log(`\n✅ Admin user ready!`)
  console.log(`   UID:   ${userRecord.uid}`)
  console.log(`   Email: ${email}`)
  console.log('\nThe user must sign out and sign back in for custom claims to take effect.\n')
}

// ── Entry point ────────────────────────────────────────────────────────────
const [,, email, password, displayName = 'Admin'] = process.argv

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.js <email> <password> [displayName]')
  process.exit(1)
}

createAdmin(email, password, displayName)
  .then(() => process.exit(0))
  .catch((err) => { console.error('Error:', err.message); process.exit(1) })
