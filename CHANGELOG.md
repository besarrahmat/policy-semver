# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-10-30

### Added

- redact logs and report release results

### Changed

- Major reset to 2.0.0 via majorEnv
- pin release behaviour with real git remotes
- remove dead code and harden CI and publish

### Fixed

- make release reruns safe and pushes atomic
- classify and record commits more accurately

## [1.0.4] - 2026-10-30

### Changed

- upgrade all dependencies and drop stale overrides

## [1.0.3] - 2026-10-30

### Fixed

- patch transitive undici fast-uri vite and source-map-js

## [1.0.2] - 2026-10-30

### Changed

- bump typescript from 5.9.3 to 7.0.2
- bump @biomejs/biome from 2.5.11 to 2.5.14
- bump vitest from 4.1.11 to 5.0.2
- bump @types/node from 26.4.0 to 26.6.3
- bump tsx from 4.23.13 to 4.23.15

### Fixed

- emit .d.ts with tsc for TypeScript 7

## [1.0.1] - 2026-09-02

### Changed

- let Dependabot PRs patch-bump

## [1.0.0] - 2026-09-02

### Added

- lockstep npm packages to 1.0.0

### Changed

- Major reset to 1.0.0 via majorEnv

### Fixed

- update BLOCKERS.md test

## [0.1.0] - 2026-08-22

### Added

- prove dogfood minor bump

## [0.0.1] - 2026-08-22

### Fixed

- prove dogfood patch bump
