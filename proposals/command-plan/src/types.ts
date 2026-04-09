/**
 * Shared types for the command-plan plugin
 */

import type { Octokit } from "@octokit/rest";

export interface PluginConfig {
  aiModel?: string;
  maxTasks?: number;
}

export interface Context {
  logger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  };
  payload: {
    repository: {
      owner: { login: string };
      name: string;
    };
    comment: {
      body?: string;
      id: number;
    };
    issue: {
      number: number;
      html_url: string;
      body?: string;
      pull_request?: unknown;
    };
    action: string;
    sender: {
      login: string;
    };
  };
  octokit: Octokit;
  config?: PluginConfig;
}
