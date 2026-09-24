# Changelog

All notable changes to Scalengi Views are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0-alpha.1] - 2026-09-24

### Added

- added an administrator interface for provider-neutral OIDC configuration, discovery validation, domain policies, JIT provisioning, local-login fallback, and bootstrap controls;
- added a versioned Scalengi module manifest, ESM entry point, host-authenticated mounting contract, package builder, and GitHub release asset for future platform installation;
- documented the independent product boundaries between the future Scalengi platform, Views, Inventory, and paid platform capabilities.

### Changed

- redesigned the login introduction around the purpose of Scalengi Views instead of exposing authentication implementation details;
- made the OIDC runtime configuration reloadable without restarting the Rust service while keeping the client secret exclusively in the server environment.

### Security

- kept OIDC client secrets outside the browser and SQLite configuration, validated provider discovery before activation, and retained CSRF, origin, administrator, HTTPS, verified-email, and exact-domain safeguards for SSO administration.

## [1.1.0] - 2026-09-24

### Added

- added a dedicated Rust authentication service with local accounts, server-side sessions, administrator account management, and provider-neutral OIDC SSO;
- added CodeQL security analysis for Rust and JavaScript/TypeScript on pull requests, the default branch, and a weekly schedule.

### Security

- added Argon2 password hashing, login throttling, CSRF and origin validation, session rotation, secure cookie settings, and last-administrator safeguards;
- added OIDC authorization code flow with PKCE, state and nonce validation, exact issuer/domain controls, explicit account linking, and conservative JIT provisioning;
- pinned the CodeQL workflow actions to immutable commits and enabled the extended security query suite.

## [1.0.1] - 2026-09-23

### Added

- added a non-functional interconnection configuration preview for generic databases, Scalengi, Scalengi Inventory, REST APIs, and MCP;
- added responsive navigation with the Scalengi logo, favorites, workspace controls, and local appearance preferences.

### Changed

- aligned the application menu with Scalengi's compact animated sidebar and hover behavior;
- unified all six view renderers on one compact toolbar for titles, legends, filters, and full-screen actions;
- enlarged the urbanization diagnostic priority panel and removed redundant title and legend rows;
- moved view navigation into the View, Structure, Data, and Guide tab bar to recover vertical workspace space.

### Fixed

- preserved the animated sidebar highlight while moving between navigation entries;
- improved toolbar and connection-page layouts across desktop and narrow viewports.

## [1.0.0] - 2026-08-28

### Added

- published the first stable Scalengi Views release for macOS, Windows, and Linux.

### Changed

- replaced the new-view modal with an integrated creation screen and compact, square view cards grouped by use case;
- localized built-in configuration labels and descriptions when a view is created.
- adopted PolyForm Shield 1.0.0 and clarified internal use, consulting, hosting, competing products, and contribution rights before public distribution.

### Removed

- removed the layered information-system impact view from the catalog and public library.

## [0.1.0-beta.1] - 2026-08-26

### Security

- updated Next.js and pinned patched transitive dependencies so the production dependency audit reports no known vulnerabilities.

### Changed

- simplified the public contribution and maintenance guides;
- harmonised GitHub issue forms in English and separated conduct reports from vulnerability reports;
- clarified that the source-available view library is currently distributed with the application rather than as a standalone npm package.

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
[Unreleased]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v1.2.0-alpha.1...HEAD
[1.2.0-alpha.1]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v1.1.0...v1.2.0-alpha.1
[1.1.0]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v0.1.0-beta.1...v1.0.0
[0.1.0-beta.1]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v0.1.0-alpha.3...v0.1.0-beta.1
