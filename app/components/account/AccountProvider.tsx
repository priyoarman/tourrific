"use client";

import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/app/lib/api";
import { confirmSession } from "@/app/lib/auth-api";
import { logOut as endSession, useSession, type AuthUser, type Session } from "@/app/lib/auth-store";
import { findSaved, listSavedFlights, removeSavedFlight, saveFlight } from "@/app/lib/saved-flights";
import { deleteTrip, listTrips, type SavedTrip } from "@/app/lib/trips";
import type { FlightOffer, SavedFlight } from "@/app/lib/types";
import AuthDialog, { type AuthMode } from "./AuthDialog";
import SavedTripsDrawer from "./SavedTripsDrawer";

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

export type SaveOutcome =
  | { status: "saved"; flight: SavedFlight }
  | { status: "removed" }
  | { status: "needs-sign-in" }
  | { status: "error"; message: string };

type Account = {
  user: AuthUser | null;
  openAuth: (mode?: AuthMode, note?: string, alert?: boolean) => void;
  logOut: () => void;
  savedFlights: SavedFlight[];
  openSavedTrips: () => void;
  isSaved: (offer: FlightOffer) => boolean;
  toggleSaved: (offer: FlightOffer) => Promise<SaveOutcome>;
  requireSignIn: (note: string) => Promise<boolean>;
};

const AccountContext = createContext<Account | null>(null);

export function useAccount() {
  const account = use(AccountContext);
  if (!account) throw new Error("useAccount must be used inside <AccountProvider>");
  return account;
}

type SavedState = { userId: string; flights: SavedFlight[]; status: "ready" | "error" };
type TripsState = { userId: string; trips: SavedTrip[]; status: "ready" | "error" };

export default function AccountProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const userId = session?.user.id ?? null;

  const [auth, setAuth] = useState<{ mode: AuthMode; note?: string; alert?: boolean } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saved, setSaved] = useState<SavedState | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savedTrips, setSavedTrips] = useState<TripsState | null>(null);
  const [removingTripId, setRemovingTripId] = useState<string | null>(null);
  const pendingSave = useRef<{ offer: FlightOffer; done: (outcome: SaveOutcome) => void } | null>(null);
  const pendingSignIn = useRef<((signedIn: boolean) => void) | null>(null);

  const current = saved && saved.userId === userId ? saved : null;
  const savedFlights = current?.flights ?? [];
  const currentTrips = savedTrips && savedTrips.userId === userId ? savedTrips : null;

  function update(forUser: string, change: (flights: SavedFlight[]) => SavedFlight[]) {
    setSaved((state) =>
      state?.userId === forUser ? { ...state, flights: change(state.flights) } : state,
    );
  }

  useEffect(() => {
    confirmSession();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listSavedFlights()
      .then((flights) => {
        if (!cancelled) setSaved({ userId, flights, status: "ready" });
      })
      .catch(() => {
        if (!cancelled) setSaved({ userId, flights: [], status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!drawerOpen || !userId) return;
    let cancelled = false;
    listTrips()
      .then((trips) => {
        if (!cancelled) setSavedTrips({ userId, trips, status: "ready" });
      })
      .catch(() => {
        if (!cancelled) setSavedTrips({ userId, trips: [], status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, userId]);

  function openAuth(mode: AuthMode = "signin", note?: string, alert?: boolean) {
    setDrawerOpen(false);
    setAuth({ mode, note, alert });
  }

  function closeAuth() {
    pendingSave.current?.done({ status: "needs-sign-in" });
    pendingSave.current = null;
    pendingSignIn.current?.(false);
    pendingSignIn.current = null;
    setAuth(null);
  }

  function logOut() {
    setDrawerOpen(false);
    endSession();
  }

  function problem(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      openAuth("signin", SESSION_EXPIRED);
      return SESSION_EXPIRED;
    }
    return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }

  async function save(forUser: string, offer: FlightOffer): Promise<SaveOutcome> {
    try {
      const flight = await saveFlight(offer);
      update(forUser, (flights) => [...flights, flight]);
      return { status: "saved", flight };
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        return {
          status: "error",
          message: `**${offer.flightNumber}** is already in your saved trips at a different fare. Remove that one first to save this fare instead.`,
        };
      }
      return { status: "error", message: problem(error) };
    }
  }

  async function remove(forUser: string, flight: SavedFlight): Promise<SaveOutcome> {
    setRemovingId(flight.id);
    try {
      await removeSavedFlight(flight.id);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        return { status: "error", message: problem(error) };
      }
    } finally {
      setRemovingId(null);
    }
    update(forUser, (flights) => flights.filter((f) => f.id !== flight.id));
    return { status: "removed" };
  }

  async function removeTrip(forUser: string, trip: SavedTrip) {
    setRemovingTripId(trip.id);
    try {
      await deleteTrip(trip.id);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        problem(error);
        return;
      }
    } finally {
      setRemovingTripId(null);
    }
    setSavedTrips((state) =>
      state?.userId === forUser ? { ...state, trips: state.trips.filter((t) => t.id !== trip.id) } : state,
    );
  }

  async function toggleSaved(offer: FlightOffer): Promise<SaveOutcome> {
    if (!userId) {
      setAuth({ mode: "signin", note: "Sign in to save this flight to your trips." });
      return new Promise((done) => {
        pendingSave.current = { offer, done };
      });
    }
    const existing = findSaved(savedFlights, offer);
    return existing ? remove(userId, existing) : save(userId, offer);
  }

  function requireSignIn(note: string) {
    if (userId) return Promise.resolve(true);
    pendingSignIn.current?.(false);
    setAuth({ mode: "signin", note });
    return new Promise<boolean>((done) => {
      pendingSignIn.current = done;
    });
  }

  async function onSignedIn(next: Session) {
    const pending = pendingSave.current;
    pendingSave.current = null;
    pendingSignIn.current?.(true);
    pendingSignIn.current = null;
    setAuth(null);
    if (!pending) return;

    const { offer, done } = pending;
    try {
      const flights = await listSavedFlights();
      setSaved({ userId: next.user.id, flights, status: "ready" });
      const existing = findSaved(flights, offer);
      done(existing ? { status: "saved", flight: existing } : await save(next.user.id, offer));
    } catch (error) {
      done({ status: "error", message: problem(error) });
    }
  }

  const account: Account = {
    user: session?.user ?? null,
    openAuth,
    logOut,
    savedFlights,
    openSavedTrips: () => setDrawerOpen(true),
    isSaved: (offer) => Boolean(findSaved(savedFlights, offer)),
    toggleSaved,
    requireSignIn,
  };

  return (
    <AccountContext value={account}>
      {children}
      <AuthDialog
        mode={auth?.mode ?? null}
        note={auth?.note}
        noteIsAlert={auth?.alert}
        onModeChange={(mode) => setAuth({ mode })}
        onClose={closeAuth}
        onSignedIn={onSignedIn}
      />
      <SavedTripsDrawer
        open={drawerOpen && Boolean(userId)}
        onClose={() => setDrawerOpen(false)}
        user={session?.user ?? null}
        flights={savedFlights}
        status={current ? current.status : "loading"}
        removingId={removingId}
        onRemove={(flight) => userId && remove(userId, flight)}
        trips={currentTrips?.trips ?? []}
        tripsStatus={currentTrips ? currentTrips.status : "loading"}
        removingTripId={removingTripId}
        onRemoveTrip={(trip) => userId && removeTrip(userId, trip)}
        onLogOut={logOut}
      />
    </AccountContext>
  );
}
