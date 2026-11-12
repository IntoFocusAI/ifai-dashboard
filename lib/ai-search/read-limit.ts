export type ReadLimit = <T>(task: () => PromiseLike<T>) => Promise<T>;

/** Runs at most `max` tasks at once. The rest wait their turn in the order they were asked. */
export function createReadLimit(max: number): ReadLimit {
  let active = 0;
  const waiting: Array<() => void> = [];
  const next = () => {
    active -= 1;
    waiting.shift()?.();
  };
  return <T>(task: () => PromiseLike<T>) =>
    new Promise<T>((resolve, reject) => {
      const start = () => {
        active += 1;
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(next);
      };
      if (active < max) start();
      else waiting.push(start);
    });
}

/** The anon role has a 3-second statement timeout, so the history reads queue instead of all firing at once. */
export const HISTORY_READ_CONCURRENCY = 4;

/** Shared by every AI Search history read in the browser. */
export const historyReadLimit = createReadLimit(HISTORY_READ_CONCURRENCY);

/** The API-engine reads are a page or two per run. Their own queue keeps them from holding up the battery runs; four at a time lets a 30-day window of API runs finish while the battery runs load. */
export const apiReadLimit = createReadLimit(4);
