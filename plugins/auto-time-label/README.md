# Auto Time Label Plugin (UbiquityOS)

Automatically analyzes issue specifications when issues are created or edited, calculates unbiased duration estimates via LLM, applies configurable scale offsets (`timeOffsetDivisor`), and assigns the best-fitting `Time: ` repository label.

## Configuration
```yaml
plugins:
  - uses: ubiquity-os/plugins-wishlist/plugins/auto-time-label
    with:
      timeOffsetDivisor: 15
```
