export type DuffelAirline = {
  iata_code: string | null;
  name: string;
  logo_symbol_url?: string | null;
  logo_lockup_url?: string | null;
};

export type DuffelPlace = {
  iata_code: string;
  name?: string;
  city_name: string | null;
  iata_country_code: string;
  time_zone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  type?: "airport" | "city";
};

export type DuffelBaggage = {
  type: "checked" | "carry_on";
  quantity: number;
};

export type DuffelSegmentPassenger = {
  passenger_id?: string;
  cabin_class?: string;
  cabin_class_marketing_name: string;
  baggages: DuffelBaggage[];
};

export type DuffelSegment = {
  id?: string;
  departing_at: string;
  arriving_at: string;
  duration: string | null;
  origin: DuffelPlace;
  destination: DuffelPlace;
  origin_terminal?: string | null;
  destination_terminal?: string | null;
  marketing_carrier: DuffelAirline;
  operating_carrier?: DuffelAirline | null;
  marketing_carrier_flight_number: string;
  operating_carrier_flight_number?: string | null;
  aircraft?: { name: string } | null;
  passengers: DuffelSegmentPassenger[];
};

export type DuffelSlice = {
  id?: string;
  duration: string | null;
  fare_brand_name: string | null;
  origin: DuffelPlace;
  destination: DuffelPlace;
  segments: DuffelSegment[];
};

type DuffelCondition = {
  allowed: boolean;
  penalty_amount: string | null;
  penalty_currency: string | null;
} | null;

export type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  base_amount?: string;
  base_currency?: string;
  tax_amount?: string | null;
  tax_currency?: string | null;
  total_emissions_kg?: string | null;
  expires_at: string;
  owner: DuffelAirline;
  conditions?: {
    change_before_departure?: DuffelCondition;
    refund_before_departure?: DuffelCondition;
  } | null;
  passengers?: { id: string; type: string | null }[];
  slices: DuffelSlice[];
};
