type Handlers = { [event: string]: ((payload: never) => void) | undefined };

const SEPARATOR = "\n\n";

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
  let searchFrom = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let end: number;
    while ((end = buffer.indexOf(SEPARATOR, searchFrom)) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + SEPARATOR.length);
      searchFrom = 0;
      if (block.trim()) dispatch(block, handlers);
    }
    searchFrom = Math.max(buffer.length - (SEPARATOR.length - 1), 0);
  }

  if (buffer.trim()) dispatch(buffer, handlers);
}
