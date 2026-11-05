import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
}

export const firebaseReady = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId &&
  !config.authDomain.includes('://') && !config.authDomain.includes('/'))
export const firebaseApp: FirebaseApp | null = firebaseReady
  ? (getApps()[0] ?? initializeApp(config))
  : null
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
if (auth) auth.languageCode = 'uk'
// Firestore persistent cache supports offline reads; local day edits are separately
// queued and conflict-checked in offlineQueue/offlineSync. Do not depend on
// Firestore's last-write-wins offline writes for payroll data.
function createFirestore(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})})
  } catch (error) {
    console.warn('IndexedDB Firestore cache unavailable; using memory cache:', error)
    return getFirestore(app)
  }
}
export const db: Firestore | null = firebaseApp ? createFirestore(firebaseApp) : null
