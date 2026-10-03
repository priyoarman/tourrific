import prisma from "../db/code/prisma.js";
import { saveFlightSchema } from "../schemas/save-flight-schemas.js";
import { serialize } from "../utils/serialize.js";

/**
 * @openapi
 * /api/saved-flights/saved:
 *   get:
 *     summary: View Saved Flights
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved flights
 *       401:
 *         description: Authentication required
 */

export async function getSaved(req, res, next) {
  try {
    const rawUserId = req.user?.userId;

    if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId =
      typeof rawUserId === "bigint" ? rawUserId : BigInt(rawUserId);

    const flights = await prisma.savedOffer.findMany({
      where: { userId },
      include: { currency: true },
      orderBy: { departureTime: "asc" },
    });

    return res.status(200).json({
      success: true,
      flights: serialize(flights),
    });
  } catch (error) {
    next(error);
  }
}
/**
 * @openapi
 * /api/saved-flights/save:
 *   post:
 *     summary: Save a new flight
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               flight_number: { type: string }
 *               origin: { type: string }
 *               destination: { type: string }
 *               price: { type: number }
 *               departure_time: { type: string, format: date-time }
 *               currency_id: { type: integer }
 *               airline_code: { type: string }
 *               airline_name: { type: string }
 *     responses:
 *       201:
 *         description: Flight saved successfully
 *       400:
 *         description: Invalid input or currency
 *       401:
 *         description: Authentication required
 *       409:
 *         description: Flight already saved
 */

export async function saveFlight(req, res, next) {
  try {
    const rawUserId = req.user?.userId;

    if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId =
      typeof rawUserId === "bigint" ? rawUserId : BigInt(rawUserId);

    const validation = saveFlightSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const {
      flight_number,
      origin,
      destination,
      price,
      departure_time,
      currency_id,
      currency_code,
      airline_code,
      airline_name,
    } = validation.data;

    const existing = await prisma.savedOffer.findFirst({
      where: {
        userId,
        flightNumber: flight_number,
        departureTime: new Date(departure_time),
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Flight already saved",
      });
    }

    let currencyId = currency_id ?? null;

    if (currency_id) {
      const currency = await prisma.currency.findUnique({
        where: { id: currency_id },
      });

      if (!currency) {
        return res.status(400).json({
          success: false,
          message: "Invalid currency_id",
        });
      }
    } else if (currency_code) {
      // An unknown code is saved without a currency rather than rejected.
      const currency = await prisma.currency.findUnique({
        where: { code: currency_code },
      });
      currencyId = currency?.id ?? null;
    }

    const savedFlight = await prisma.savedOffer.create({
      data: {
        userId,
        flightNumber: flight_number,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        price,
        currencyId,
        departureTime: new Date(departure_time),
        airlineCode: airline_code ?? null,
        airlineName: airline_name ?? null,
      },
      include: { currency: true },
    });

    return res.status(201).json({
      success: true,
      flight: serialize(savedFlight),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @openapi
 * /api/saved-flights/save/{id}:
 *   delete:
 *     summary: Remove a saved flight
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Flight removed
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Flight not found
 */

export async function removeFlight(req, res, next) {
  try {
    const rawUserId = req.user?.userId;

    if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId =
      typeof rawUserId === "bigint" ? rawUserId : BigInt(rawUserId);
    const id = BigInt(req.params.id);

    const flight = await prisma.savedOffer.findFirst({
      where: { id, userId },
    });

    if (!flight) {
      return res.status(404).json({
        success: false,
        message: "Flight not found",
      });
    }

    await prisma.savedOffer.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Flight removed",
    });
  } catch (error) {
    next(error);
  }
}
