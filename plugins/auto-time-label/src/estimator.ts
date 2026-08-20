import { PluginConfig, TIME_LABELS } from './types';

export function sanitizeIssueContent(title: string, body: string): string {
  const cleanBody = body
    .replace(/Time:\s*<[^\n]+/gi, '')
    .replace(/Price:\s*\d+\s*USD/gi, '')
    .replace(/\b\d+\s*(hours?|hrs?|mins?|minutes?)\b/gi, '[duration]');
  return `Title: ${title}\n\nDescription:\n${cleanBody}`;
}

export function matchBestFittingTimeLabel(rawHoursEstimate: number, divisor: number = 15): string {
  const scaledHours = Math.max(0.1, rawHoursEstimate / Math.max(1, divisor));
  
  for (const bucket of TIME_LABELS) {
    if (scaledHours <= bucket.maxHours) {
      return bucket.label;
    }
  }
  return 'Time: <1 Week';
}
