const ROAD_TRIP = /\broad[\s-]?trips?\b/i;

export function isRoadTripPrompt(prompt: string) {
  return ROAD_TRIP.test(prompt);
}

export function destinationHref(city: string) {
  return `/plan?to=${encodeURIComponent(city)}`;
}

export function plannerHref(prompt: string) {
  const path = isRoadTripPrompt(prompt) ? "/roadtrip" : "/plan";
  return `${path}?q=${encodeURIComponent(prompt)}`;
}
