import Image from "next/image";
import Link from "next/link";
import DestinationCards from "./components/DestinationCards";
import Header from "./components/Header";
import PromptBox from "./components/PromptBox";
import TripsTailored from "./components/TripsTailored";
import { plannerHref } from "@/app/lib/routes";

const quickActions = [
  "Create a new trip",
  "Inspire me where to go",
  "Plan a road trip",
  "Plan a last-minute escape",
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <div className="relative isolate">
        {/*
          The backdrop runs past the bottom of the hero and fades out on an eased
          curve, so it melts into the page gradient without a visible edge.
        */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -bottom-72 -z-10 mask-[linear-gradient(to_bottom,#000_0%,#000_40%,rgb(0_0_0/0.93)_50%,rgb(0_0_0/0.78)_60%,rgb(0_0_0/0.56)_70%,rgb(0_0_0/0.33)_80%,rgb(0_0_0/0.14)_89%,rgb(0_0_0/0.03)_96%,transparent_100%)]"
        >
          <Image
            src="/images/hero-city.jpg"
            alt=""
            fill
            preload
            sizes="100vw"
            className="scale-105 object-cover blur-[2px]"
          />
          <div className="absolute inset-0 bg-linear-to-b from-[#f6f1ff]/45 via-[#efe8fb]/60 to-[#f3edfd]/85" />
        </div>

        <Header />

        <main className="mx-auto w-full max-w-278 px-5 pt-4 pb-14 sm:px-10 sm:pt-6 sm:pb-20">
          <DestinationCards />

          <div className="mt-8 sm:mt-14">
            <PromptBox />
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-2.5 sm:mt-14 sm:gap-4 lg:justify-between">
            {quickActions.map((action) => (
              <li key={action}>
                <Link
                  href={plannerHref(action)}
                  className="block rounded-full bg-white/60 px-4 py-2.5 text-sm font-medium text-ink backdrop-blur-sm transition-colors hover:bg-white sm:px-8 sm:py-4 sm:text-lg"
                >
                  {action}
                </Link>
              </li>
            ))}
          </ul>

        </main>
      </div>

      <TripsTailored />
    </div>
  );
}
