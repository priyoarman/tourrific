import Link from "next/link";

export default function Logo({ className = "text-3xl sm:text-4xl" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-1.5 font-bold tracking-tight text-ink ${className}`}
    >
      Tourrific
      <span aria-hidden className="text-[0.6em]">
        ✦
      </span>
    </Link>
  );
}
