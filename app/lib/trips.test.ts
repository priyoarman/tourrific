import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError } from "./api.ts";
import { trip } from "./server/trip-fixtures.ts";
import type { TripSummary, tripForViewer } from "./server/trips.ts";
import { createTrip, deleteTrip, getTrip, listTrips, saveTrip, type SavedTrip, type ViewedTrip } from "./trips.ts";

type AsJson<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const viewedMatches: Same<ViewedTrip, AsJson<ReturnType<typeof tripForViewer>>> = true;
const savedMatches: Same<SavedTrip, AsJson<TripSummary>> = true;
void viewedMatches;
void savedMatches;

type Call = { url: string; method: string; body: unknown };
const realFetch = globalThis.fetch;

function stubFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return Response.json(body, { status });
  };
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

test("creates a trip and answers with its id", async () => {
  const calls = stubFetch(201, { success: true, id: ID });
  assert.equal(await createTrip(trip()), ID);
  assert.deepEqual(calls, [{ url: "/api/trips", method: "POST", body: { ...trip(), sample: false } }]);
});

test("says when the trip was built from sample results", async () => {
  const calls = stubFetch(201, { success: true, id: ID });
  await createTrip(trip(), { sample: true });
  assert.equal((calls[0].body as { sample: boolean }).sample, true);
});

test("reads one trip", async () => {
  const viewed = { ...trip(), id: ID, createdAt: "2026-10-28T10:00:00.000Z", savedAt: null, sample: false, owner: null };
  const calls = stubFetch(200, { success: true, trip: viewed });
  assert.deepEqual(await getTrip(ID), viewed);
  assert.deepEqual(calls, [{ url: `/api/trips/${ID}`, method: "GET", body: undefined }]);
});

test("saves, lists and deletes", async () => {
  const calls = stubFetch(200, { success: true, trips: [] });
  await saveTrip(ID);
  assert.deepEqual(await listTrips(), []);
  await deleteTrip(ID);
  assert.deepEqual(
    calls.map(({ method, url }) => `${method} ${url}`),
    [`POST /api/trips/${ID}/save`, "GET /api/trips", `DELETE /api/trips/${ID}`],
  );
});

test("keeps an id from changing the path", async () => {
  const calls = stubFetch(200, { success: true });
  await deleteTrip("../saved-flights/saved");
  assert.equal(calls[0].url, "/api/trips/..%2Fsaved-flights%2Fsaved");
});

test("passes the server's reason on", async () => {
  stubFetch(409, { success: false, message: "This trip belongs to someone else" });
  await assert.rejects(saveTrip(ID), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.message, "This trip belongs to someone else");
    return true;
  });
});
