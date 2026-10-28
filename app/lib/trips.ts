import { api } from "./api.ts";
import type { PickedTrip } from "./types";

/** A trip as GET /api/trips/:id sends it. */
export type ViewedTrip = PickedTrip & {
  id: string;
  /** ISO date-times. `savedAt` is null while nobody has saved the trip. */
  createdAt: string;
  savedAt: string | null;
  /** True when the flights and hotels were sample data. */
  sample: boolean;
  /** Whose trip it is: the visitor's, someone else's, or nobody's yet. */
  owner: "you" | "someone-else" | null;
};

/** One of the signed-in user's saved trips, as GET /api/trips lists it. */
export type SavedTrip = {
  id: string;
  /** Airport codes, e.g. "CPH". */
  origin: string;
  destination: string;
  city: string | null;
  /** YYYY-MM-DD. */
  checkIn: string;
  checkOut: string;
  /** Flight and hotel together, or null when they can't be added up. */
  totalPrice: number | null;
  currency: string;
  sample: boolean;
  /** ISO date-time. */
  savedAt: string;
};

/** Stores the picked trip and returns its id, for /itinerary/[id]. Works for guests too. */
export async function createTrip(trip: PickedTrip, { sample = false } = {}) {
  const { id } = await api<{ id: string }>("/api/trips", { method: "POST", body: { ...trip, sample } });
  return id;
}

export async function getTrip(id: string) {
  const { trip } = await api<{ trip: ViewedTrip }>(`/api/trips/${encodeURIComponent(id)}`);
  return trip;
}

/** Saves the trip for the signed-in user. A guest's trip becomes theirs. */
export async function saveTrip(id: string) {
  await api(`/api/trips/${encodeURIComponent(id)}/save`, { method: "POST" });
}

export async function listTrips() {
  const { trips } = await api<{ trips: SavedTrip[] }>("/api/trips");
  return trips;
}

export async function deleteTrip(id: string) {
  await api(`/api/trips/${encodeURIComponent(id)}`, { method: "DELETE" });
}
