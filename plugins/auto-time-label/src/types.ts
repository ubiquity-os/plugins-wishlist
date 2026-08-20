export interface PluginConfig {
  timeOffsetDivisor: number;
  defaultModel?: string;
}

export interface TimeLabelBucket {
  label: string;
  maxHours: number;
}

export const TIME_LABELS: TimeLabelBucket[] = [
  { label: 'Time: <15 Minutes', maxHours: 0.25 },
  { label: 'Time: <1 Hour', maxHours: 1.0 },
  { label: 'Time: <2 Hours', maxHours: 2.0 },
  { label: 'Time: <4 Hours', maxHours: 4.0 },
  { label: 'Time: <1 Day', maxHours: 8.0 },
  { label: 'Time: <1 Week', maxHours: 40.0 },
];
