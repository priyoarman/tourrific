import { ArrowRightIcon, BedIcon } from "@/app/components/ui/Icons";
import SampleBadge from "@/app/plan/_components/results/SampleBadge";
import { sampleTrip } from "../sample-trip";
import SceneArt from "./SceneArt";
import SectionCard from "./SectionCard";

type Props = { hotel: typeof sampleTrip.hotel };

export default function HotelStayCard({ hotel }: Props) {
  return (
    <SectionCard icon={<BedIcon size={17} />} title="Hotel" badge={<SampleBadge />} aside={hotel.price}>
      <div className="mt-4 flex items-center gap-3">
        <div className="size-11 shrink-0 overflow-hidden rounded-xl">
          <SceneArt scene="island" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">{hotel.name}</h3>
          <p className="mt-0.5 truncate text-xs text-ink-subtle">{hotel.details.join("  ·  ")}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <StayDate label="Check-in" {...hotel.checkIn} />
        <ArrowRightIcon size={15} className="text-ink-muted" />
        <StayDate label="Check-out" {...hotel.checkOut} />
      </div>
    </SectionCard>
  );
}

function StayDate({ label, date, time }: { label: string; date: string; time: string }) {
  return (
    <div className="rounded-2xl bg-lavender-soft/45 px-4 py-2.5">
      <p className="text-[0.65rem] font-semibold tracking-widest text-ink-subtle uppercase">{label}</p>
      <p className="mt-1 text-base font-bold text-ink">{date}</p>
      <p className="mt-0.5 text-xs text-ink-subtle">{time}</p>
    </div>
  );
}
