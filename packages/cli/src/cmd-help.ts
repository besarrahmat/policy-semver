export function printHelp(): void {
  console.log(`policy-semver <command> [flags]

Commands:
  classify   Print classify kind (JSON)
  bump       --dry-run | --write [--force]
  verify     Config schema + dual-source + tag↔VERSION (skip if no tags)
  test       Run fixtures/classifier goldens
  --help     This message

Flags:
  --config <path>  default versioning.config.json
  --cwd <path>     repo root
  --title <text>   classify PR title
  --json           machine-readable (compact JSON)
  --dry-run        bump: no write
  --write          bump: write (clean tree unless --force)
  --force          allow dirty tree with --write (dangerous)
`);
}
