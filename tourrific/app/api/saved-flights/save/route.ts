import { requireUser } from "@/app/lib/server/auth";
import { handle, readJson, serialize } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";
import { saveFlightSchema } from "@/app/lib/server/schemas";

/** POST /api/saved-flights/save — saves a flight for the signed-in user. */
export const POST = handle(async (request: Request) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const validation = saveFlightSchema.safeParse(await readJson(request));
  if (!validation.success) {
    return Response.json({ success: false, errors: validation.error.flatten().fieldErrors }, { status: 400 });
  }

  const flight = validation.data;

  // One saved fare per flight and departure time.
  const existing = await prisma.savedOffer.findFirst({
    where: { userId: user.userId, flightNumber: flight.flight_number, departureTime: flight.departure_time },
  });
  if (existing) {
    return Response.json({ success: false, message: "Flight already saved" }, { status: 409 });
  }

  let currencyId = flight.currency_id ?? null;
  if (flight.currency_id) {
    const currency = await prisma.currency.findUnique({ where: { id: flight.currency_id } });
    if (!currency) {
      return Response.json({ success: false, message: "Invalid currency_id" }, { status: 400 });
    }
  } else if (flight.currency_code) {
    // An unknown code is saved without a currency rather than rejected.
    const currency = await prisma.currency.findUnique({ where: { code: flight.currency_code } });
    currencyId = currency?.id ?? null;
  }

  const saved = await prisma.savedOffer.create({
    data: {
      userId: user.userId,
      flightNumber: flight.flight_number,
      origin: flight.origin.toUpperCase(),
      destination: flight.destination.toUpperCase(),
      price: flight.price,
      currencyId,
      departureTime: flight.departure_time,
      airlineCode: flight.airline_code ?? null,
      airlineName: flight.airline_name ?? null,
    },
    include: { currency: true },
  });

  return Response.json({ success: true, flight: serialize(saved) }, { status: 201 });
});
