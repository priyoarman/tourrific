import type { Hotel } from "../types";
import type { DuffelOffer } from "./duffel";
import type { TripQuery } from "./trip-query";

// Events streamed by POST /api/flights/search-stream (server-sent events).
// A search sends several `status` lines, optionally a `message`, then `complete`
// if flights were searched, `hotels` if there is a stay to go with them, and
// always ends with `done`.

/** What the client remembers between messages so follow-ups ("a little later") work. */
export type SearchContext = {
  destination?: string | null;
  /** The previous search. While `awaiting` is set, the search that is still missing that answer. */
  tripQuery?: TripQuery | null;
  /** Set when the assistant asked for the return date of `tripQuery`, so the next message is read as that date. */
  awaiting?: "return_date" | null;
};

/** The request body the endpoint expects. */
export type SearchStreamRequest = {
  prompt: string;
  /** 1-based page of results, 7 per page. Defaults to 1. Ignored with `limit: "all"`. */
  page?: number;
  /** Ask for every offer at once, in compact form, instead of one page. */
  limit?: "all";
  context?: SearchContext;
};

/**
 * Why a search was turned away with a 429 before it started:
 * - `busy`: everyone's searches together reached the day's budget
 * - `burst`: this visitor sent too many in a minute
 * - `guest_limit`: a visitor who isn't logged in used up their day's searches
 * - `user_limit`: a logged-in user used up theirs
 */
export type SearchLimitReason = "busy" | "burst" | "guest_limit" | "user_limit";

/** The JSON body of that 429 answer. */
export type SearchLimitResponse = {
  success: false;
  reason: SearchLimitReason;
  message: string;
  /** Seconds until a new search would be accepted. Also sent as the Retry-After header. */
  retryAfterSeconds: number;
};

export type Pagination = {
  page: number;
  limit: number;
  totalOffers: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/** A progress line shown while the search runs, e.g. "Comparing prices across airlines...". */
export type StreamStatus = { text: string };

/** Something the assistant says: a question, an explanation, or an error. */
export type StreamMessage = { text: string; isError?: boolean };

/** The search finished and these are the flights. */
export type StreamComplete = {
  /** Destination airport code the search used. */
  destination: string;
  offers: DuffelOffer[];
  extracted: TripQuery;
  pagination: Pagination;
  /** The filters the search applied. `offers` and `pagination` only count flights that passed them. */
  filters?: {
    /** One short label per filter, e.g. "Direct", "Under €134". */
    labels: string[];
    /** How many flights there were before filtering. */
    unfilteredCount: number;
  };
};

/**
 * The hotels for the stay that goes with the flights in `complete`, which it
 * always follows. Not sent when there is no stay to search: a return on the day
 * of departure, an airport that isn't known, or any page of flights but the first.
 */
export type StreamHotels = {
  /** The first hotels Duffel found, in its order. Empty when it found none or the search failed. */
  hotels: Hotel[];
  /** How many Duffel found in all. */
  totalHotels: number;
  /** What was searched. */
  stay: {
    /** The city the hotels are in, e.g. "Lisbon". Null when the airport list doesn't name one. */
    city: string | null;
    /** "city" when the search was around the city centre; "airport" when only the airport could be found. */
    around: "city" | "airport";
    /** YYYY-MM-DD: the day of the outbound flight. */
    checkIn: string;
    /** YYYY-MM-DD: the day of the return flight. */
    checkOut: string;
    nights: number;
    /** True for a one-way trip, where the length of the stay is a guess. */
    nightsAssumed: boolean;
    guests: number;
    rooms: number;
  };
  /** True when the hotel search failed. The flights are unaffected. */
  failed?: boolean;
};

/** What the assistant asked for when it needs an answer before it can search. */
export type SearchQuestion = "destination" | "departure_date" | "return_date";

/** The stream is over. */
export type StreamDone = {
  /** True when the assistant asked a question and is waiting for the user's answer. */
  needsInput: boolean;
  /** What that question was about, so the app can suggest fitting answers. */
  asking?: SearchQuestion;
  context?: SearchContext;
};

/** Sent instead of everything else when the request itself is invalid (e.g. no prompt). */
export type StreamError = { message: string };

/** Event name → payload. Handy for typing a handler per event. */
export type StreamEventMap = {
  status: StreamStatus;
  message: StreamMessage;
  complete: StreamComplete;
  hotels: StreamHotels;
  done: StreamDone;
  error: StreamError;
};

export type StreamEventName = keyof StreamEventMap;

export type StreamEventHandlers = {
  [K in StreamEventName]?: (payload: StreamEventMap[K]) => void;
};
