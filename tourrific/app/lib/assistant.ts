import { findDestination, surpriseDestination } from "./destinations";
import { formatDate, formatPrice } from "./format";
import type { Destination, FlightOffer, Hotel, Trip } from "./types";

// A scripted stand-in for the AI planner. It reacts to a few intents so the
// page feels alive; replace `replyTo` with a call to the real chat API later.

export type ReplyAction =
  | { type: "set-destination"; destination: Destination }
  | { type: "sort-flights"; sort: "cheapest" }
  | { type: "sort-hotels"; sort: "price" };

export type Reply = { text: string; action?: ReplyAction };

type Context = {
  trip: Trip;
  flights: FlightOffer[];
  hotels: Hotel[];
  isFirst: boolean;
};

export const DEFAULT_SUGGESTIONS = ["Show cheaper flights", "Somewhere warm", "Surprise me"];

function opener(message: string) {
  const text = message.toLowerCase();
  if (text.includes("last-minute") || text.includes("last minute"))
    return "Spontaneous decisions are the best kind — nothing cures routine like packing a bag and running away for a few days!";
  if (text.includes("road trip"))
    return "A road trip it is! Winding mountain roads and cosy stops along the way sound perfect.";
  if (text.includes("inspire"))
    return "Let's find you somewhere special.";
  if (text.includes("surprise")) return "Ooh, I love a surprise.";
  return "Love it — let's make this happen.";
}

function tripSummary(trip: Trip) {
  const { destination: d } = trip;
  return `I've found round-trip flights from ${trip.origin.city} to **${d.city}, ${d.country}** ${d.flag} for ${formatDate(trip.departDate)} – ${formatDate(trip.returnDate)}, plus a handful of places to stay.`;
}

function cheapest<T>(items: T[], price: (item: T) => number) {
  return items.reduce((best, item) => (price(item) < price(best) ? item : best));
}

export function replyTo(message: string, ctx: Context): Reply {
  const text = message.toLowerCase();
  const current = ctx.trip.destination;

  if (text.includes("surprise")) {
    const destination = surpriseDestination(current);
    return {
      text: `${opener(message)} How about **${destination.city}**? I've swapped the flights and hotels over — have a look and tell me what you think.`,
      action: { type: "set-destination", destination },
    };
  }

  const found = findDestination(message);
  if (found && found.city !== current.city) {
    return {
      text: `${ctx.isFirst ? opener(message) + " " : ""}Great shout — **${found.city}** it is! I've pulled fresh flights and hotels for you. **Which flight fits your schedule best?**`,
      action: { type: "set-destination", destination: found },
    };
  }

  if (ctx.isFirst) {
    return {
      text: `${opener(message)}\n${tripSummary(ctx.trip)}\n**Which flight fits your schedule best?** Once you’ve picked one, choose where you’d like to stay.`,
    };
  }

  if (/(cheap|budget|price|afford)/.test(text)) {
    const flight = cheapest(ctx.flights, (f) => f.totalPrice);
    return {
      text: `I've sorted the flights by price. The best deal right now is **${flight.airline.name} at ${formatPrice(flight.totalPrice)}** round trip.`,
      action: { type: "sort-flights", sort: "cheapest" },
    };
  }

  if (/(hotel|stay|room|sleep)/.test(text)) {
    const hotel = cheapest(ctx.hotels, (h) => h.nightlyPrice);
    return {
      text: `Sorted the hotels by price for you. **${hotel.name}** is the best value at ${formatPrice(hotel.nightlyPrice)} a night in the ${hotel.area.toLowerCase()}.`,
      action: { type: "sort-hotels", sort: "price" },
    };
  }

  return {
    text: `Noted! I'll keep that in mind for your ${current.city} trip. You can also tell me a different city, a budget, or ask me to **surprise you**.`,
  };
}

export function welcomeMessage(trip: Trip) {
  return `Hi, I'm Tourrific AI ✦ Tell me where you'd like to go, or what kind of trip you're after.\nWhile you think, here are some ideas for **${trip.destination.city}** ${trip.destination.flag}.`;
}
