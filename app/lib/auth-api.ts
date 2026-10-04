import { api } from "./api";
import { setSession, type AuthUser, type Session } from "./auth-store";

type LoginResponse = { token: string; user: AuthUser };

/** Signs in and stores the login. Throws an ApiError with a message to show. */
export async function signIn(email: string, password: string): Promise<Session> {
  const { token, user } = await api<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  const session = { token, user };
  setSession(session);
  return session;
}

/** Creates the account, then signs in with it, since signing up returns no token. */
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
