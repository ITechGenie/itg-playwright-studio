#!/usr/bin/env node
'use strict';

import { runConfig } from './commands/config';
import { runRemoteRun } from './commands/remote-run';
import { runStudioGitSync } from './commands/studio-git-sync';
import { runPlaywrightProxy } from './commands/playwright-proxy';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string };

const USAGE = `
itgps-agent — ITG Playwright Studio CLI agent

USAGE
  itgps-agent <command> [options]

AGENT COMMANDS
  config              Authenticate with Studio and set up project/env/dataset
  remote-run          Trigger a Studio-side test run and stream results
  studio-git-sync     Instruct Studio to pull latest from Git

PLAYWRIGHT COMMANDS (all native Playwright commands are supported)
  test [args...]      Bootstrap Studio data, then run: playwright test [args...]
  show-report         Bootstrap Studio data, then run: playwright show-report
  codegen             Bootstrap Studio data, then run: playwright codegen
  install             Bootstrap Studio data, then run: playwright install
  <any-pw-cmd>        Bootstrap Studio data, then run: playwright <cmd>

GLOBAL FLAGS
  --yes, -y           Skip confirmation prompts
  --help, -h          Show this help message
  --version, -v       Show version

EXAMPLES
  itgps-agent config
  itgps-agent test --headed --grep "login"
  itgps-agent remote-run --yes
  itgps-agent studio-git-sync
`.trim();

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  // Parse global --yes / -y flag
  const yes = argv.includes('--yes') || argv.includes('-y');

  // Remove global flags from argv before routing
  const filteredArgv = argv.filter((a) => a !== '--yes' && a !== '-y');

  const command = filteredArgv[0];
  const args = filteredArgv.slice(1);

  switch (command) {
    case 'config':
      await runConfig({ yes });
      break;

    case 'remote-run':
      await runRemoteRun({ yes });
      break;

    case 'studio-git-sync':
      await runStudioGitSync({ yes });
      break;

    case '--help':
    case '-h':
    case undefined:
      console.log(USAGE);
      break;

    case '--version':
    case '-v':
      console.log(pkg.version);
      break;

    default:
      // Everything else is a Playwright proxy command
      await runPlaywrightProxy(command, args, { yes });
      break;
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
