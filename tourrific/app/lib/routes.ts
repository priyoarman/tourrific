// Road trips get their own planner (route map instead of flights), so every
// entry point that turns a prompt into a URL goes through `plannerHref`.

const ROAD_TRIP = /\broad[\s-]?trips?\b/i;

export function isRoadTripPrompt(prompt: string) {
  return ROAD_TRIP.test(prompt);
}

export function plannerHref(prompt: string) {
  const path = isRoadTripPrompt(prompt) ? "/roadtrip" : "/plan";
  return `${path}?q=${encodeURIComponent(prompt)}`;
}
