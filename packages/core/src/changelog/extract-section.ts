/** The `## [version]` section of a Keep a Changelog file, or "" if absent. */
export function extractReleaseSection(
  changelog: string,
  version: string,
): string {
  const heading = `## [${version}]`;
  const start = changelog
    .split("\n")
    .findIndex((line) => line.startsWith(heading));
  if (start === -1) return "";
  const lines = changelog.split("\n").slice(start);
  const next = lines.findIndex((line, i) => i > 0 && line.startsWith("## ["));
  const section = next === -1 ? lines : lines.slice(0, next);
  return `${section.join("\n").trimEnd()}\n`;
}
