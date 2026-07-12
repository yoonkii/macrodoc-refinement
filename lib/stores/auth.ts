// ---------------------------------------------------------------------------
// Auth store — Google sign-in via Firebase Auth.
//
// NOT persisted: Firebase Auth owns session persistence (IndexedDB) and replays
// it through onAuthStateChanged on load, so mirroring the user into localStorage
// would only risk a stale copy. This store is a thin, reactive projection of the
// Firebase session plus the sign-in/out actions.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

import { track } from '../analytics';
import { getFirebaseAuth } from '../firebase';

/** Minimal, serializable projection of the Firebase user we actually render. */
export interface AuthUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  /** True until the first onAuthStateChanged callback resolves the session. */
  isLoading: boolean;
  /** Transient, human-readable error surfaced after a failed sign-in attempt. */
  error: string | null;
}

export interface AuthActions {
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
}

export type AuthStore = AuthState & AuthActions;

/** Map a Firebase User down to the projection we store/render. */
function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    email: user.email,
  };
}

/**
 * Translate a Firebase Auth error code into user-facing copy.
 * Returns `null` for benign cases the UI should swallow silently.
 */
function describeSignInError(error: unknown): string | null {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    // User dismissed the popup (or a second popup superseded this one). Benign.
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    // Google provider not turned on in the Firebase console yet.
    case 'auth/operation-not-allowed':
      return "Google sign-in isn't enabled for this project yet";
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup — allow popups and retry';
    case 'auth/network-request-failed':
      return 'Network error during sign-in — check your connection and retry';
    default:
      return 'Sign-in failed — please try again';
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  async signIn(): Promise<void> {
    set({ error: null });
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(getFirebaseAuth(), provider);
      // onAuthStateChanged updates `user`; nothing to set here on success.
      // Anonymous sign-in signal — no uid or email is ever attached.
      track('signed_in');
    } catch (error: unknown) {
      const message = describeSignInError(error);
      if (message) set({ error: message });
    }
  },

  async signOutUser(): Promise<void> {
    try {
      await signOut(getFirebaseAuth());
      // onAuthStateChanged will null out `user`.
    } catch {
      // Sign-out failing locally is non-fatal; the session is cleared on reload.
      set({ error: 'Sign-out failed — please try again' });
    }
  },

  clearError(): void {
    set({ error: null });
  },
}));

// ── One-time session subscription ───────────────────────────────────────────
//
// Module-level guard so the onAuthStateChanged listener is attached exactly
// once, on the client, no matter how many components read the store. Runs at
// import time in the browser; skipped during SSR.

let authListenerAttached = false;

function initAuthListener(): void {
  if (authListenerAttached || typeof window === 'undefined') return;
  authListenerAttached = true;

  onAuthStateChanged(getFirebaseAuth(), (user) => {
    useAuthStore.setState({
      user: user ? toAuthUser(user) : null,
      isLoading: false,
    });
  });
}

initAuthListener();

// ── ID token helper ─────────────────────────────────────────────────────────

/**
 * Return a fresh Firebase ID token for the signed-in user, or `null` when
 * signed out. The SDK caches and auto-refreshes the token, so this is cheap to
 * await before each proxy request. Never throws — a token fetch failure resolves
 * to `null` so the caller falls back to the anonymous (signed-out) path.
 */
export async function getIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) return null;
    return await currentUser.getIdToken();
  } catch {
    return null;
  }
}
