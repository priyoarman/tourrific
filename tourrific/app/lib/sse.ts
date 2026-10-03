// Reads a server-sent-events response and calls the matching handler for each
// event as it arrives. Ported from app/js/sse.js in the old frontend.

type Handlers = { [event: string]: ((payload: never) => void) | undefined };

function dispatch(block: string, handlers: Handlers) {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;

  const raw = dataLines.join("\n");
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }

  (handlers[event] as ((payload: unknown) => void) | undefined)?.(payload);
}

export async function consumeSseStream(response: Response, handlers: Handlers) {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Server responded with ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming is not supported in this browser.");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Events are separated by a blank line; keep any unfinished one for the next chunk.
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      if (block.trim()) dispatch(block, handlers);
    }
  }

  if (buffer.trim()) dispatch(buffer, handlers);
}
