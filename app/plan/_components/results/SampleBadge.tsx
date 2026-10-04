/** Marks a results column whose contents are example data, not real availability. */
export default function SampleBadge() {
  return (
    <span
      title="Example data, not real availability or prices"
      className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold tracking-normal text-amber-900"
    >
      Sample
    </span>
  );
}
