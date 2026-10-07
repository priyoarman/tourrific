// The login store: remembers who signed in, across reloads, and can log out.
//
// The login itself is the session cookie, which scripts cannot read. What is
// kept here is only the user's profile, so the page can show who is signed in
// without asking the backend first.
import { useSyncExternalStore } from "react";

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  currency: { code: string } | null;
};

export type Session = { user: AuthUser };

const STORAGE_KEY = "tourrific.session";

let session: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(): Session | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (typeof stored?.user?.id !== "string" || typeof stored?.user?.email !== "string") return null;
    const session = { user: stored.user };
    // A login from before the session cookie kept its token here too; drop it.
    if ("token" in stored) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch {
    // Storage can be blocked (private mode) or hold something unreadable.
    return null;
  }
}

export function getSession() {
  if (!loaded) {
    session = readStorage();
    loaded = true;
  }
  return session;
}

export function setSession(next: Session | null) {
  session = next;
  loaded = true;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Without storage the page shows the login only until it is reloaded.
  }
  listeners.forEach((listener) => listener());
}

let signingOut: Promise<void> = Promise.resolve();

/**
 * Forgets the user and asks the backend to remove the session cookie. Without
 * a connection the cookie stays until it expires.
 */
export function logOut() {
  setSession(null);
  signingOut = fetch("/api/auth/logout", { method: "POST" }).then(
    () => {},
    () => {},
  );
}

/** Resolves once the last `logOut` has reached the backend, so it can't remove the cookie of a login made right after it. */
export function signedOut() {
  return signingOut;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Signing in or out in another tab updates this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    session = readStorage();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current login, or null. Always null while rendering on the server. */
export function useSession() {
  return useSyncExternalStore(subscribe, getSession, () => null);
}
