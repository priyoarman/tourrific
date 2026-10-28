import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { airportCity } from "@/app/lib/server/airports";
import { getTrip, parseTripId } from "@/app/lib/server/trips";
import BudgetCard from "../_components/BudgetCard";
import HotelStayCard from "../_components/HotelStayCard";
import PlanHeader from "../_components/PlanHeader";
import ReturnFlightCard from "../_components/ReturnFlightCard";
import TripCalendarCard from "../_components/TripCalendarCard";
import TripOverviewCard from "../_components/TripOverviewCard";
import { toItineraryView } from "../itinerary-view";

// Read once per request, though both the metadata and the page ask for it.
const loadItinerary = cache(async (rawId: string) => {
  const id = parseTripId(rawId);
  const trip = id === null ? null : await getTrip(id);
  if (!trip) return null;

  const today = new Date().toISOString().slice(0, 10);
  return toItineraryView(trip, { today, cityOf: airportCity, sample: trip.sample });
});

export async function generateMetadata(props: PageProps<"/itinerary/[id]">): Promise<Metadata> {
  const view = await loadItinerary((await props.params).id);
  // notFound() marks the page noindex by itself.
  if (!view) return { title: "Trip not found – Tourrific" };
  return {
    title: `${view.overview.title} – Tourrific`,
    description: view.overview.description,
    // Anyone with the link can open a trip, but it isn't for search engines.
    robots: { index: false },
  };
}

/** A trip picked in the planner: its flight, hotel, budget and dates. */
export default async function TripItineraryPage(props: PageProps<"/itinerary/[id]">) {
  const view = await loadItinerary((await props.params).id);
  if (!view) notFound();

  return (
    // The dashboard is dense, so past phone widths it renders as it would with the browser zoomed out to 90%.
    <div className="mx-auto flex w-full max-w-400 flex-1 flex-col gap-5 px-5 pt-6 pb-5 sm:px-7 sm:zoom-[0.9]">
      <PlanHeader summary={view.summary} initials={null} />

      <main className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col gap-5">
          <TripOverviewCard trip={view.overview} />
          {/* Left out when the flight and hotel can't be added up. */}
          {view.budget && <BudgetCard budget={view.budget} />}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ReturnFlightCard flight={view.flight} />
          <HotelStayCard hotel={view.hotel} />
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2 xl:col-span-1">
          <TripCalendarCard calendar={view.calendar} plan={null} />
        </div>
      </main>
    </div>
  );
}
