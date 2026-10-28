// Trips: a flight and a hotel picked together in the planner, kept so
// /itinerary/[id] can show them. A guest's trip has no owner until they sign in
// and save it; after that only the owner can delete it.
import type { Prisma, Trip } from "@prisma/client";
import type { z } from "zod";
import { tripTotal } from "../trip-total.ts";
import type { FlightOffer, Hotel } from "../types";
import type { StreamHotels } from "../types/stream-events";
import prisma from "./prisma.ts";
import type { pickedTripSchema } from "./schemas.ts";

/** A picked trip that passed `pickedTripSchema`. */
export type PickedTripInput = z.infer<typeof pickedTripSchema>;

/** A trip as the itinerary page reads it. */
export type StoredTrip = {
  id: string;
  /** The owner's id, or null for a guest's trip nobody has saved. */
  userId: string | null;
  createdAt: Date;
  /** When the owner saved it, or null while it isn't saved. */
  savedAt: Date | null;
  flight: FlightOffer;
  hotel: Hotel;
  stay: StreamHotels["stay"];
  sample: boolean;
};

/** A saved trip as the saved-trips list shows it, without the snapshots. */
export type TripSummary = {
  id: string;
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
  savedAt: Date;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The trip id in a URL, or null when it can't be one (Postgres would reject it). */
export function parseTripId(value: string) {
  return UUID.test(value) ? value.toLowerCase() : null;
}

// A date column takes a Date; midnight UTC keeps the day as written.
const toDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
const fromDate = (date: Date) => date.toISOString().slice(0, 10);

/** The columns of a new trip, without its owner. */
export function toTripRow({ flight, hotel, stay, sample }: PickedTripInput) {
  return {
    flight: flight as Prisma.InputJsonObject,
    hotel: hotel as Prisma.InputJsonObject,
    stay: stay as Prisma.InputJsonObject,
    origin: flight.outbound.origin,
    destination: flight.outbound.destination,
    city: stay.city,
    checkIn: toDate(stay.checkIn),
    checkOut: toDate(stay.checkOut),
    totalPrice: tripTotal(flight, hotel, stay),
    // A null total means the hotel may be priced in another currency; the flight's is the trip's.
    currency: flight.currency,
    sample: sample ?? false,
  } satisfies Omit<Prisma.TripUncheckedCreateInput, "userId">;
}

/** A row read back. The snapshots were checked by `pickedTripSchema` before they were stored. */
export function toStoredTrip(row: Trip): StoredTrip {
  return {
    id: row.id,
    userId: row.userId?.toString() ?? null,
    createdAt: row.createdAt,
    savedAt: row.savedAt,
    flight: row.flight as FlightOffer,
    hotel: row.hotel as Hotel,
    stay: row.stay as StreamHotels["stay"],
    sample: row.sample,
  };
}

const summaryColumns = {
  id: true,
  origin: true,
  destination: true,
  city: true,
  checkIn: true,
  checkOut: true,
  totalPrice: true,
  currency: true,
  sample: true,
  savedAt: true,
} satisfies Prisma.TripSelect;

type SummaryRow = Prisma.TripGetPayload<{ select: typeof summaryColumns }>;

export function toTripSummary(row: SummaryRow): TripSummary {
  return {
    id: row.id,
    origin: row.origin,
    destination: row.destination,
    city: row.city,
    checkIn: fromDate(row.checkIn),
    checkOut: fromDate(row.checkOut),
    totalPrice: row.totalPrice === null ? null : Number(row.totalPrice),
    currency: row.currency,
    sample: row.sample,
    // Only saved trips are listed.
    savedAt: row.savedAt!,
  };
}

/**
 * A trip as one visitor may see it: everything but the owner's id. `owner`
 * says whether the trip is theirs, someone else's, or nobody's yet.
 */
export function tripForViewer({ userId, ...trip }: StoredTrip, viewerId: bigint | null) {
  const owner = userId === null ? null : viewerId !== null && userId === viewerId.toString() ? "you" : "someone-else";
  return { ...trip, owner } as const;
}

/** Stores a picked trip and returns its id. A signed-in user owns it from the start, but it isn't saved yet. */
export async function createTrip(picked: PickedTripInput, userId: bigint | null) {
  const { id } = await prisma.trip.create({ data: { ...toTripRow(picked), userId }, select: { id: true } });
  return id;
}

export async function getTrip(id: string) {
  const row = await prisma.trip.findUnique({ where: { id } });
  return row ? toStoredTrip(row) : null;
}

/**
 * Saves the trip for `userId`, who becomes its owner if it had none.
 * - `saved`: it is saved now, or already was by this user
 * - `not-found`: there is no such trip
 * - `owned-by-other`: someone else owns it, so it is left alone
 */
export async function claimTrip(id: string, userId: bigint): Promise<"saved" | "not-found" | "owned-by-other"> {
  // One conditional update, so two users saving the same guest trip at once can't both win.
  const { count } = await prisma.trip.updateMany({
    where: { id, savedAt: null, OR: [{ userId: null }, { userId }] },
    data: { userId, savedAt: new Date() },
  });
  if (count === 1) return "saved";

  const trip = await prisma.trip.findUnique({ where: { id }, select: { userId: true } });
  if (!trip) return "not-found";
  return trip.userId === userId ? "saved" : "owned-by-other";
}

/** The user's saved trips, the most recently saved first. */
export async function listTrips(userId: bigint) {
  const rows = await prisma.trip.findMany({
    where: { userId, savedAt: { not: null } },
    orderBy: { savedAt: "desc" },
    select: summaryColumns,
  });
  return rows.map(toTripSummary);
}

/** Deletes the trip if `userId` owns it. False when there was no such trip of theirs. */
export async function deleteTrip(id: string, userId: bigint) {
  const { count } = await prisma.trip.deleteMany({ where: { id, userId } });
  return count === 1;
}
