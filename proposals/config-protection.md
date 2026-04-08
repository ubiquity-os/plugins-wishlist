# Config Protection for UbiquityOS Plugins

**Issue:** [#30](https://github.com/ubiquity-os/plugins-wishlist/issues/30)  
**Reward:** $75  
**Status:** Proposal

## Problem

Plugin configuration files control money flow, pricing, and reward distribution in UbiquityOS. Currently, any collaborator with write access can modify these configs, creating a fraud risk. Only admins or billing managers should be authorized to change configuration that affects financial operations.

## Proposed Solution

A multi-layered configuration protection mechanism:

### Layer 1: CODEOWNERS Gate

Add a `CODEOWNERS` file that restricts review approval on config files to designated admins/billing managers:

```
# Config files require admin approval
/ubiquity.config.*           @ubiquity/admins
/.github/ubiquity.config.*   @ubiquity/admins
/**/pricing.yml              @ubiquity/admins
/**/config.yml               @ubiquity/admins
```

Combined with branch protection requiring CODEOWNERS approval on the default branch, this ensures config changes cannot be merged without admin review.

### Layer 2: Webhook-Level Rollback

On `push` events, a UbiquityOS plugin detects whether config files were modified:

1. **Diff Detection:** Compare the config file SHA before and after the push using the GitHub Compare API.
2. **Authorization Check:** Verify the pusher has `admin` or `billing_manager` role via the repository collaborator API (`GET /repos/{owner}/{repo}/collaborators/{username}/permission`).
3. **Automatic Rollback:** If the change is unauthorized, immediately create a new commit restoring the previous config version, authored by `ubiquibot[bot]`.

```
Push → Detect config change → Check author role
  ├─ Authorized → Allow, log the change
  └─ Unauthorized → Auto-rollback commit, notify admins
```

### Layer 3: Audit Trail

All config changes (authorized or rolled back) are logged:
- Comment on the relevant issue/PR with the change details
- Post to a designated audit channel
- Store a SHA-256 hash chain of config states for tamper detection

## Implementation Plan

### Phase 1: Core Plugin (MVP)

1. **Create `config-protection` plugin** — a new UbiquityOS plugin listening to `push` events.
2. **Config diff detection** — On each push, check if watched config files changed:
   ```typescript
   const CONFIG_PATTERNS = ["ubiquity.config.*", "pricing.yml", ".github/ubiquity.config.*"];
   ```
3. **Permission check** — Use `octokit.repos.getCollaboratorPermissionLevel()` to verify the pusher's role.
4. **Rollback mechanism** — If unauthorized:
   ```typescript
   // Get previous commit's config content
   const previousConfig = await octokit.repos.getContent({ ref: previousSha, ... });
   // Create rollback commit via Trees API
   await octokit.git.createCommit({ 
     message: "🔒 Unauthorized config change rolled back",
     tree: previousTreeSha,
     parents: [currentCommitSha] 
   });
   ```
5. **Notification** — Comment on the repo or open an issue alerting admins.

### Phase 2: Hardening

6. **CODEOWNERS setup** — Generate and maintain CODEOWNERS based on org admin list.
7. **Hash chain** — Store config hashes in a dedicated branch (`config-audit`) for tamper-proof history.
8. **Dashboard** — Web view of config change history.

### Phase 3: Organization-Wide

9. **Org-level enforcement** — Apply across all repos in the UbiquityOS organization via a GitHub App.
10. **Tie-breaker mechanism** — For orgs with multiple admins, require N-of-M approval for sensitive config changes.

## Technical Details

### Event Flow

```
GitHub Push Event
  → Plugin receives webhook
  → Check if config files changed (list modified files from commits)
  → If changed:
     → GET /repos/{owner}/{repo}/collaborators/{pusher}/permission
     → If permission != "admin" && role != "billing_manager":
        → Revert commit (Git Data API: create commit pointing to previous tree)
        → Update ref (force push the branch back)
        → POST notification (issue comment / discussion)
```

### Key Design Decisions

- **Why rollback over rejection?** Webhooks are post-event; the commit already exists. Rollback is the only option.
- **Why not pre-commit hooks?** Pre-commit hooks are client-side and can be bypassed. Server-side enforcement via webhooks is reliable.
- **Why CODEOWNERS + webhook?** Defense in depth. CODEOWNERS prevents merging unauthorized PRs; webhook catches direct pushes.

### Config Schema

```json
{
  "protectedFiles": ["ubiquity.config.ts", "pricing.yml"],
  "authorizedRoles": ["admin", "billing_manager"],
  "rollbackBot": "ubiquibot[bot]",
  "notifyChannel": "config-audit"
}
```

## Testing Plan

1. **Unit tests:** Config diff detection, permission checks, rollback logic.
2. **Integration tests:** Simulate push events with modified configs from different user roles.
3. **E2E test:** Push an unauthorized config change to a test repo and verify rollback.

## References

- [Assistive Pricing get-base-rate-changes](https://github.com/ubiquibot/assistive-pricing/blob/d259e29b2896026a164e7c1af4f2b72ce31fe90c/src/handlers/get-base-rate-changes.ts)
- [GitHub CODEOWNERS docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub Collaborator Permission API](https://docs.github.com/en/rest/collaborators/collaborators)
