// The login store: holds the token and user the backend returned at sign-in,
// keeps them in the browser across reloads, and can log out.
import { useSyncExternalStore } from "react";

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  currency: { code: string } | null;
};

export type Session = { token: string; user: AuthUser };

const STORAGE_KEY = "tourrific.session";

let session: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

/** True once the token's own expiry time has passed. The backend issues 1-hour tokens. */
export function isExpired(token: string, now = Date.now()) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === "number" && exp * 1000 <= now;
  } catch {
    // Not a readable token; let the backend be the judge.
    return false;
  }
}

function readStorage(): Session | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (typeof stored?.token !== "string" || typeof stored?.user?.email !== "string") return null;
    return isExpired(stored.token) ? null : stored;
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
    // Without storage the login simply lasts until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

export function logOut() {
  setSession(null);
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
