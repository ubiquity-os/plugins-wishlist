import { parseSpec, type ParsedTask } from "./parser";
import { createChildIssue, linkSubIssue, postSummaryComment, getAvailableLabels } from "./github";
import type { Context } from "./types";

/**
 * Handles the /plan command in issue comments.
 * Reads the parent issue body as a spec, breaks it into child issues,
 * and links them as sub-issues.
 */
export async function handlePlanCommand(context: Context): Promise<void> {
  const { logger, payload, octokit } = context;
  const { repository, comment, issue } = payload;

  // Only trigger on /plan command
  const commentBody = comment.body?.trim() ?? "";
  if (!commentBody.startsWith("/plan")) {
    logger.info("Not a /plan command, skipping");
    return;
  }

  // Must be on an issue, not a PR
  if ("pull_request" in issue) {
    logger.info("Skipping /plan on pull request");
    return;
  }

  const owner = repository.owner.login;
  const repo = repository.name;
  const parentIssueNumber = issue.number;

  logger.info(`Processing /plan command on ${owner}/${repo}#${parentIssueNumber}`);

  // Fetch the full issue body
  const { data: parentIssue } = await octokit.issues.get({
    owner,
    repo,
    issue_number: parentIssueNumber,
  });

  const spec = parentIssue.body;
  if (!spec || spec.trim().length === 0) {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: parentIssueNumber,
      body: "⚠️ The issue body is empty. Please add a spec before using `/plan`.",
    });
    return;
  }

  // Acknowledge
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: parentIssueNumber,
    body: "🔄 Breaking down the spec into child issues...",
  });

  // Fetch available labels from the repo
  const availableLabels = await getAvailableLabels(octokit, owner, repo);

  // Parse the spec into tasks
  let tasks: ParsedTask[];
  try {
    tasks = await parseSpec(spec, availableLabels, context);
  } catch (error) {
    logger.error(`Failed to parse spec: ${error}`);
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: parentIssueNumber,
      body: `❌ Failed to parse spec: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  if (tasks.length === 0) {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: parentIssueNumber,
      body: "⚠️ Could not break down the spec into tasks. The spec may be too short or unclear.",
    });
    return;
  }

  logger.info(`Parsed ${tasks.length} tasks from spec`);

  // Create child issues
  const createdIssues: { number: number; title: string; url: string }[] = [];
  const maxTasks = context.config?.maxTasks ?? 10;
  const tasksToCreate = tasks.slice(0, maxTasks);

  for (const task of tasksToCreate) {
    try {
      const issueBody = buildIssueBody(task, parentIssue.html_url);

      const childIssue = await createChildIssue(octokit, {
        owner,
        repo,
        title: task.title,
        body: issueBody,
        labels: task.labels,
      });

      // Link as sub-issue
      await linkSubIssue(octokit, {
        owner,
        repo,
        issueNumber: parentIssueNumber,
        subIssueNumber: childIssue.number,
      });

      createdIssues.push({
        number: childIssue.number,
        title: task.title,
        url: childIssue.html_url,
      });

      logger.info(`Created child issue #${childIssue.number}: ${task.title}`);
    } catch (error) {
      logger.error(`Failed to create child issue "${task.title}": ${error}`);
    }
  }

  // Post summary comment
  await postSummaryComment(octokit, {
    owner,
    repo,
    issueNumber: parentIssueNumber,
    createdIssues,
  });

  logger.info(`/plan complete: created ${createdIssues.length} child issues`);
}

/**
 * Build the body for a child issue
 */
function buildIssueBody(task: ParsedTask, parentUrl: string): string {
  const parts: string[] = [];

  // Description
  parts.push(`## Description\n\n${task.description}`);

  // Acceptance criteria
  if (task.acceptanceCriteria.length > 0) {
    parts.push(`## Acceptance Criteria\n\n${task.acceptanceCriteria.map((c) => `- [ ] ${c}`).join("\n")}`);
  }

  // Files section
  if (task.files && task.files.length > 0) {
    parts.push(`## Files\n\n${task.files.map((f) => `- \`${f}\``).join("\n")}`);
  }

  // Parent reference
  parts.push(`\n---\n\n**Parent issue:** ${parentUrl}`);

  return parts.join("\n\n");
}

/**
 * Plugin entry point - registers the /plan command handler
 */
export const plugin = {
  name: "command-plan",
  handler: handlePlanCommand,
};
