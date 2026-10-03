type TripQuery = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  travelers: number;
  travelClass: 'economy' | 'business' | 'first';
};

export default TripQuery;