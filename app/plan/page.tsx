import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isRoadTripPrompt, plannerHref } from "@/app/lib/routes";
import PlannerView from "./_components/PlannerView";

export const metadata: Metadata = {
  title: "Tourrific's Plan for You",
  description: "Chat with Tourrific AI and compare flights and hotels side by side.",
};

export default async function PlanPage(props: PageProps<"/plan">) {
  const { q, to } = await props.searchParams;
  const prompt = (typeof q === "string" ? q : "").trim().slice(0, 500);
  // Set by the landing page's destination cards. A typed prompt takes precedence.
  const destination = prompt ? "" : (typeof to === "string" ? to : "").trim().slice(0, 60);
  if (isRoadTripPrompt(prompt)) redirect(plannerHref(prompt));

  // Keyed so arriving with a new prompt or destination starts a fresh conversation.
  return (
    <PlannerView
      key={prompt || `to:${destination}`}
      initialPrompt={prompt}
      initialDestination={destination}
    />
  );
}
