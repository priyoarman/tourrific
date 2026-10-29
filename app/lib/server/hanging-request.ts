// For tests: a request that never answers. Like a real open connection it keeps
// Node running until it is aborted, because the timer of AbortSignal.timeout()
// doesn't, and without it Node 22 stops before the timeout fires.
export function hangUntilAborted(signal?: AbortSignal | null) {
  return new Promise<never>((_resolve, reject) => {
    if (!signal) return;
    if (signal.aborted) return reject(signal.reason);

    const open = setInterval(() => {}, 60_000);
    signal.addEventListener(
      "abort",
      () => {
        clearInterval(open);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
