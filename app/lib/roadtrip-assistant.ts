import { formatDate, formatDuration, formatNights } from "./format";
import { findRoute, surpriseRoute } from "./road-trips";
import type { RoadTrip, RoadTripRoute } from "./types";

// Scripted stand-in for the AI planner on the road trip page, like `assistant.ts`.

export type RoadTripReplyAction =
  | { type: "set-route"; route: RoadTripRoute }
  | { type: "focus-stop"; stopId: string }
  | { type: "sort-hotels"; sort: "price" };

export type RoadTripReply = { text: string; action?: RoadTripReplyAction };

export const ROAD_TRIP_SUGGESTIONS = ["Somewhere coastal", "Cheaper hotels", "Surprise me"];

function routeSummary(trip: RoadTrip) {
  const first = trip.stops[0];
  const last = trip.stops[trip.stops.length - 1];
  return `I've mapped out the **${trip.route.title}**: ${first.city} to ${last.city} over ${trip.nights} nights (${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}), with ${trip.stops.length} stops and about ${formatDuration(trip.totalDriveMinutes)} behind the wheel.`;
}

export function replyToRoadTrip(message: string, ctx: { trip: RoadTrip; isFirst: boolean }): RoadTripReply {
  const text = message.toLowerCase();
  const current = ctx.trip.route;

  if (text.includes("surprise")) {
    const route = surpriseRoute(current);
    return {
      text: `Ooh, I love a surprise. How about the **${route.title}** through ${route.region}? I've redrawn the map and found new places to stay.`,
      action: { type: "set-route", route },
    };
  }

  const found = findRoute(message);
  if (found && found.id !== current.id) {
    return {
      text: `${ctx.isFirst ? "A road trip it is! " : ""}Great shout — the **${found.title}** it is. Have a look at the route and tell me if you'd like more or fewer stops.`,
      action: { type: "set-route", route: found },
    };
  }

  if (ctx.isFirst) {
    return {
      text: `A road trip it is! Open roads and cosy stops along the way sound perfect.\n${routeSummary(ctx.trip)}\n**Pick a stop on the map** to choose where you'll sleep each night.`,
    };
  }

  const stop = ctx.trip.stops.find((s) => text.includes(s.city.toLowerCase().split(",")[0]));
  if (stop) {
    return {
      text: `Here are places to stay in **${stop.city}** for ${formatNights(stop.nights)}.`,
      action: { type: "focus-stop", stopId: stop.id },
    };
  }

  if (/(cheap|budget|price|afford|hotel|stay)/.test(text)) {
    return {
      text: "I've sorted the hotels by price, cheapest first. Switch stops to compare the other nights too.",
      action: { type: "sort-hotels", sort: "price" },
    };
  }

  return {
    text: `Noted! I'll keep that in mind for the ${current.title}. You can also name a region, ask for **somewhere coastal**, or ask me to **surprise you**.`,
  };
}

export function roadTripWelcome(trip: RoadTrip) {
  return `Hi, I'm Tourrific AI ✦ Tell me where you'd like to drive, or what kind of scenery you're after.\nWhile you think, here's an idea: the **${trip.route.title}** through ${trip.route.region}.`;
}
