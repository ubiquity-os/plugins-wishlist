import { classifyContributor, getClassMultiplier, ContributorClass } from "../src/contributor-class";

describe("classifyContributor", () => {
  const context = {
    issueAuthorLogin: "author",
    assigneeLogins: ["assignee1"],
    orgMembers: ["orgmember1"],
    repoCollaborators: ["collaborator1", "orgmember1"],
  };

  test("classifies specification author", () => {
    const result = classifyContributor("author", context);
    expect(result.contributorClass).toBe(ContributorClass.SPECIFICATION_AUTHOR);
    expect(result.login).toBe("author");
  });

  test("classifies assignee", () => {
    const result = classifyContributor("assignee1", context);
    expect(result.contributorClass).toBe(ContributorClass.ASSIGNEE);
  });

  test("classifies org member as collaborator", () => {
    const result = classifyContributor("orgmember1", context);
    expect(result.contributorClass).toBe(ContributorClass.COLLABORATOR);
    expect(result.isOrgMember).toBe(true);
  });

  test("classifies repo collaborator", () => {
    const result = classifyContributor("collaborator1", context);
    expect(result.contributorClass).toBe(ContributorClass.COLLABORATOR);
    expect(result.isRepoCollaborator).toBe(true);
  });

  test("classifies external contributor as default", () => {
    const result = classifyContributor("randomuser", context);
    expect(result.contributorClass).toBe(ContributorClass.CONTRIBUTOR);
    expect(result.isOrgMember).toBe(false);
    expect(result.isRepoCollaborator).toBe(false);
  });

  test("specification author takes priority over org member", () => {
    const result = classifyContributor("author", { ...context, orgMembers: ["author"] });
    expect(result.contributorClass).toBe(ContributorClass.SPECIFICATION_AUTHOR);
  });

  test("assignee takes priority over collaborator", () => {
    const result = classifyContributor("assignee1", { ...context, orgMembers: ["assignee1"] });
    expect(result.contributorClass).toBe(ContributorClass.ASSIGNEE);
  });
});

describe("getClassMultiplier", () => {
  test("returns default multipliers", () => {
    expect(getClassMultiplier(ContributorClass.SPECIFICATION_AUTHOR)).toBe(1.0);
    expect(getClassMultiplier(ContributorClass.ASSIGNEE)).toBe(1.0);
    expect(getClassMultiplier(ContributorClass.COLLABORATOR)).toBe(0.75);
    expect(getClassMultiplier(ContributorClass.CONTRIBUTOR)).toBe(0.5);
  });

  test("allows config overrides", () => {
    const config = {
      [ContributorClass.CONTRIBUTOR]: 1.0,
      [ContributorClass.COLLABORATOR]: 0.9,
    };
    expect(getClassMultiplier(ContributorClass.CONTRIBUTOR, config)).toBe(1.0);
    expect(getClassMultiplier(ContributorClass.COLLABORATOR, config)).toBe(0.9);
    // Non-overridden uses default
    expect(getClassMultiplier(ContributorClass.ASSIGNEE, config)).toBe(1.0);
  });
});
