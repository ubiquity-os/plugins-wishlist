/**
 * Contributor Class Detection
 *
 * Identifies the "class" of a contributor based on their relationship to an issue/pull:
 * 1. specification_author — original author of the issue/task
 * 2. assignee — responsible for the deliverable
 * 3. collaborator — added to the org/repo as an official team member
 * 4. contributor — the default option (external contributor)
 */

export enum ContributorClass {
  SPECIFICATION_AUTHOR = "specification_author",
  ASSIGNEE = "assignee",
  COLLABORATOR = "collaborator",
  CONTRIBUTOR = "contributor",
}

export interface ContributorInfo {
  login: string;
  contributorClass: ContributorClass;
  isOrgMember: boolean;
  isRepoCollaborator: boolean;
}

export interface IssueContext {
  issueAuthorLogin: string;
  assigneeLogins: string[];
  orgMembers: string[];
  repoCollaborators: string[];
}

/**
 * Determine the class of a contributor based on their relationship to the issue.
 * Priority: specification_author > assignee > collaborator > contributor
 */
export function classifyContributor(login: string, context: IssueContext): ContributorInfo {
  const isOrgMember = context.orgMembers.includes(login);
  const isRepoCollaborator = context.repoCollaborators.includes(login);

  let contributorClass: ContributorClass;

  if (login === context.issueAuthorLogin) {
    contributorClass = ContributorClass.SPECIFICATION_AUTHOR;
  } else if (context.assigneeLogins.includes(login)) {
    contributorClass = ContributorClass.ASSIGNEE;
  } else if (isOrgMember || isRepoCollaborator) {
    contributorClass = ContributorClass.COLLABORATOR;
  } else {
    contributorClass = ContributorClass.CONTRIBUTOR;
  }

  return {
    login,
    contributorClass,
    isOrgMember,
    isRepoCollaborator,
  };
}

/**
 * Classify multiple contributors at once.
 */
export function classifyContributors(logins: string[], context: IssueContext): ContributorInfo[] {
  return logins.map((login) => classifyContributor(login, context));
}

/**
 * Get the reward multiplier for a contributor class.
 * Default multipliers can be overridden via config.
 */
export function getClassMultiplier(
  contributorClass: ContributorClass,
  config?: Record<string, number>
): number {
  const defaults: Record<string, number> = {
    [ContributorClass.SPECIFICATION_AUTHOR]: 1.0,
    [ContributorClass.ASSIGNEE]: 1.0,
    [ContributorClass.COLLABORATOR]: 0.75,
    [ContributorClass.CONTRIBUTOR]: 0.5,
  };

  if (config && config[contributorClass] !== undefined) {
    return config[contributorClass];
  }
  return defaults[contributorClass] ?? 1.0;
}

/**
 * Fetch org members for a given org.
 */
export async function fetchOrgMembers(
  octokit: { rest: { orgs: { listMembers: (params: { org: string; per_page: number; page: number }) => Promise<{ data: Array<{ login: string }> }> } } },
  org: string
): Promise<string[]> {
  const members: string[] = [];
  let page = 1;

  while (true) {
    const response = await octokit.rest.orgs.listMembers({ org, per_page: 100, page });
    members.push(...response.data.map((m) => m.login));
    if (response.data.length < 100) break;
    page++;
  }

  return members;
}

/**
 * Fetch repo collaborators.
 */
export async function fetchRepoCollaborators(
  octokit: { rest: { repos: { listCollaborators: (params: { owner: string; repo: string; per_page: number; page: number }) => Promise<{ data: Array<{ login: string }> }> } } },
  owner: string,
  repo: string
): Promise<string[]> {
  const collaborators: string[] = [];
  let page = 1;

  while (true) {
    const response = await octokit.rest.repos.listCollaborators({ owner, repo, per_page: 100, page });
    collaborators.push(...response.data.map((c) => c.login));
    if (response.data.length < 100) break;
    page++;
  }

  return collaborators;
}
