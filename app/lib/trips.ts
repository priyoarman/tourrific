import { api } from "./api.ts";
import type { PickedTrip } from "./types";

export type ViewedTrip = PickedTrip & {
  id: string;
  createdAt: string;
  savedAt: string | null;
  sample: boolean;
  owner: "you" | "someone-else" | null;
};

export type SavedTrip = {
  id: string;
  origin: string;
  destination: string;
  city: string | null;
  checkIn: string;
  checkOut: string;
  totalPrice: number | null;
  currency: string;
  sample: boolean;
  savedAt: string;
};

export async function createTrip(trip: PickedTrip, { sample = false } = {}) {
  const { id } = await api<{ id: string }>("/api/trips", { method: "POST", body: { ...trip, sample } });
  return id;
}

export async function getTrip(id: string) {
  const { trip } = await api<{ trip: ViewedTrip }>(`/api/trips/${encodeURIComponent(id)}`);
  return trip;
}

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
