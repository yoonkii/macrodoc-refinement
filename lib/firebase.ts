// ---------------------------------------------------------------------------
// Firebase client bootstrap — lazy singleton.
//
// Only 'firebase/app' and 'firebase/auth' are imported so the client bundle
// stays lean (no Firestore/Storage/Analytics pulled in). The Auth instance is
// created on first use and cached, and construction is guarded to the browser:
// Firebase Auth touches `window`/IndexedDB, so calling this during SSR would
// throw. The config below is the PUBLIC web client config (safe to ship).
// ---------------------------------------------------------------------------

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Public client configuration for the macro-doc-refinement-8d9fa GCP project.
// These values are not secrets — they identify the project to Firebase and are
// meant to be embedded in client code. Access control is enforced server-side.
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC48bQohOpWP0KDlnmTS59mfyZ6Rl8ZVyA',
  authDomain: 'macro-doc-refinement-8d9fa.firebaseapp.com',
  projectId: 'macro-doc-refinement-8d9fa',
  storageBucket: 'macro-doc-refinement-8d9fa.firebasestorage.app',
  messagingSenderId: '725459007829',
  appId: '1:725459007829:web:d37c53652f57f9baf317dc',
} as const;

let cachedAuth: Auth | null = null;

/** Reuse an already-initialized app (e.g. across HMR reloads) or create one. */
function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
}

/**
 * Return the singleton Firebase Auth instance, creating it on first call.
 *
 * @throws {Error} When invoked outside the browser (SSR/build) — callers must
 *   guard on the client, since Firebase Auth requires `window`.
 */
export function getFirebaseAuth(): Auth {
  if (typeof window === 'undefined') {
    throw new Error('getFirebaseAuth() must only be called in the browser');
  }
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}
