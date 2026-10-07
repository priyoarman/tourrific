import { api } from "./api";
import { getSession, setSession, signedOut, type AuthUser, type Session } from "./auth-store";

/**
 * Signs in: the backend sets the session cookie, and the user it answers with
 * is remembered. Throws an ApiError with a message to show.
 */
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

/**
 * Checks the remembered user against the session cookie, once per page load.
 * The profile in storage can be out of date or edited by hand; the backend's
 * answer replaces it, and a 401 logs out.
 */
export async function confirmSession() {
  const remembered = getSession();
  if (!remembered) return;

  try {
    const { user } = await api<{ user: AuthUser }>("/api/auth/verify");
    // Unless the visitor signed out or in again while this was on its way.
    if (getSession() !== remembered) return;
    if (JSON.stringify(user) !== JSON.stringify(remembered.user)) setSession({ user });
  } catch {
    // A 401 has already been logged out by `api`. Any other failure says nothing about the login.
  }
}

/** Creates the account, then signs in with it, since signing up does not sign in by itself. */
export async function signUp(name: string, email: string, password: string): Promise<Session> {
  await api("/api/auth/signup", { method: "POST", body: { name, email, password } });
  return signIn(email, password);
}

/** The same rule the old sign-up form enforced. Returns the problem, or null. */
export function passwordProblem(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)
    ? null
    : "Use at least 8 characters, with at least one letter and one number.";
}
