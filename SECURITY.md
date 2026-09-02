# Security Policy

## Supported versions

Security fixes apply to published **0.1.x** on npm (`policy-semver`, `@policy-semver/core`) and to Action git refs (`v0.1.0`, moving `v0`, or a commit SHA). Pre-`0.1.0` tags and unreleased `dev` commits are **not** supported.

| Version     | Supported |
|-------------|-----------|
| `0.1.x`     | Yes       |
| pre-`0.1.0` | No        |

## Reporting a vulnerability

Do **not** open a public GitHub issue for exploitable bugs.

Prefer one of:

1. [GitHub private vulnerability reporting](https://github.com/besarrahmat/policy-semver/security/advisories/new) for this repository, or
2. Contact the maintainer privately via GitHub (@besarrahmat).

Include: affected version (or commit SHA), reproduction steps, and impact.

We aim to acknowledge reports within **7 days**.

## Standing controls

Least-privilege Action permissions, fork PRs never write, changelog/Release bodies are redacted, `POLICY_SEMVER_TOKEN` / GitHub App for protected branches, npm publish via OIDC (`publish.yml`), and `.env` / tokens stay out of git. Details: [CONTRIBUTING.md](./CONTRIBUTING.md#security).
