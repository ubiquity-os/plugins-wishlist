# Plugins Wishlist

This is where proposals can be discussed for new capabilities.

## Implemented Plugins

| Plugin | Bounty | Repository | Description |
|--------|--------|------------|-------------|
| Config Protection | $75 | [nguyenlnp/config-protection](https://github.com/nguyenlnp/config-protection) | Protects UbiquityOS configuration files from unauthorized modifications. Only admins and billing managers can modify config files; unauthorized changes are automatically reverted. |

### Config Protection

**Resolves:** #30

**Configurable protected paths** — defaults to all common UbiquityOS config file locations (`.ubiquity-os.config.yml`, `.github/ubiquity-os.config.yml`, etc.).

**Configurable allowed roles** — defaults to `admin` and `billing_manager`. The plugin checks repository collaborator permissions and organization membership to verify authorization.

**Automatic revert** — when an unauthorized user modifies a protected config file on the default branch, the commit is immediately reverted via the Git Data API. The revert commit message identifies the unauthorized user and original commit SHA.

**Default branch only** — only monitors pushes to the default branch, so feature branch changes are not affected.

**Case-insensitive matching** — catches config files regardless of casing (e.g., `.UBIQUITY-OS.CONFIG.YML`).

**Billing manager detection** — checks org-level `billing_manager` role via the GitHub membership API, as this is an organization-level permission rather than a repository-level one.
