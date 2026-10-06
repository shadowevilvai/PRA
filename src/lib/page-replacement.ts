export type AlgorithmId = "fifo" | "lru" | "optimal" | "lfu" | "clock";

export type SimulationStep = {
  page: number;
  frames: number[];
  hit: boolean;
  replaced?: number;
  reason?: string;
};

export type AlgorithmResult = {
  id: AlgorithmId;
  faults: number;
  hits: number;
  steps: SimulationStep[];
};

export function fifo(pages: number[], frameCount: number): AlgorithmResult {
  const frames: number[] = [];
  const steps: SimulationStep[] = [];
  let nextToReplace = 0;
  let faults = 0;

  for (const page of pages) {
    const hit = frames.includes(page);
    let replaced: number | undefined;
    let reason: string | undefined;

    if (hit) {
      reason = "Page already in memory.";
    } else {
      faults += 1;
      if (frames.length < frameCount) {
        frames.push(page);
        reason = "Empty frame available.";
      } else {
        replaced = frames[nextToReplace];
        frames[nextToReplace] = page;
        nextToReplace = (nextToReplace + 1) % frameCount;
        reason = `Replaced page ${replaced} (oldest in memory).`;
      }
    }
    steps.push({ page, frames: [...frames], hit, replaced, reason });
  }

  return { id: "fifo", faults, hits: pages.length - faults, steps };
}

export function lru(pages: number[], frameCount: number): AlgorithmResult {
  const frames: number[] = [];
  const lastUsed = new Map<number, number>();
  const steps: SimulationStep[] = [];
  let faults = 0;

  pages.forEach((page, index) => {
    const hit = frames.includes(page);
    let replaced: number | undefined;
    let reason: string | undefined;

    if (hit) {
      reason = "Page already in memory.";
    } else {
      faults += 1;
      if (frames.length < frameCount) {
        frames.push(page);
        reason = "Empty frame available.";
      } else {
        const leastRecent = frames.reduce((oldest, current) =>
          (lastUsed.get(current) ?? -1) < (lastUsed.get(oldest) ?? -1) ? current : oldest,
        );
        replaced = leastRecent;
        frames[frames.indexOf(leastRecent)] = page;
        reason = `Replaced page ${replaced} (least recently used).`;
      }
    }
    lastUsed.set(page, index);
    steps.push({ page, frames: [...frames], hit, replaced, reason });
  });

  return { id: "lru", faults, hits: pages.length - faults, steps };
}

export function optimal(pages: number[], frameCount: number): AlgorithmResult {
  const frames: number[] = [];
  const steps: SimulationStep[] = [];
  let faults = 0;

  pages.forEach((page, index) => {
    const hit = frames.includes(page);
    let replaced: number | undefined;
    let reason: string | undefined;

    if (hit) {
      reason = "Page already in memory.";
    } else {
      faults += 1;
      if (frames.length < frameCount) {
        frames.push(page);
        reason = "Empty frame available.";
      } else {
        const victim = frames.reduce((farthest, current) => {
          const currentNext = pages.indexOf(current, index + 1);
          const farthestNext = pages.indexOf(farthest, index + 1);
          return currentNext === -1 || (farthestNext !== -1 && currentNext > farthestNext)
            ? current
            : farthest;
        });
        replaced = victim;
        frames[frames.indexOf(victim)] = page;
        const nextUse = pages.indexOf(victim, index + 1);
        if (nextUse === -1) {
          reason = `Replaced page ${replaced} (never used again).`;
        } else {
          reason = `Replaced page ${replaced} (used furthest in future).`;
        }
      }
    }
    steps.push({ page, frames: [...frames], hit, replaced, reason });
  });

  return { id: "optimal", faults, hits: pages.length - faults, steps };
}

