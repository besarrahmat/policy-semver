# PolicySemVer GitHub Action

> Full Action packaging (ncc `dist/`, inputs/outputs) lands later. This file locks the **concurrency contract** early.

## Concurrency (required on write workflows)

Consumer workflows that run a **version write** (merged bump / tag) must set:

```yaml
concurrency:
  group: policy-semver-${{ github.repository }}-${{ github.ref }}
  cancel-in-progress: false   # never cancel mid-write
```

| Rule                          | Why                                                        |
|-------------------------------|------------------------------------------------------------|
| Stable `group` per repo + ref | Serialize overlapping bump jobs on the same branch         |
| `cancel-in-progress: false`   | Cancelling mid-write can leave VERSION / tags half-applied |

### Do not share cancel-friendly groups with lint

- Keep **lint / typecheck / unit tests** in a separate job (and a separate concurrency group, or no cancel on the write job).
- Never use one group with `cancel-in-progress: true` that includes both flaky lint and the bump write job — a new push must not cancel an in-flight write.
