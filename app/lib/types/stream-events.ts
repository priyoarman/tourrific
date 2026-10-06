import type { DuffelOffer } from "./duffel";
import type { TripQuery } from "./trip-query";

// Events streamed by POST /api/flights/search-stream (server-sent events).
// A search sends several `status` lines, optionally a `message`, then `complete`
// if flights were searched, and always ends with `done`.

/** What the client remembers between messages so follow-ups ("a little later") work. */
export type SearchContext = {
  destination?: string | null;
  tripQuery?: TripQuery | null;
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

/** The stream is over. */
export type StreamDone = {
  /** True when the assistant asked a question and is waiting for the user's answer. */
  needsInput: boolean;
  context?: SearchContext;
};

/** Sent instead of everything else when the request itself is invalid (e.g. no prompt). */
export type StreamError = { message: string };

/** Event name → payload. Handy for typing a handler per event. */
export type StreamEventMap = {
  status: StreamStatus;
  message: StreamMessage;
  complete: StreamComplete;
  done: StreamDone;
  error: StreamError;
};

export type StreamEventName = keyof StreamEventMap;

export type StreamEventHandlers = {
  [K in StreamEventName]?: (payload: StreamEventMap[K]) => void;
};
