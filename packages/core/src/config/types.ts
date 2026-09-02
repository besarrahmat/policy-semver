export type VersioningConfig = {
  schemaVersion: "1";
  prodBranch: string;
  developBranch: string;
  majorEnv: string;
  versionFiles: string[];
  changelogPath: string;
  tagPrefix: string;
  skipLabels: string[];
  skipTrailers: string[];
  hooks: {
    beforeBump: string | null;
    afterTag: string | null;
    afterRelease: string | null;
  };
};
