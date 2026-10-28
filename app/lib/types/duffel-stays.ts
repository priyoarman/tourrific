export type DuffelStaysRate = {
  total_amount: string;
  total_currency: string;
  cancellation_timeline?: { before: string; refund_amount: string; currency: string }[] | null;
};

export type DuffelStaysAccommodation = {
  id: string;
  name: string;
  rating: number | null;
  review_score: number | null;
  review_count?: number | null;
  photos?: { url: string }[] | null;
  amenities?: { type: string; description: string }[] | null;
  location: {
    address?: {
      line_one?: string | null;
      city_name?: string | null;
      postal_code?: string | null;
      region?: string | null;
      country_code?: string | null;
    } | null;
    geographic_coordinates?: { latitude: number; longitude: number } | null;
  };
  rooms?: { rates?: DuffelStaysRate[] | null }[] | null;
};

export type DuffelStaysResult = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  accommodation: DuffelStaysAccommodation;
  cheapest_rate_total_amount: string;
  cheapest_rate_currency: string;
};
