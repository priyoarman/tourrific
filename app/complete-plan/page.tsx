import type { Metadata } from "next";
import { BookmarkIcon, MailIcon } from "@/app/components/ui/Icons";
import BudgetCard from "./_components/BudgetCard";
import HotelStayCard from "./_components/HotelStayCard";
import MapCard from "./_components/MapCard";
import PlacesToVisit from "./_components/PlacesToVisit";
import PlanHeader from "./_components/PlanHeader";
import ReturnFlightCard from "./_components/ReturnFlightCard";
import TripCalendarCard from "./_components/TripCalendarCard";
import TripOverviewCard from "./_components/TripOverviewCard";
import WeatherCard from "./_components/WeatherCard";
import { sampleTrip } from "./sample-trip";

export const metadata: Metadata = {
  title: "Your complete plan – Tourrific",
  description: "Your whole trip on one page: flights, hotel, budget, calendar, map and weather.",
};

const actionClass =
  "flex flex-1 items-center justify-center gap-2.5 rounded-full py-4 text-sm font-semibold transition-colors";

export default function CompletePlanPage() {
  const trip = sampleTrip;

  return (
    // The dashboard is dense, so past phone widths it renders as it would with the browser zoomed out to 90%.
    <div className="mx-auto flex w-full max-w-400 flex-1 flex-col gap-5 px-5 pt-6 pb-5 sm:px-7 sm:[zoom:0.9]">
      <PlanHeader summary={trip.summary} initials={trip.travellerInitials} />

      <main className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col gap-5">
          <TripOverviewCard trip={trip} />
          <BudgetCard lines={trip.budget} days={trip.days} />
          <div className="flex gap-3">
            <button type="button" className={`${actionClass} bg-ink text-white hover:bg-ink/90`}>
              <BookmarkIcon size={16} />
              Save trip
            </button>
            <button type="button" className={`${actionClass} bg-lavender-soft text-ink hover:bg-lavender`}>
              <MailIcon size={16} />
              Send by email
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ReturnFlightCard price={trip.flight.price} legs={trip.flight.legs} />
          <HotelStayCard hotel={trip.hotel} />
          <PlacesToVisit places={trip.places} />
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2 xl:col-span-1">
          <TripCalendarCard calendar={trip.calendar} plan={trip.plan} />
          <MapCard stops={trip.mapStops} />
          <WeatherCard summary={trip.weather.summary} days={trip.weather.days} />
        </div>
      </main>
    </div>
  );
}
