import { useAccount } from "@/app/components/account/AccountProvider";
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

/** Sign In and Sign Up buttons, for a visitor who has to sign in to go on. Gone once they have. */
function AuthButtons() {
  const { user, openAuth } = useAccount();
  if (user) return null;

  const button = "rounded-full px-4 py-2 text-[0.9375rem] font-medium text-ink transition-colors";
  return (
    <div className="flex flex-wrap gap-2 pt-1.5">
      <button
        type="button"
        onClick={() => openAuth("signin", "Sign in to keep searching.")}
        className={`${button} bg-lavender hover:bg-lavender-hover`}
      >
        Sign In
      </button>
      <button
        type="button"
        onClick={() => openAuth("signup", "Create a free account to keep searching.")}
        className={`${button} border border-lavender-soft bg-white hover:border-lavender hover:bg-lavender-soft/40`}
      >
        Sign Up
      </button>
    </div>
  );
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
      {message.action === "auth" && <AuthButtons />}
    </div>
  );
}
