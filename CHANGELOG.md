# Changelog

All notable changes to Scalengi Views are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- replaced the new-view modal with an integrated creation screen and compact, square view cards grouped by use case;
- localized built-in configuration labels and descriptions when a view is created.

### Removed

- removed the layered information-system impact view from the catalog and public library.

## [0.1.0-beta.1] - 2026-08-26

### Security

- updated Next.js and pinned patched transitive dependencies so the production dependency audit reports no known vulnerabilities.

### Changed

- simplified the public contribution and maintenance guides;
- harmonised GitHub issue forms in English and separated conduct reports from vulnerability reports;
- clarified that the open-source view library is currently distributed with the application rather than as a standalone npm package.

## [0.1.0-alpha.3] - 2026-08-19

### Added

- English application interface by default, with persistent French selection in settings;
- metamodel organisation by levels, side-by-side layers, and ordered transverse layers on the left or right;
- layer filters, relation display modes, and metamodel spacing controls;
- view renaming and complete deletion from the Structure tab, with confirmation;
- explicit deletion of imported data and conditional activation of the sample view.

### Changed

- sample-data lifecycle: disabling a sample now removes its data and structure without reactivating it after reload;
- simplified metamodel cards and object spacing for improved readability;
- prepared future source options for Scalengi Inventory, Scalengi App, and API/database, without enabling a connector.

### Fixed

- PNG and SVG exports now use the actual view surface with a transparent background;
- metamodel relation labels are displayed without cardinalities;
- saved configurations are migrated when new structure fields are added.

## [0.1.0-alpha.2] - 2026-08-16

### Fixed

- macOS releases now use ad hoc signing when Apple secrets are not configured;
- empty Apple variables no longer trigger the import of a nonexistent certificate in GitHub Actions.

## [0.1.0-alpha.1] - 2026-08-16

### Added

- first Tauri desktop application for macOS, Windows, and Linux, built from the same React codebase as the web application;
- GitHub pipeline for building installers and publishing prereleases;
- generic Partition View with Business Capabilities, Urban Information System Map, and blank-structure presets;
- multi-criteria filters, multi-selection, and independent level projection;
- navigable Information System Metamodel built with React Flow;
- redesigned layered information-system impact analysis;
- portable YAML configurations and per-instance sample datasets.

### Security

- restrictive CSP policy for the desktop shell;
- Excel and YAML imports remain local and are validated at trust boundaries.

[0.1.0-alpha.3]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v0.1.0-alpha.2...v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/CorentinPetitdemange/scalengi-views/releases/tag/v0.1.0-alpha.1
[Unreleased]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v0.1.0-alpha.3...v0.1.0-beta.1
