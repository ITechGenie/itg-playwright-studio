# @itechgenie/itgps-agent

[![npm version](https://img.shields.io/npm/v/@itechgenie/itgps-agent.svg)](https://www.npmjs.com/package/@itechgenie/itgps-agent)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/node/v/@itechgenie/itgps-agent.svg)](https://nodejs.org)

**ITG Playwright Studio CLI Agent** — A command-line tool that bridges [ITG Playwright Studio](https://github.com/itechgenie/playwright-studio) data into local Playwright workflows, enabling seamless integration between cloud-managed test configurations and local test execution.

## Features

- 🔐 **Secure Authentication** — Connect to ITG Playwright Studio using Personal Access Tokens (PAT)
- 🎯 **Project Management** — Select and configure projects, environments, and datasets
- 🚀 **Remote Test Execution** — Trigger Studio-side test runs and stream results in real-time
- 🔄 **Git Synchronization** — Instruct Studio to pull latest changes from Git repositories
- 🎭 **Playwright Integration** — Bootstrap Studio data and run any Playwright command locally
- 💾 **Offline Support** — Cache Studio data for offline test execution
- ⚡ **Zero Configuration** — Interactive setup wizard guides you through configuration

## Installation

### Global Installation (Recommended)

```bash
npm install -g @itechgenie/itgps-agent
```

### Local Installation

```bash
npm install --save-dev @itechgenie/itgps-agent
```

### Requirements

- Node.js >= 18.0.0
- Access to an ITG Playwright Studio instance
- Valid Personal Access Token (PAT) from Studio

## Quick Start

### 1. Configure the Agent

Run the interactive configuration wizard:

```bash
itgps-agent config
```

This will guide you through:
- Entering your Studio URL
- Authenticating with your Personal Access Token
- Selecting credential storage location (global or local `.env`)
- Choosing a project, environment, and dataset
- Bootstrapping and caching Studio data

### 2. Run Playwright Tests Locally

Execute Playwright tests with Studio-managed configuration:

```bash
itgps-agent test
```

Run with additional Playwright options:

```bash
itgps-agent test --headed --grep "login"
itgps-agent test --project=chromium --workers=4
```

### 3. Trigger Remote Test Runs

Execute tests on the Studio server and stream results:

```bash
itgps-agent remote-run
```

Skip confirmation prompts:

```bash
itgps-agent remote-run --yes
```

### 4. Sync with Git

Instruct Studio to pull the latest changes from Git:

```bash
itgps-agent studio-git-sync
```

## Commands

### Agent Commands

#### `config`

Interactive setup wizard for authentication and project configuration.

```bash
itgps-agent config
```

**What it does:**
- Prompts for Studio URL and Personal Access Token
- Verifies authentication
- Allows selection of credential storage (global config or local `.env`)
- Fetches and displays available projects, environments, and datasets
- Bootstraps Studio data and writes merged configuration
- Caches data for offline use

#### `remote-run`

Triggers a test run on the Studio server and streams output in real-time.

```bash
itgps-agent remote-run [--yes]
```

**Options:**
- `--yes, -y` — Skip confirmation prompts

**What it does:**
- Reads credentials from global config or local `.env`
- Fetches or uses cached environments and datasets
- Prompts for environment and dataset selection
- Triggers remote test execution via Studio API
- Streams stdout/stderr via WebSocket
- Falls back to polling if WebSocket connection drops
- Reports final exit code and duration

#### `studio-git-sync`

Instructs the Studio to pull the latest changes from the configured Git repository.

```bash
itgps-agent studio-git-sync
```

**What it does:**
- Reads credentials and project ID
- Sends Git sync request to Studio API
- Reports success or failure

### Playwright Commands

The agent acts as a proxy for all native Playwright commands, bootstrapping Studio data before execution.

#### `test`

Run Playwright tests with Studio-managed configuration.

```bash
itgps-agent test [playwright-options]
```

**Examples:**
```bash
itgps-agent test --headed
itgps-agent test --grep "login"
itgps-agent test --project=chromium --workers=4
itgps-agent test --debug
```

**What it does:**
- Bootstraps Studio data (project config, environment variables, dataset variables)
- Merges variables with local `.env` overrides
- Spawns `npx playwright test` with merged environment
- Reports test results back to Studio (best-effort)

#### Other Playwright Commands

All standard Playwright commands are supported:

```bash
itgps-agent show-report
itgps-agent codegen
itgps-agent install
itgps-agent install chromium
```

Any command not recognized as an agent command is passed through to Playwright after bootstrapping Studio data.

## Configuration

### Credential Storage

The agent supports two credential storage methods:

#### 1. Global Config (Recommended for single Studio instance)

Stored in `~/.itgps/config.json`:

```json
{
  "studioUrl": "https://studio.example.com",
  "token": "your-personal-access-token"
}
```

#### 2. Local `.env` File (Recommended for multiple projects)

Stored in `.env` at project root:

```env
ITGPS_STUDIO_URL=https://studio.example.com
ITGPS_TOKEN=your-personal-access-token
ITGPS_PROJECT_ID=project-uuid
ITGPS_ENV_ID=environment-uuid
ITGPS_DATASET_ID=dataset-uuid
```

### Environment Variables

The agent recognizes the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `ITGPS_STUDIO_URL` | Studio instance URL | Yes |
| `ITGPS_TOKEN` | Personal Access Token | Yes |
| `ITGPS_PROJECT_ID` | Selected project ID | Yes |
| `ITGPS_ENV_ID` | Selected environment ID | Optional |
| `ITGPS_DATASET_ID` | Selected dataset ID | Optional |

### Cache Location

Cached Studio data is stored in `~/.itgps/cache/`:

- `project.json` — Project list
- `environments.json` — Environment configurations
- `datasets.json` — Dataset variables

Cache is automatically refreshed during `config` command and used as fallback when Studio is unreachable.

## How It Works

### Bootstrap Process

When you run any Playwright command through the agent:

1. **Credential Resolution** — Reads Studio URL and token from global config or local `.env`
2. **Project Selection** — Reads project ID from local `.env`
3. **Data Fetching** — Fetches project config, environment variables, and dataset variables from Studio API
4. **Cache Fallback** — If Studio is unreachable, uses cached data
5. **Variable Merging** — Merges variables in priority order:
   - Project defaults (lowest priority)
   - Environment variables
   - Dataset variables
   - Local `.env` overrides (highest priority)
6. **Playwright Execution** — Spawns Playwright with merged environment
7. **Result Reporting** — Reports test results back to Studio (for `test` command only)

### Variable Precedence

Variables are merged with the following precedence (highest to lowest):

1. **Local `.env` overrides** — Variables defined in your local `.env` file
2. **Dataset variables** — Variables from the selected Studio dataset
3. **Environment variables** — Variables from the selected Studio environment
4. **Project defaults** — Default variables defined in the Studio project

This allows you to override Studio-managed values locally for development and debugging.

## API Integration

The agent integrates with the following Studio API endpoints:

- `GET /apis/auth/me` — Verify authentication
- `GET /apis/projects` — List available projects
- `GET /apis/project/:id/environments` — List project environments
- `GET /apis/project/:id/environment/:envId` — Get environment details
- `GET /apis/project/:id/datasets` — List project datasets
- `GET /apis/project/:id/dataset/:datasetId` — Get dataset details
- `POST /apis/project/:id/run` — Trigger remote test run
- `GET /apis/project/:id/run/:runId/status` — Poll run status
- `POST /apis/project/:id/local-run` — Report local test results
- `POST /apis/project/:id/git-sync` — Trigger Git synchronization
- `WS /ws/run/:runId` — Stream test execution output

## Troubleshooting

### Authentication Errors

**Problem:** `Token verification failed` or `401 Unauthorized`

**Solution:**
1. Ensure your Personal Access Token is valid and not expired
2. Regenerate a new token in Studio Settings
3. Run `itgps-agent config` to update credentials

### Network Errors

**Problem:** `Could not reach Studio` or `ECONNREFUSED`

**Solution:**
1. Verify Studio URL is correct and accessible
2. Check network connectivity
3. The agent will automatically use cached data if available
4. Run `itgps-agent config` when connection is restored to refresh cache

### Project Not Found

**Problem:** `Run 'itgps-agent config' to select a project`

**Solution:**
1. Run `itgps-agent config` to complete initial setup
2. Ensure `ITGPS_PROJECT_ID` is set in `.env` or selected during config

### Playwright Not Found

**Problem:** `npx: command not found` or `playwright: command not found`

**Solution:**
1. Install Playwright in your project: `npm install -D @playwright/test`
2. Install Playwright browsers: `npx playwright install`

## Development

### Building from Source

```bash
git clone https://github.com/itechgenie/itgps-agent.git
cd itgps-agent
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run tests and linting: `npm test && npm run lint`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/my-feature`
7. Submit a pull request

## License

Copyright 2024 ITechGenie

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Support

- **Issues:** [GitHub Issues](https://github.com/itechgenie/itgps-agent/issues)
- **Documentation:** [ITG Playwright Studio Docs](https://github.com/itechgenie/playwright-studio)
- **Community:** [Discussions](https://github.com/itechgenie/itgps-agent/discussions)

## Related Projects

- [ITG Playwright Studio](https://github.com/itechgenie/playwright-studio) — Cloud-based Playwright test management platform
- [Playwright](https://playwright.dev) — End-to-end testing framework

---

Made with ❤️ by [ITechGenie](https://github.com/itechgenie)
