import type { Metadata } from "next";
import RoadTripView from "./_components/RoadTripView";

export const metadata: Metadata = {
  title: "Plan your road trip – Tourrific",
  description: "Chat with Tourrific AI, map your route stop by stop and pick a place to stay each night.",
};

export default async function RoadTripPage(props: PageProps<"/roadtrip">) {
  const { q } = await props.searchParams;
  const prompt = (typeof q === "string" ? q : "").trim().slice(0, 500);
  const today = new Date().toISOString().slice(0, 10);

  return <RoadTripView key={prompt} initialPrompt={prompt} today={today} />;
}
