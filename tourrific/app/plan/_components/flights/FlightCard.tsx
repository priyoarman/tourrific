import { LuggageIcon } from "@/app/components/ui/Icons";
import SelectButton from "@/app/components/ui/SelectButton";
import { formatPrice } from "@/app/lib/format";
import type { FlightOffer } from "@/app/lib/types";
import AirlineBadge from "./AirlineBadge";
import FlightLeg from "./FlightLeg";

type Props = {
  offer: FlightOffer;
  tags: string[];
  selected: boolean;
  onSelect: () => void;
};

export default function FlightCard({ offer, tags, selected, onSelect }: Props) {
  const price = formatPrice(offer.totalPrice, offer.currency);

  return (
    <li
      className={`rounded-3xl border bg-white p-5 shadow-[0_10px_30px_-18px_rgba(42,27,61,0.35)] transition-colors ${
        selected ? "border-lavender ring-2 ring-lavender/40" : "border-lavender-soft/70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AirlineBadge airline={offer.airline} />
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-ink">{offer.airline.name}</h3>
            <p className="truncate text-xs text-ink-muted">
              {[offer.cabin, offer.fareBrand !== offer.cabin && offer.fareBrand, offer.inbound ? "Round trip" : "One way"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        {tags.length > 0 && (
          <ul className="flex shrink-0 gap-1.5">
            {tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-lavender-soft/60 px-2.5 py-1 text-xs font-semibold text-ink"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <FlightLeg slice={offer.outbound} />
        {offer.inbound && (
          <>
            <div className="border-t border-dashed border-lavender-soft" />
            <FlightLeg slice={offer.inbound} />
          </>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <LuggageIcon size={15} />
          {offer.baggage}
        </p>
        <p className="text-right">
          <span className="block text-2xl font-bold text-ink">{price}</span>
          <span className="text-xs text-ink-muted">total</span>
        </p>
      </div>

      <div className="mt-4">
        <SelectButton
          selected={selected}
          onClick={onSelect}
          label={`${offer.airline.name} flight, ${price}`}
        />
      </div>
    </li>
  );
}
