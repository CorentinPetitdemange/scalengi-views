# Scalengi Views

[![CI](https://github.com/CorentinPetitdemange/scalengi-views/actions/workflows/ci.yml/badge.svg)](https://github.com/CorentinPetitdemange/scalengi-views/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest version](https://img.shields.io/github/v/release/CorentinPetitdemange/scalengi-views?include_prereleases&sort=semver&display_name=tag&label=version)](CHANGELOG.md)

Scalengi Views lets you create configurable views to analyse, explain, and steer an information system. Each view combines a structure, data, and a representation suited to an enterprise-architecture question.

> The project is currently in **alpha**. Formats and some interactions may still change.

The view library is open source and distributed with the application. It is not currently published as a standalone npm package.

## Install

[![Download for macOS](https://img.shields.io/badge/Download-macOS-111827?logo=apple&logoColor=white)](https://github.com/CorentinPetitdemange/scalengi-views/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-0078d4?logo=windows&logoColor=white)](https://github.com/CorentinPetitdemange/scalengi-views/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-f59e0b?logo=linux&logoColor=white)](https://github.com/CorentinPetitdemange/scalengi-views/releases)

Installers are available from [GitHub Releases](https://github.com/CorentinPetitdemange/scalengi-views/releases): `.dmg` for macOS, `.exe` for Windows, and `.AppImage` or `.deb` for Linux.

## Try it online

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/CorentinPetitdemange/scalengi-views?quickstart=1)

The Codespace starts the application automatically and opens port **3000**. No Scalengi account is required.

## Features

- create multiple independent views;
- configure structure through the interface or YAML;
- generate an Excel template from each view's structure;
- process Excel imports locally;
- enable or replace a sample dataset;
- use full-screen display and PNG/SVG export;
- persist views and their data locally.

## Available views

- **Collaborators**: responsibilities, processes, feedback, and relationships around teams;
- **Partition View**: flexible levels, information, and relationships, with Business Capabilities and Urban Information System Map presets;
- **Urbanisation Diagnostic**: configurable radar, gaps, evidence, owners, and actions;
- **Information System Layers**: impact analysis around an element and its dependencies;
- **Information System Metamodel**: object types, layers, permitted relations, and cardinalities;
- **TOGAF ADM**: phases, progress, deliverables, decisions, risks, and blockers;
- **Word Cloud**: visual analysis of verbatims, needs, and pain points.

## Data

Each view owns its configuration and exactly one active data source: sample, Excel, or no data. Imported files stay on the device and are not sent to a server.

## Development

Requirements: Node.js `>=22.13.0` and pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm test
```

- [Architecture](docs/ARCHITECTURE.md)
- [Create a view type](docs/CREATE_A_VIEW.md)
- [Desktop application](docs/DESKTOP.md)
- [Versioning and releases](docs/VERSIONING.md)
- [Repository maintenance](docs/MAINTENANCE.md)

## Contributing

Read the [contribution guide](CONTRIBUTING.md), [code of conduct](CODE_OF_CONDUCT.md), and [security policy](SECURITY.md). Changes are proposed through pull requests and validated by CI before integration.

To discuss a connector or integration, contact [corentin@scalengi.com](mailto:corentin@scalengi.com).

## Licence

Scalengi Views is distributed under the [MIT licence](LICENSE). Copyright © 2026 Corentin Petitdemange.
