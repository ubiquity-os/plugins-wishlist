/**
 * Standard Time: label thresholds in hours.
 * Maps label name → upper bound in hours.
 */
const TIME_THRESHOLDS: Record<string, number> = {
  "Time: <1 Hour": 1,
  "Time: <2 Hours": 2,
  "Time: <4 Hours": 4,
  "Time: <1 Day": 8,
  "Time: <1 Week": 40,
};

/**
 * Given an estimated number of hours and available label names,
 * returns the best matching Time: label.
 */
export function matchTimeLabel(estimatedHours: number, availableLabels: string[]): string | null {
  if (availableLabels.length === 0) return null;

  // Sort labels by threshold ascending
  const sorted = availableLabels
    .map((labelName) => ({
      name: labelName,
      threshold: TIME_THRESHOLDS[labelName] ?? parseThresholdFromName(labelName),
    }))
    .filter((l): l is { name: string; threshold: number } => l.threshold !== null)
    .sort((a, b) => a.threshold - b.threshold);

  if (sorted.length === 0) return availableLabels[0]; // fallback

  // Find the smallest label whose threshold >= estimatedHours
  for (const label of sorted) {
    if (estimatedHours <= label.threshold) {
      return label.name;
    }
  }

  // If estimate exceeds all labels, use the largest one
  return sorted[sorted.length - 1].name;
}

/**
 * Try to parse a threshold from a label name like "Time: <4 Hours" or "Time: <1 Day".
 */
function parseThresholdFromName(labelName: string): number | null {
  // eslint-disable-next-line sonarjs/null-dereference
  const match = labelName.match(/<(\d+)\s*(Minute|Hour|Day|Week)/i);
  if (!match) return null;

  const capturedNum = match[1];
  const capturedUnit = match[2];
  if (!capturedNum || !capturedUnit) return null;

  const value = parseInt(capturedNum, 10);
  switch (capturedUnit.toLowerCase()) {
    case "minute":
      return value / 60;
    case "hour":
      return value;
    case "day":
      return value * 8;
    case "week":
      return value * 40;
    default:
      return null;
  }
}
