import type { Hotel } from "../types";
import type { DuffelOffer } from "./duffel";
import type { TripQuery } from "./trip-query";

export type SearchContext = {
  destination?: string | null;
  tripQuery?: TripQuery | null;
  awaiting?: "return_date" | "departure_date" | null;
};

export type SearchStreamRequest = {
  prompt: string;
  page?: number;
  limit?: "all";
  context?: SearchContext;
};

export type SearchLimitReason = "busy" | "burst" | "guest_limit" | "user_limit";

export type SearchLimitResponse = {
  success: false;
  reason: SearchLimitReason;
  message: string;
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

export type StreamStatus = { text: string };

export type SearchScope = "flights" | "hotels" | "both";

export type StreamScope = { scope: SearchScope };

export type StreamMessage = { text: string; isError?: boolean };

export type StreamComplete = {
  destination: string;
  offers: DuffelOffer[];
  extracted: TripQuery;
  pagination: Pagination;
  filters?: {
    labels: string[];
    unfilteredCount: number;
  };
};

export type StreamHotels = {
  hotels: Hotel[];
  totalHotels: number;
  filters?: {
    labels: string[];
    unfilteredCount: number;
  };
  stay: {
    city: string | null;
    around: "city" | "airport";
    checkIn: string;
    checkOut: string;
    nights: number;
    nightsAssumed: boolean;
    guests: number;
    rooms: number;
  };
  failed?: boolean;
  sample?: boolean;
};

export type SearchQuestion = "destination" | "departure_date" | "return_date";

export type StreamDone = {
  needsInput: boolean;
  asking?: SearchQuestion;
  context?: SearchContext;
};

export type StreamError = { message: string };

export type StreamEventMap = {
  status: StreamStatus;
  message: StreamMessage;
  scope: StreamScope;
  complete: StreamComplete;
  hotels: StreamHotels;
  done: StreamDone;
  error: StreamError;
};

export type StreamEventName = keyof StreamEventMap;

export type StreamEventHandlers = {
  [K in StreamEventName]?: (payload: StreamEventMap[K]) => void;
};
