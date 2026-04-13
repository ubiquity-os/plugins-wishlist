import { classifyContributor, classifyContributors, getClassMultiplier, ContributorClass } from "./contributor-class";

/**
 * Plugin entry point: processes a webhook event and classifies contributors.
 */
export async function runPlugin(context: PluginContext): Promise<void> {
  const { logger, payload, octokit } = context;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;

  // Extract issue/pull data
  const issue = payload.issue;
  if (!issue) {
    logger.info("No issue in payload, skipping.");
    return;
  }

  const issueAuthorLogin = issue.user?.login ?? "";
  const assigneeLogins = (issue.assignees ?? []).map((a: { login: string }) => a.login);

  logger.info(`Classifying contributors for ${owner}/${repo}#${issue.number}`);

  // Fetch org members and repo collaborators (with error handling)
  let orgMembers: string[] = [];
  let repoCollaborators: string[] = [];

  try {
    const org = payload.repository.organization?.login;
    if (org) {
      const { fetchOrgMembers } = await import("./contributor-class");
      orgMembers = await fetchOrgMembers(octokit, org);
    }
  } catch (error) {
    logger.info(`Could not fetch org members: ${error}`);
  }

  try {
    const { fetchRepoCollaborators } = await import("./contributor-class");
    repoCollaborators = await fetchRepoCollaborators(octokit, owner, repo);
  } catch (error) {
    logger.info(`Could not fetch repo collaborators: ${error}`);
  }

  // Collect unique logins from issue participants
  const logins = new Set<string>();
  logins.add(issueAuthorLogin);
  for (const a of assigneeLogins) logins.add(a);
  if (payload.sender?.login) logins.add(payload.sender.login);

  // Classify each contributor
  const results = classifyContributors(Array.from(logins), {
    issueAuthorLogin,
    assigneeLogins,
    orgMembers,
    repoCollaborators,
  });

  for (const contributor of results) {
    const multiplier = getClassMultiplier(contributor.contributorClass);
    logger.ok(`${contributor.login}: ${contributor.contributorClass} (multiplier: ${multiplier})`);
  }
}

interface PluginContext {
  logger: { info: (msg: string) => void; ok: (msg: string) => void; error: (msg: string) => void };
  payload: {
    repository: { owner: { login: string }; name: string; organization?: { login: string } };
    issue?: { number: number; user?: { login: string }; assignees?: Array<{ login: string }> };
    sender?: { login: string };
  };
  octokit: {
    rest: {
      orgs: { listMembers: (params: { org: string; per_page: number; page: number }) => Promise<{ data: Array<{ login: string }> }> };
      repos: { listCollaborators: (params: { owner: string; repo: string; per_page: number; page: number }) => Promise<{ data: Array<{ login: string }> }> };
    };
  };
  config?: Record<string, unknown>;
}
