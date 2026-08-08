export { assertDualSourceMatch } from "./assert-match.js";
export { DUAL_SOURCE } from "./locks.js";
export {
  readBothConfigured,
  tryReadPackageJsonVersion,
  tryReadVersionFile,
} from "./read-sources.js";
export { type WriteBothInput, writeBothAtomically } from "./write-both.js";
