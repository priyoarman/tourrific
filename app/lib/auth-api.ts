import { api } from "./api";
import { getSession, setSession, signedOut, type AuthUser, type Session } from "./auth-store";

export async function signIn(email: string, password: string): Promise<Session> {
  await signedOut();
  const { user } = await api<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  const session = { user };
  setSession(session);
  return session;
}

export async function confirmSession() {
  const remembered = getSession();
  if (!remembered) return;

  try {
    const { user } = await api<{ user: AuthUser }>("/api/auth/verify");
    if (getSession() !== remembered) return;
    if (JSON.stringify(user) !== JSON.stringify(remembered.user)) setSession({ user });
  } catch {
  }
}

export async function signUp(name: string, email: string, password: string): Promise<Session> {
  await api("/api/auth/signup", { method: "POST", body: { name, email, password } });
  return signIn(email, password);
}

export function passwordProblem(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)
    ? null
    : "Use at least 8 characters, with at least one letter and one number.";
}
