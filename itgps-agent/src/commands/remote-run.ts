import {
  intro,
  outro,
  select,
  confirm,
  spinner,
  isCancel,
  cancel,
  log,
} from '@clack/prompts';
import { readGlobalConfig } from '../lib/config-store';
import { readLocalEnv } from '../lib/env-store';
import { readCache } from '../lib/cache-store';
import { createStudioClient, AuthError, NetworkError, TimeoutError } from '../lib/studio-client';
import { streamRunEvents } from '../lib/ws-client';
import { Environment, Dataset, RunEvent } from '../types';

/**
 * `itgps-agent remote-run` — triggers a Studio-side test run and streams results.
 */
export async function runRemoteRun(opts: { yes: boolean }): Promise<void> {
  intro('itgps-agent remote-run');

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

  // ── Step 2: Fetch environments and datasets ────────────────────────────────
  const studioClient = createStudioClient(studioUrl, token);

  let environments: Environment[];
  let datasets: Dataset[];

  const fetchSpinner = spinner();
  fetchSpinner.start('Fetching environments and datasets...');

  try {
    [environments, datasets] = await Promise.all([
      studioClient.getEnvironments(projectId),
      studioClient.getDatasets(projectId),
    ]);
    fetchSpinner.stop('Environments and datasets fetched.');
  } catch (err) {
    if (err instanceof NetworkError || err instanceof TimeoutError || err instanceof AuthError) {
      fetchSpinner.stop('Could not reach Studio — trying cache...');
      const cachedEnvs = await readCache<Environment[]>('environments');
      const cachedDs = await readCache<Dataset[]>('datasets');
      if (!cachedEnvs || !cachedDs) {
        console.error('No cached data available. Run itgps-agent config while connected.');
        process.exit(1);
      }
      environments = cachedEnvs.data;
      datasets = cachedDs.data;
      log.warn(`[offline] Using cached data from ${cachedEnvs.cachedAt}`);
    } else {
      throw err;
    }
  }

  // ── Step 3: Select environment and dataset ─────────────────────────────────
  // Check if environments exist
  if (!environments || environments.length === 0) {
    console.error('No environments found for this project.');
    console.error('Please create an environment in the Studio before running remote-run.');
    process.exit(1);
  }

  const envResult = await select({
    message: 'Select environment:',
    options: environments.map((e) => ({ value: e.id, label: e.name })),
  });
  if (isCancel(envResult)) { cancel('Cancelled.'); process.exit(130); }
  const envId = envResult as string;

  // Check if datasets exist
  if (!datasets || datasets.length === 0) {
    console.error('No datasets found for this project.');
    console.error('Please create a dataset in the Studio before running remote-run.');
    process.exit(1);
  }

  const datasetResult = await select({
    message: 'Select dataset:',
    options: datasets.map((d) => ({ value: d.id, label: d.name })),
  });
  if (isCancel(datasetResult)) { cancel('Cancelled.'); process.exit(130); }
  const datasetId = datasetResult as string;

  // ── Step 4: Confirmation ───────────────────────────────────────────────────
  if (!opts.yes) {
    const confirmed = await confirm({ message: 'Trigger remote run?' });
    if (isCancel(confirmed) || !confirmed) { cancel('Cancelled.'); process.exit(130); }
  }

  // ── Step 5: Trigger run ────────────────────────────────────────────────────
  const triggerSpinner = spinner();
  triggerSpinner.start('Triggering run...');

  const runResult = await studioClient.triggerRun(projectId, {
    envId,
    dataSetIds: [datasetId],
  });

  const runId = runResult.runId;
  triggerSpinner.stop(`Run triggered. Run ID: ${runId}`);

  // ── Step 6: Stream WebSocket events ───────────────────────────────────────
  let finalExitCode = 1;
  let wsCompleted = false;

  const startTime = Date.now();

  await new Promise<void>((resolve) => {
    function onEvent(event: RunEvent): void {
      if (event.type === 'run:stdout' && event.data) {
        process.stdout.write(event.data);
      } else if (event.type === 'run:stderr' && event.data) {
        process.stderr.write(event.data);
      } else if (event.type === 'run:done') {
        finalExitCode = event.exitCode ?? 1;
        wsCompleted = true;
        // Resolve immediately — we have the final result
        resolve();
      }
    }

    function onClose(): void {
      if (!wsCompleted) {
        // WebSocket dropped before run:done — fall back to polling
        pollRunStatus().then(resolve).catch(() => resolve());
      } else {
        // Already resolved via run:done handler
        resolve();
      }
    }

    streamRunEvents(studioUrl!, token!, runId, onEvent, onClose).catch(() => {
      if (!wsCompleted) {
        pollRunStatus().then(resolve).catch(() => resolve());
      } else {
        resolve();
      }
    });
  });

  async function pollRunStatus(): Promise<void> {
    log.warn('WebSocket disconnected — polling for run status...');
    while (true) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await studioClient.getRunStatus(projectId, runId);
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'stopped') {
        finalExitCode = status.exitCode ?? (status.status === 'completed' ? 0 : 1);
        break;
      }
    }
  }

  // ── Step 7: Summary ────────────────────────────────────────────────────────
  const duration = Date.now() - startTime;
  const durationSec = (duration / 1000).toFixed(1);

  outro(
    finalExitCode === 0
      ? `Run completed successfully in ${durationSec}s`
      : `Run failed (exit code ${finalExitCode}) in ${durationSec}s`
  );

  process.exit(finalExitCode);
}
