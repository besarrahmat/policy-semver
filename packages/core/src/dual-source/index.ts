export { assertDualSourceMatch } from "./assert-match.js";
export { DUAL_SOURCE } from "./locks.js";
export { readVersionAtRef } from "./read-at-ref.js";
export {
  readBothConfigured,
  tryReadPackageJsonVersion,
  tryReadVersionFile,
} from "./read-sources.js";
export {
  type WriteBothInput,
  writeBothAtomically,
  writePackageJsonFilesAtomically,
} from "./write-both.js";
