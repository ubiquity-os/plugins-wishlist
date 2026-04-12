import { describe, expect, it } from "@jest/globals";
import { matchTimeLabel } from "../src/handlers/label-matcher";

describe("Label Matcher", () => {
  const standardLabels = ["Time: <1 Hour", "Time: <2 Hours", "Time: <4 Hours", "Time: <1 Day", "Time: <1 Week"];

  it("Should match <1 Hour for 0.5h estimate", () => {
    expect(matchTimeLabel(0.5, standardLabels)).toBe("Time: <1 Hour");
  });

  it("Should match <2 Hours for 1.5h estimate", () => {
    expect(matchTimeLabel(1.5, standardLabels)).toBe("Time: <2 Hours");
  });

  it("Should match <4 Hours for 3h estimate", () => {
    expect(matchTimeLabel(3, standardLabels)).toBe("Time: <4 Hours");
  });

  it("Should match <1 Day for 6h estimate", () => {
    expect(matchTimeLabel(6, standardLabels)).toBe("Time: <1 Day");
  });

  it("Should match <1 Week for 20h estimate", () => {
    expect(matchTimeLabel(20, standardLabels)).toBe("Time: <1 Week");
  });

  it("Should return largest label when estimate exceeds all", () => {
    expect(matchTimeLabel(100, standardLabels)).toBe("Time: <1 Week");
  });

  it("Should return null for empty labels array", () => {
    expect(matchTimeLabel(5, [])).toBeNull();
  });

  it("Should return first label for very small estimates", () => {
    expect(matchTimeLabel(0.1, standardLabels)).toBe("Time: <1 Hour");
  });

  it("Should match <1 Hour for exactly 1h estimate", () => {
    expect(matchTimeLabel(1, standardLabels)).toBe("Time: <1 Hour");
  });

  it("Should handle partial label sets", () => {
    const partialLabels = ["Time: <1 Hour", "Time: <1 Day"];
    expect(matchTimeLabel(5, partialLabels)).toBe("Time: <1 Day");
  });
});
