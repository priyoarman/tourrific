import { StarIcon } from "@/app/components/ui/Icons";

export default function StarRating({ stars }: { stars: number }) {
  return (
    <span className="flex items-center gap-0.5 text-amber-500" role="img" aria-label={`${stars}-star hotel`}>
      {Array.from({ length: stars }, (_, i) => (
        <StarIcon key={i} size={14} />
      ))}
    </span>
  );
}
