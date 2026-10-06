import { describe, expect, it } from "vitest";
import { fifo, lru, optimal, parseReferences, runAllAlgorithms } from "@/lib/page-replacement";

describe("page replacement algorithms", () => {
  const pages = [1, 2, 3, 2, 4, 1, 5, 2, 1, 3];

  it("calculates the expected faults for the example", () => {
    expect(fifo(pages, 3).faults).toBe(8);
    expect(lru(pages, 3).faults).toBe(8);
    expect(optimal(pages, 3).faults).toBe(6);
  });

  it("counts a hit without changing the frame state", () => {
    const result = fifo([8, 3, 8], 2);
    expect(result.steps[2]).toEqual({ page: 8, frames: [8, 3], hit: true });
    expect(result.hits).toBe(1);
  });

  it("accepts space- and comma-separated references and rejects invalid input", () => {
    expect(parseReferences("1, 2  3").pages).toEqual([1, 2, 3]);
    expect(parseReferences("1, x").error).toBeTruthy();
    expect(parseReferences("").error).toBeTruthy();
  });

  it("produces a result for each algorithm", () => {
    expect(Object.keys(runAllAlgorithms([4, 5], 1))).toEqual(["fifo", "lru", "optimal"]);
  });
});