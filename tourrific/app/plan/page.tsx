import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isRoadTripPrompt, plannerHref } from "@/app/lib/routes";
import PlannerView from "./_components/PlannerView";

export const metadata: Metadata = {
  title: "Plan your trip – Tourrific",
  description: "Chat with Tourrific AI and compare flights and hotels side by side.",
};

export default async function PlanPage(props: PageProps<"/plan">) {
  const { q } = await props.searchParams;
  const prompt = (typeof q === "string" ? q : "").trim().slice(0, 500);
  if (isRoadTripPrompt(prompt)) redirect(plannerHref(prompt));

  // Keyed by prompt so arriving with a new prompt starts a fresh conversation.
  return <PlannerView key={prompt} initialPrompt={prompt} />;
}
