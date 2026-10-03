"use client";

import { useState, type FormEvent } from "react";
import { CloseIcon } from "@/app/components/ui/Icons";
import Modal from "@/app/components/ui/Modal";
import { passwordProblem, signIn, signUp } from "@/app/lib/auth-api";
import type { Session } from "@/app/lib/auth-store";

export type AuthMode = "signin" | "signup";

type Props = {
  /** Which form to show, or null when the dialog is closed. */
  mode: AuthMode | null;
  /** Why the dialog opened, e.g. "Sign in to save this flight." */
  note?: string;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSignedIn: (session: Session) => void;
};

const copy = {
  signin: {
    title: "Welcome back",
    intro: "Sign in to save flights and pick up your chat where you left off.",
    submit: "Sign In",
    pending: "Signing in…",
    switchPrompt: "Need an account?",
    switchAction: "Sign Up",
  },
  signup: {
    title: "Create your account",
    intro: "Save the flights you like and keep your chat history.",
    submit: "Create Account",
    pending: "Creating account…",
    switchPrompt: "Already have an account?",
    switchAction: "Sign In",
  },
};

const inputClass =
  "w-full rounded-2xl border border-lavender-soft bg-white px-4 py-3 text-base text-ink placeholder:text-placeholder focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/40";

function Form({ mode, note, onModeChange, onClose, onSignedIn }: Props & { mode: AuthMode }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const text = copy[mode];
  const isSignUp = mode === "signup";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const problem = isSignUp ? passwordProblem(password) : null;
    if (problem) {
      setError(problem);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const session = isSignUp
        ? await signUp(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password);
      onSignedIn(session);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong. Please try again.");
      setPending(false);
    }
  }

  function switchMode() {
    setError(null);
    onModeChange(isSignUp ? "signin" : "signup");
  }

  return (
    <div className="relative rounded-3xl border border-lavender-soft/70 bg-[#fbf9ff] p-7 shadow-[0_30px_80px_-30px_rgba(42,27,61,0.6)] sm:p-8">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 rounded-full p-2 text-ink-muted transition-colors hover:bg-lavender-soft/50 hover:text-ink"
      >
        <CloseIcon size={18} />
      </button>

      <p className="text-sm font-bold tracking-tight text-ink">
        Tourrific <span aria-hidden className="text-[0.7em]">✦</span>
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">{text.title}</h2>
      <p className="mt-2 text-[15px] text-ink-muted">{note ?? text.intro}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {isSignUp && (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-ink">Name</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            autoFocus={!isSignUp}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Password</span>
          <input
            type="password"
            name="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? "At least 8 characters, with a letter and a number" : "Your password"}
            aria-describedby={error ? "auth-error" : undefined}
            className={inputClass}
          />
        </label>

        {error && (
          <p id="auth-error" role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-lavender py-3 text-base font-semibold text-ink transition-colors hover:bg-lavender-hover disabled:bg-lavender-soft disabled:text-ink-subtle"
        >
          {pending ? text.pending : text.submit}
        </button>
      </form>

      <p className="mt-5 text-center text-[15px] text-ink-muted">
        {text.switchPrompt}{" "}
        <button
          type="button"
          onClick={switchMode}
          className="font-semibold text-ink underline decoration-lavender decoration-2 underline-offset-4 hover:text-lavender-hover"
        >
          {text.switchAction}
        </button>
      </p>
    </div>
  );
}

/** One dialog for both signing in and signing up; a link at the bottom switches between them. */
export default function AuthDialog(props: Props) {
  const { mode, onClose } = props;
  return (
    <Modal open={mode !== null} onClose={onClose} label={mode === "signup" ? "Sign up" : "Sign in"}>
      {/* Unmounted while closed, so reopening starts with empty fields. */}
      {mode && <Form {...props} mode={mode} />}
    </Modal>
  );
}
