export default function TypingIndicator() {
  return (
    <div role="status" className="flex items-center gap-1.5 py-2" aria-label="Tourrific AI is typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-2 animate-bounce rounded-full bg-lavender motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
