export interface PlanCommandInput {
  owner: string;
  repo: string;
  issueNumber: number;
  issueBody: string;
  issueTitle: string;
}

export interface SubTask {
  title: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  timeEstimate?: string; // e.g., "2h", "1d"
}

export interface PlanResult {
  parentIssueNumber: number;
  childIssues: {
    issueNumber: number;
    title: string;
    priority?: string;
    timeEstimate?: string;
  }[];
}

export interface PluginConfig {
  defaultPriority?: 'high' | 'medium' | 'low';
  autoAssign?: boolean;
  labels?: {
    priority: {
      high: string;
      medium: string;
      low: string;
    };
    time: Record<string, string>;
  };
}
