"use client";

import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/app/lib/api";
import { logOut as endSession, useSession, type AuthUser, type Session } from "@/app/lib/auth-store";
import { findSaved, listSavedFlights, removeSavedFlight, saveFlight } from "@/app/lib/saved-flights";
import type { FlightOffer, SavedFlight } from "@/app/lib/types";
import AuthDialog, { type AuthMode } from "./AuthDialog";
import SavedTripsDrawer from "./SavedTripsDrawer";

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

export type SaveOutcome =
  | { status: "saved"; flight: SavedFlight }
  | { status: "removed" }
  /** A signed-out visitor was asked to sign in, and closed the dialog instead. */
  | { status: "needs-sign-in" }
  | { status: "error"; message: string };

type Account = {
  user: AuthUser | null;
  token: string | null;
  openAuth: (mode?: AuthMode, note?: string) => void;
  logOut: () => void;
  savedFlights: SavedFlight[];
  openSavedTrips: () => void;
  isSaved: (offer: FlightOffer) => boolean;
  /**
   * Saves the offer, or removes it if it is already saved. A signed-out visitor
   * is asked to sign in first; the answer then arrives once they have (or haven't).
   */
  toggleSaved: (offer: FlightOffer) => Promise<SaveOutcome>;
};

const AccountContext = createContext<Account | null>(null);

export function useAccount() {
  const account = use(AccountContext);
  if (!account) throw new Error("useAccount must be used inside <AccountProvider>");
  return account;
}

type SavedState = { token: string; flights: SavedFlight[]; status: "ready" | "error" };

/**
 * Everything about the visitor's account that more than one part of the page
 * needs: who is signed in, their saved flights, and the sign-in dialog and
 * saved-trips panel, which can be opened from anywhere.
 */
export default function AccountProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const token = session?.token ?? null;

  const [auth, setAuth] = useState<{ mode: AuthMode; note?: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saved, setSaved] = useState<SavedState | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  /** A flight a signed-out visitor tried to save; saved right after they sign in. */
  const pendingSave = useRef<{ offer: FlightOffer; done: (outcome: SaveOutcome) => void } | null>(null);

  // Saved flights belong to one login. Anything loaded for another is ignored.
  const current = saved && saved.token === token ? saved : null;
  const savedFlights = current?.flights ?? [];

  function update(forToken: string, change: (flights: SavedFlight[]) => SavedFlight[]) {
    setSaved((state) =>
      state?.token === forToken ? { ...state, flights: change(state.flights) } : state,
    );
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listSavedFlights(token)
      .then((flights) => {
        if (!cancelled) setSaved({ token, flights, status: "ready" });
      })
      .catch(() => {
        // An expired token has already been logged out by `api`.
        if (!cancelled) setSaved({ token, flights: [], status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function openAuth(mode: AuthMode = "signin", note?: string) {
    setDrawerOpen(false);
    setAuth({ mode, note });
  }

  function closeAuth() {
    pendingSave.current?.done({ status: "needs-sign-in" });
    pendingSave.current = null;
    setAuth(null);
  }

  function logOut() {
    setDrawerOpen(false);
    endSession();
  }

  /** Turns a failed request into something to show, asking to sign in again if the login ended. */
  function problem(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      openAuth("signin", SESSION_EXPIRED);
      return SESSION_EXPIRED;
    }
    return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }

  async function save(withToken: string, offer: FlightOffer): Promise<SaveOutcome> {
    try {
      const flight = await saveFlight(withToken, offer);
      update(withToken, (flights) => [...flights, flight]);
      return { status: "saved", flight };
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // The backend allows one saved fare per flight and departure time.
        return {
          status: "error",
          message: `**${offer.flightNumber}** is already in your saved trips at a different fare. Remove that one first to save this fare instead.`,
        };
      }
      return { status: "error", message: problem(error) };
    }
  }

  async function remove(withToken: string, flight: SavedFlight): Promise<SaveOutcome> {
    setRemovingId(flight.id);
    try {
      await removeSavedFlight(withToken, flight.id);
    } catch (error) {
      // Already gone (removed in another tab) is as good as removed.
      if (!(error instanceof ApiError && error.status === 404)) {
        return { status: "error", message: problem(error) };
      }
    } finally {
      setRemovingId(null);
    }
    update(withToken, (flights) => flights.filter((f) => f.id !== flight.id));
    return { status: "removed" };
  }

  async function toggleSaved(offer: FlightOffer): Promise<SaveOutcome> {
    if (!token) {
      setAuth({ mode: "signin", note: "Sign in to save this flight to your trips." });
      return new Promise((done) => {
        pendingSave.current = { offer, done };
      });
    }
    const existing = findSaved(savedFlights, offer);
    return existing ? remove(token, existing) : save(token, offer);
  }

  async function onSignedIn(next: Session) {
    const pending = pendingSave.current;
    pendingSave.current = null;
    setAuth(null);
    if (!pending) return;

    // Finish the save that prompted the sign-in, unless it was saved on an earlier visit.
    const { offer, done } = pending;
    try {
      const flights = await listSavedFlights(next.token);
      setSaved({ token: next.token, flights, status: "ready" });
      const existing = findSaved(flights, offer);
      done(existing ? { status: "saved", flight: existing } : await save(next.token, offer));
    } catch (error) {
      done({ status: "error", message: problem(error) });
    }
  }

  const account: Account = {
    user: session?.user ?? null,
    token,
    openAuth,
    logOut,
    savedFlights,
    openSavedTrips: () => setDrawerOpen(true),
    isSaved: (offer) => Boolean(findSaved(savedFlights, offer)),
    toggleSaved,
  };

  return (
    <AccountContext value={account}>
      {children}
      <AuthDialog
        mode={auth?.mode ?? null}
        note={auth?.note}
        onModeChange={(mode) => setAuth({ mode })}
        onClose={closeAuth}
        onSignedIn={onSignedIn}
      />
      <SavedTripsDrawer
        open={drawerOpen && Boolean(token)}
        onClose={() => setDrawerOpen(false)}
        user={session?.user ?? null}
        flights={savedFlights}
        status={current ? current.status : "loading"}
        removingId={removingId}
        onRemove={(flight) => token && remove(token, flight)}
        onLogOut={logOut}
      />
    </AccountContext>
  );
}