export function lfu(pages: number[], frameCount: number): AlgorithmResult {
  const frames: number[] = [];
  const frequencies = new Map<number, number>();
  const lastUsed = new Map<number, number>();
  const steps: SimulationStep[] = [];
  let faults = 0;

  pages.forEach((page, index) => {
    const hit = frames.includes(page);
    let replaced: number | undefined;
    let reason: string | undefined;

    if (hit) {
      reason = "Page already in memory.";
      frequencies.set(page, (frequencies.get(page) ?? 0) + 1);
    } else {
      faults += 1;
      if (frames.length < frameCount) {
        frames.push(page);
        reason = "Empty frame available.";
        frequencies.set(page, 1);
      } else {
        const leastFrequent = frames.reduce((victim, current) => {
          const vFreq = frequencies.get(victim) ?? 0;
          const cFreq = frequencies.get(current) ?? 0;
          if (cFreq < vFreq) return current;
          if (cFreq === vFreq) {
            return (lastUsed.get(current) ?? -1) < (lastUsed.get(victim) ?? -1) ? current : victim;
          }
          return victim;
        });
        replaced = leastFrequent;
        frames[frames.indexOf(leastFrequent)] = page;
        frequencies.delete(leastFrequent);
        frequencies.set(page, 1);
        reason = `Replaced page ${replaced} (least frequently used).`;
      }
    }
    lastUsed.set(page, index);
    steps.push({ page, frames: [...frames], hit, replaced, reason });
  });

  return { id: "lfu", faults, hits: pages.length - faults, steps };
}

export function clock(pages: number[], frameCount: number): AlgorithmResult {
  const frames: number[] = [];
  const useBits: boolean[] = [];
  const steps: SimulationStep[] = [];
  let pointer = 0;
  let faults = 0;

  pages.forEach((page) => {
    const hitIndex = frames.indexOf(page);
    let replaced: number | undefined;
    let reason: string | undefined;

    if (hitIndex !== -1) {
      reason = "Page already in memory (use bit set to 1).";
      useBits[hitIndex] = true;
    } else {
      faults += 1;
      if (frames.length < frameCount) {
        frames.push(page);
        useBits.push(true);
        reason = "Empty frame available.";
      } else {
        while (useBits[pointer]) {
          useBits[pointer] = false;
          pointer = (pointer + 1) % frameCount;
        }
        replaced = frames[pointer];
        frames[pointer] = page;
        useBits[pointer] = true;
        reason = `Replaced page ${replaced} (use bit was 0).`;
        pointer = (pointer + 1) % frameCount;
      }
    }
    steps.push({ page, frames: [...frames], hit, replaced, reason });
  });

  return { id: "clock", faults, hits: pages.length - faults, steps };
}

export function runAlgorithms(pages: number[], frameCount: number, ids: AlgorithmId[]): AlgorithmResult[] {
  const runners: Record<AlgorithmId, (p: number[], f: number) => AlgorithmResult> = {
    fifo,
    lru,
    optimal,
    lfu,
    clock,
  };
  return ids.map((id) => runners[id](pages, frameCount));
}

export function runAllAlgorithms(pages: number[], frameCount: number): Record<AlgorithmId, AlgorithmResult> {
  return {
    fifo: fifo(pages, frameCount),
    lru: lru(pages, frameCount),
    optimal: optimal(pages, frameCount),
    lfu: lfu(pages, frameCount),
    clock: clock(pages, frameCount),
  };
}

export function parseReferences(input: string): { pages?: number[]; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Enter a page reference string to continue." };
  if (!/^\d+(?:[\s,]+\d+)*$/.test(trimmed)) {
    return { error: "Use non-negative numbers separated by spaces or commas." };
  }
  const pages = trimmed.split(/[\s,]+/).map(Number);
  if (pages.some((page) => !Number.isSafeInteger(page))) {
    return { error: "Each page number must be a valid whole number." };
  }
  if (pages.length > 100) return { error: "Use 100 page references or fewer per simulation." };
  return { pages };
}
