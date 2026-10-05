import type { ChatMessage as Message } from "@/app/lib/types";

/** Renders **bold** segments and line breaks from the assistant's text. */
function RichText({ text }: { text: string }) {
  return text.split("\n").map((line, i) => (
    <p key={i}>
      {line.split("**").map((part, j) =>
        j % 2 === 1 ? (
          <strong key={j} className="font-semibold">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </p>
  ));
}

export default function ChatMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-lavender-soft px-5 py-3 text-[1.0625rem] text-ink">
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 pr-4 text-[1.0625rem] leading-relaxed text-ink">
      <RichText text={message.text} />
    </div>
  );
}
