/**
 * Parser module - breaks spec text into structured tasks
 * Extracts acceptance criteria, estimates time/priority labels
 */

export interface ParsedTask {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  files: string[];
  labels: string[];
}

const TIME_LABELS = [
  "Time: <15 Minutes",
  "Time: <1 Hour",
  "Time: <2 Hours",
  "Time: <4 Hours",
  "Time: <1 Day",
  "Time: <1 Week",
] as const;

const PRIORITY_KEYWORDS: Record<string, string[]> = {
  "Priority: 1 (Urgent)": ["critical", "urgent", "blocker", "security", "hotfix", "asap"],
  "Priority: 2 (Medium)": ["important", "needed", "required", "should", "feature"],
  "Priority: 3 (Low)": ["nice to have", "optional", "polish", "minor", "cleanup", "refactor"],
};

const COMPLEXITY_KEYWORDS: Record<string, { time: string; patterns: string[] }> = {
  trivial: { time: "Time: <15 Minutes", patterns: ["typo", "rename", "text change", "label"] },
  simple: { time: "Time: <1 Hour", patterns: ["add a", "simple", "config", "setting"] },
  moderate: { time: "Time: <2 Hours", patterns: ["implement", "create", "build", "add"] },
  complex: { time: "Time: <4 Hours", patterns: ["integrate", "refactor", "migrate", "redesign"] },
  large: { time: "Time: <1 Day", patterns: ["system", "architecture", "overhaul", "rewrite"] },
};

/**
 * Estimate time label based on task complexity
 */
function estimateTimeLabel(title: string, description: string, criteriaCount: number): string {
  const text = `${title} ${description}`.toLowerCase();

  // Score-based estimation
  for (const { time, patterns } of Object.values(COMPLEXITY_KEYWORDS)) {
    if (patterns.some((p) => text.includes(p))) {
      // Bump up if many criteria
      if (criteriaCount > 5) {
        const idx = TIME_LABELS.indexOf(time as (typeof TIME_LABELS)[number]);
        return idx < TIME_LABELS.length - 1 ? TIME_LABELS[Math.min(idx + 1, TIME_LABELS.length - 1)] : time;
      }
      return time;
    }
  }

  // Default based on criteria count
  if (criteriaCount <= 2) return "Time: <1 Hour";
  if (criteriaCount <= 4) return "Time: <2 Hours";
  return "Time: <4 Hours";
}

/**
 * Estimate priority label based on keywords
 */
function estimatePriorityLabel(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  for (const [label, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return label;
    }
  }

  return "Priority: 2 (Medium)";
}

/**
 * Match against available repo labels, falling back to the label itself
 */
function matchLabel(desiredLabel: string, availableLabels: string[]): string | null {
  // Exact match
  if (availableLabels.includes(desiredLabel)) return desiredLabel;
  // Partial match (case-insensitive)
  const lower = desiredLabel.toLowerCase();
  const match = availableLabels.find((l) => l.toLowerCase().includes(lower.split(":")[1]?.trim() ?? lower));
  return match ?? null;
}

/**
 * Parse a spec into structured tasks
 */
export async function parseSpec(spec: string, availableLabels: string[], _context?: unknown): Promise<ParsedTask[]> {
  const sections = splitSpecSections(spec);
  const tasks: ParsedTask[] = [];

  for (const section of sections) {
    const title = extractTitle(section);
    const description = extractDescription(section);
    const acceptanceCriteria = extractAcceptanceCriteria(section);
    const files = extractFiles(section);

    const timeLabel = estimateTimeLabel(title, description, acceptanceCriteria.length);
    const priorityLabel = estimatePriorityLabel(title, description);

    const labels: string[] = [];
    const matchedTime = matchLabel(timeLabel, availableLabels);
    if (matchedTime) labels.push(matchedTime);
    const matchedPriority = matchLabel(priorityLabel, availableLabels);
    if (matchedPriority) labels.push(matchedPriority);

    tasks.push({ title, description, acceptanceCriteria, files, labels });
  }

  return tasks;
}

/**
 * Split spec into logical sections (by headers or double newlines)
 */
function splitSpecSections(spec: string): string[] {
  const headerSplit = spec.split(/(?=^#{1,4}\s)/m).filter((s) => s.trim().length > 0);
  if (headerSplit.length > 1) return headerSplit;

  // Fallback: split by double newlines, group every 2-3 paragraphs
  const paragraphs = spec.split(/\n{2,}/).filter((s) => s.trim().length > 0);
  if (paragraphs.length <= 1) {
    return [spec];
  }

  // Group into chunks of ~2 paragraphs each
  const chunks: string[] = [];
  for (let i = 0; i < paragraphs.length; i += 2) {
    chunks.push(paragraphs.slice(i, i + 2).join("\n\n"));
  }
  return chunks;
}

function extractTitle(section: string): string {
  const headerMatch = section.match(/^#{1,4}\s+(.+)/m);
  if (headerMatch) return headerMatch[1].trim();
  const firstLine = section.split("\n")[0]?.trim() ?? "Untitled Task";
  return firstLine.replace(/^[-*]\s*/, "").substring(0, 100);
}

function extractDescription(section: string): string {
  const lines = section.split("\n");
  // Skip the title line and any criteria/files sections
  const descLines: string[] = [];
  let inCriteria = false;
  for (const line of lines.slice(1)) {
    if (/^#{1,4}\s+(acceptance|criteria)/i.test(line)) {
      inCriteria = true;
      continue;
    }
    if (/^#{1,4}\s+/i.test(line)) {
      inCriteria = false;
      continue;
    }
    if (inCriteria) continue;
    if (/^[-*]\s+\[.\]\s/.test(line)) continue;
    descLines.push(line);
  }
  return descLines.join("\n").trim() || "See parent issue for details.";
}

function extractAcceptanceCriteria(section: string): string[] {
  const criteria: string[] = [];
  const lines = section.split("\n");
  let inCriteria = false;
  for (const line of lines) {
    if (/^#{1,4}\s+(acceptance|criteria)/i.test(line)) {
      inCriteria = true;
      continue;
    }
    if (inCriteria && /^#{1,4}\s+/i.test(line)) {
      inCriteria = false;
      continue;
    }
    if (inCriteria || /^[-*]\s+\[.\]\s/.test(line)) {
      const match = line.match(/^[-*]\s+\[.\]\s+(.+)/);
      if (match) criteria.push(match[1].trim());
    }
  }
  return criteria;
}

function extractFiles(section: string): string[] {
  const files: string[] = [];
  const fileRegex = /`([^`]+\.[a-zA-Z]+)`/g;
  let match;
  while ((match = fileRegex.exec(section)) !== null) {
    if (!match[1].includes(" ")) files.push(match[1]);
  }
  return [...new Set(files)];
}
