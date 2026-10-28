import type { Prisma, Trip } from "@prisma/client";
import type { z } from "zod";
import { tripTotal } from "../trip-total.ts";
import type { FlightOffer, Hotel } from "../types";
import type { StreamHotels } from "../types/stream-events";
import prisma from "./prisma.ts";
import type { pickedTripSchema } from "./schemas.ts";

export type PickedTripInput = z.infer<typeof pickedTripSchema>;

export type StoredTrip = {
  id: string;
  userId: string | null;
  createdAt: Date;
  savedAt: Date | null;
  flight: FlightOffer;
  hotel: Hotel;
  stay: StreamHotels["stay"];
  sample: boolean;
};

export type TripSummary = {
  id: string;
  origin: string;
  destination: string;
  city: string | null;
  checkIn: string;
  checkOut: string;
  totalPrice: number | null;
  currency: string;
  sample: boolean;
  savedAt: Date;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTripId(value: string) {
  return UUID.test(value) ? value.toLowerCase() : null;
}

const toDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
const fromDate = (date: Date) => date.toISOString().slice(0, 10);

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
    currency: flight.currency,
    sample: sample ?? false,
  } satisfies Omit<Prisma.TripUncheckedCreateInput, "userId">;
}

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
    savedAt: row.savedAt!,
  };
}

export function tripForViewer({ userId, ...trip }: StoredTrip, viewerId: bigint | null) {
  const owner = userId === null ? null : viewerId !== null && userId === viewerId.toString() ? "you" : "someone-else";
  return { ...trip, owner } as const;
}

export async function createTrip(picked: PickedTripInput, userId: bigint | null) {
  const { id } = await prisma.trip.create({ data: { ...toTripRow(picked), userId }, select: { id: true } });
  return id;
}

export async function getTrip(id: string) {
  const row = await prisma.trip.findUnique({ where: { id } });
  return row ? toStoredTrip(row) : null;
}

export async function claimTrip(id: string, userId: bigint): Promise<"saved" | "not-found" | "owned-by-other"> {
  const { count } = await prisma.trip.updateMany({
    where: { id, savedAt: null, OR: [{ userId: null }, { userId }] },
    data: { userId, savedAt: new Date() },
  });
  if (count === 1) return "saved";

  const trip = await prisma.trip.findUnique({ where: { id }, select: { userId: true } });
  if (!trip) return "not-found";
  return trip.userId === userId ? "saved" : "owned-by-other";
}

export async function listTrips(userId: bigint) {
  const rows = await prisma.trip.findMany({
    where: { userId, savedAt: { not: null } },
    orderBy: { savedAt: "desc" },
    select: summaryColumns,
  });
  return rows.map(toTripSummary);
}

export async function deleteTrip(id: string, userId: bigint) {
  const { count } = await prisma.trip.deleteMany({ where: { id, userId } });
  return count === 1;
}

export const UNSAVED_TRIP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;

let lastCleanup = 0;

export function staleBefore(now: Date) {
  return new Date(now.getTime() - UNSAVED_TRIP_DAYS * DAY_MS);
}

export async function deleteStaleTrips(now = new Date()) {
  const { count } = await prisma.trip.deleteMany({ where: { savedAt: null, createdAt: { lt: staleBefore(now) } } });
  return count;
}

export async function deleteStaleTripsNowAndThen(now = new Date()) {
  if (now.getTime() - lastCleanup < CLEANUP_EVERY_MS) return;
  lastCleanup = now.getTime();
  try {
    const count = await deleteStaleTrips(now);
    if (count > 0) {
      console.info(`Deleted ${count} unsaved trip${count === 1 ? "" : "s"} older than ${UNSAVED_TRIP_DAYS} days.`);
    }
  } catch (error) {
    console.error("Could not delete old unsaved trips:", error);
  }
}
