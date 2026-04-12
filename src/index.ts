import { Context } from "../types";
import { isIssueOpenedEvent, isIssueEditedEvent } from "../types/typeguards";
import { estimateTime } from "./llm-estimator";
import { matchTimeLabel } from "./label-matcher";

/**
 * The main plugin function. Listens for issues.opened and issues.edited
 * and automatically sets a Time: label based on LLM estimation.
 */
export async function runPlugin(context: Context) {
  const { logger, payload, octokit, config } = context;

  if (!isIssueOpenedEvent(context) && !isIssueEditedEvent(context)) {
    logger.error(`Unsupported event: ${context.eventName}`);
    return;
  }

  const issue = payload.issue;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueNumber = issue.number;

  logger.info(`Processing issue #${issueNumber} in ${owner}/${repo}`, { eventName: context.eventName });

  // Get the issue body, stripping any existing Time: labels to remove bias
  const rawBody = issue.body || "";
  const cleanedBody = rawBody.replace(/Time:\s*<[^>]+>/gi, "").trim();

  if (!cleanedBody) {
    logger.info(`Issue #${issueNumber} has no content after cleaning, skipping.`);
    return;
  }

  // Get existing labels on the repo to find available Time: labels
  const repoLabels = await octokit.rest.issues.listLabelsForRepo({
    owner,
    repo,
    per_page: 100,
  });

  const timeLabels = repoLabels.data.filter((label) => /^Time:\s*</.test(label.name));

  if (timeLabels.length === 0) {
    logger.info(`No Time: labels found in ${owner}/${repo}, skipping.`);
    return;
  }

  const timeLabelNames = timeLabels.map((l) => l.name);

  logger.debug(`Found ${timeLabelNames.length} Time: labels: ${timeLabelNames.join(", ")}`);

  // Estimate time using LLM
  const rawEstimateHours = await estimateTime(context, cleanedBody, timeLabelNames);

  if (rawEstimateHours === null) {
    logger.error(`Failed to get time estimate for issue #${issueNumber}`);
    return;
  }

  // Apply offset
  const adjustedHours = rawEstimateHours / config.offsetDivisor;

  logger.info(`Raw estimate: ${rawEstimateHours}h, adjusted: ${adjustedHours}h (offset: /${config.offsetDivisor})`);

  // Match to best label
  const bestLabel = matchTimeLabel(adjustedHours, timeLabelNames);

  if (!bestLabel) {
    logger.error(`Could not match ${adjustedHours}h to any Time: label`);
    return;
  }

  logger.info(`Matched label: ${bestLabel} for ${adjustedHours}h estimate`);

  // Remove any existing Time: labels from the issue
  const currentLabels = issue.labels;
  for (const label of currentLabels) {
    const labelName = typeof label === "string" ? label : label.name;
    if (labelName && /^Time:\s*</.test(labelName)) {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: labelName,
      });
      logger.debug(`Removed existing label: ${labelName}`);
    }
  }

  // Add the new label
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [bestLabel],
  });

  logger.ok(`Successfully set Time label "${bestLabel}" on issue #${issueNumber}`);
}
