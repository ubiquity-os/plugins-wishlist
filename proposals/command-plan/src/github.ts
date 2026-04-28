import { Octokit } from "@octokit/rest";

export interface GitHubHelpers {
  createIssue: (
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[]
  ) => Promise<number>;

  addComment: (
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ) => Promise<void>;

  linkSubIssue: (
    owner: string,
    repo: string,
    parentIssueNumber: number,
    childIssueNumber: number
  ) => Promise<void>;

  addLabels: (
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[]
  ) => Promise<void>;
}

export function createGitHubHelpers(octokit: Octokit): GitHubHelpers {
  return {
    async createIssue(owner, repo, title, body, labels = []) {
      const response = await octokit.issues.create({
        owner,
        repo,
        title,
        body,
        labels,
      });
      return response.data.number;
    },

    async addComment(owner, repo, issueNumber, body) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
    },

    async linkSubIssue(owner, repo, parentIssueNumber, childIssueNumber) {
      // Using the sub_issues REST API (GitHub feature)
      await octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues",
        {
          owner,
          repo,
          issue_number: parentIssueNumber,
          sub_issue_id: childIssueNumber,
        }
      );
    },

    async addLabels(owner, repo, issueNumber, labels) {
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
      });
    },
  };
}
