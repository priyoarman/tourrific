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
    if ("token" in stored) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch {
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
  }
  listeners.forEach((listener) => listener());
}

let signingOut: Promise<void> = Promise.resolve();

export function logOut() {
  setSession(null);
  signingOut = fetch("/api/auth/logout", { method: "POST" }).then(
    () => {},
    () => {},
  );
}

export function signedOut() {
  return signingOut;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
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

export function useSession() {
  return useSyncExternalStore(subscribe, getSession, () => null);
}
