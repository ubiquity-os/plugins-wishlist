This is where proposals can be discussed for new capabilities.

## Implemented Plugins

### Config Protection

- Bounty: `#30`
- Repository: https://github.com/enlohhy/config-protection
- Status: alternate implementation published and locally verified

This plugin protects UbiquityOS configuration files from unauthorized edits on the default branch.
It checks repository admin access, verifies organization billing-manager role membership, and restores
only the protected config files touched by an unauthorized push so unrelated files from the same push
are preserved.
