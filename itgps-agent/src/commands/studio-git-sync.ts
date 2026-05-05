import { spinner } from '@clack/prompts';
import { readGlobalConfig } from '../lib/config-store';
import { readLocalEnv } from '../lib/env-store';
import { createStudioClient, AuthError, NetworkError, TimeoutError } from '../lib/studio-client';

/**
 * `itgps-agent studio-git-sync` — triggers a Git pull on the Studio for the selected project.
 */
export async function runStudioGitSync(_opts: { yes: boolean }): Promise<void> {
  // ── Step 1: Read credentials and project ID ────────────────────────────────
  let studioUrl: string | undefined;
  let token: string | undefined;

  const globalConfig = await readGlobalConfig();
  if (globalConfig?.studioUrl && globalConfig?.token) {
    studioUrl = globalConfig.studioUrl;
    token = globalConfig.token;
  } else {
    const localEnv = readLocalEnv();
    studioUrl = localEnv['ITGPS_STUDIO_URL'];
    token = localEnv['ITGPS_TOKEN'];
  }

  if (!studioUrl || !token) {
    console.error("Run 'itgps-agent config' to set up your Studio connection.");
    process.exit(1);
  }

  const localEnv = readLocalEnv();
  const projectId = localEnv['ITGPS_PROJECT_ID'];

  if (!projectId) {
    console.error("Run 'itgps-agent config' to select a project.");
    process.exit(1);
  }

  // ── Step 2: Trigger Git sync ───────────────────────────────────────────────
  const studioClient = createStudioClient(studioUrl, token);

  const s = spinner();
  s.start('Syncing with Git...');

  try {
    await studioClient.triggerGitSync(projectId);
    s.stop(`Git sync triggered successfully for project ${projectId}.`);
  } catch (err) {
    if (err instanceof AuthError) {
      s.stop('Git sync failed: authentication error.');
      console.error(
        err.statusCode === 401
          ? 'Token is invalid or expired. Run itgps-agent config to re-authenticate.'
          : 'Insufficient permissions to trigger Git sync.'
      );
      process.exit(1);
    }
    if (err instanceof NetworkError || err instanceof TimeoutError) {
      s.stop('Git sync failed: could not reach Studio.');
      console.error('Studio is unreachable. Check your network connection and try again.');
      process.exit(1);
    }
    s.stop('Git sync failed.');
    throw err;
  }
}
