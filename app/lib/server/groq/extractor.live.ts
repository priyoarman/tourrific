// Run with `npm run test:extract`. Unlike the other tests this one calls Groq
// for real, so it needs GROQ_API_KEY in .env.local and spends a little quota.
// It is not part of `npm test`. Ported from the Express backend's
// api/src/groq/testExtract.js.
import assert from "node:assert/strict";
import { test } from "node:test";
import { extractTripQuery } from "./extractor.ts";

const PROMPT =
  "Find direct return flights from Copenhagen to Barcelona for 2 passengers from 2027-07-15 to 2027-07-22 under 2500 DKK with baggage included.";

test("Groq extracts a full flight search from one sentence", { skip: !process.env.GROQ_API_KEY && "GROQ_API_KEY is not set" }, async () => {
  const result = await extractTripQuery(PROMPT);
  console.log(JSON.stringify(result, null, 2));

  assert.equal(result.ok, true, result.errors.join(", "));
  assert.deepEqual(
    {
      trip_type: result.parsed?.trip_type,
      origin_airport: result.parsed?.origin_airport,
      destination_airport: result.parsed?.destination_airport,
      departure_date: result.parsed?.departure_date,
      return_date: result.parsed?.return_date,
      passengers: result.parsed?.passengers,
      direct_only: result.parsed?.direct_only,
      baggage_required: result.parsed?.baggage_required,
      max_price: result.parsed?.max_price,
      max_price_currency: result.parsed?.max_price_currency,
    },
    {
      trip_type: "return",
      origin_airport: "CPH",
      destination_airport: "BCN",
      departure_date: "2027-07-15",
      return_date: "2027-07-22",
      passengers: 2,
      direct_only: true,
      baggage_required: true,
      max_price: 2500,
      max_price_currency: "DKK",
    },
  );
});
