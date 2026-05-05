import {
  intro,
  outro,
  text,
  password,
  select,
  spinner,
  note,
  cancel,
  isCancel,
} from '@clack/prompts';
import { writeGlobalConfig } from '../lib/config-store';
import { writeLocalEnv } from '../lib/env-store';
import { writeCache } from '../lib/cache-store';
import { createStudioClient, AuthError } from '../lib/studio-client';
import { bootstrap } from '../lib/bootstrap';
import { Project, Environment, Dataset } from '../types';

/**
 * Returns true if the given string is a valid URL (http or https).
 */
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Handles a cancel signal from @clack/prompts.
 * Displays a cancellation message and exits with code 130.
 */
function handleCancel(): never {
  cancel('Setup cancelled.');
  process.exit(130);
}

/**
 * `itgps-agent config` — interactive 8-step setup wizard.
 *
 * Guides the user through:
 *   1. Studio URL input
 *   2. PAT input (with instructions)
 *   3. Token verification via getMe()
 *   4. Credential storage choice (global config or local .env)
 *   5. Project selection
 *   6. Environment + dataset selection
 *   7. Bootstrap (fetch + cache + write merged vars)
 *   8. Confirmation summary
 */
export async function runConfig(_opts: { yes: boolean }): Promise<void> {
  // ── Step 1: Intro + Studio URL ─────────────────────────────────────────────
  intro('itgps-agent config');

  const studioUrlResult = await text({
    message: 'Studio URL:',
    validate: (v) => (isValidUrl(v) ? undefined : 'Please enter a valid URL'),
  });

  if (isCancel(studioUrlResult)) handleCancel();
  const studioUrl = studioUrlResult as string;

  // ── Step 2: PAT instructions + token input ─────────────────────────────────
  note(
    [
      '1. Open the Studio in your browser: ' + studioUrl,
      '2. Navigate to Developer Settings',
      '3. Generate a Personal Access Token (PAT)',
      '4. Paste the token below',
    ].join('\n'),
    'Get your Personal Access Token'
  );

  // ── Step 3: Token verification loop ───────────────────────────────────────
  let token: string;
  let userName: string;
  let userEmail: string;

  while (true) {
    const tokenResult = await password({
      message: 'Personal Access Token (PAT):',
    });

    if (isCancel(tokenResult)) handleCancel();
    token = tokenResult as string;

    const s = spinner();
    s.start('Verifying token...');

    const studioClient = createStudioClient(studioUrl, token);

    try {
      const userInfo = await studioClient.getMe();
      userName = userInfo.user.name;
      userEmail = userInfo.user.email;
      s.stop(`Verified! Signed in as ${userName} (${userEmail})`);
      break;
    } catch (err) {
      if (err instanceof AuthError) {
        s.stop('Token verification failed.');
        // Re-prompt — loop back to step 2
        note(
          'The token you entered is invalid or expired. Please generate a new PAT and try again.',
          'Authentication Error'
        );
        continue;
      }
      s.stop('Token verification failed.');
      throw err;
    }
  }

  // Create the verified client for subsequent calls
  const studioClient = createStudioClient(studioUrl, token);

  // ── Step 4: Credential storage choice ─────────────────────────────────────
  const storageResult = await select({
    message: 'Where to save credentials?',
    options: [
      { value: 'global', label: 'Global config (~/.itgps/config.json)' },
      { value: 'local', label: 'Local .env file' },
    ],
  });

  if (isCancel(storageResult)) handleCancel();
  const storageChoice = storageResult as 'global' | 'local';

  if (storageChoice === 'global') {
    await writeGlobalConfig({ studioUrl, token });
  } else {
    writeLocalEnv({ ITGPS_STUDIO_URL: studioUrl, ITGPS_TOKEN: token });
  }

  // ── Step 5: Project selection ──────────────────────────────────────────────
  const projectSpinner = spinner();
  projectSpinner.start('Fetching projects...');
  const projects: Project[] = await studioClient.getProjects();
  projectSpinner.stop('Projects fetched.');

  const projectResult = await select({
    message: 'Select project:',
    options: projects.map((p) => ({ value: p.id, label: p.name })),
  });

  if (isCancel(projectResult)) handleCancel();
  const projectId = projectResult as string;
  const selectedProject = projects.find((p) => p.id === projectId)!;

  writeLocalEnv({ ITGPS_PROJECT_ID: projectId });

  // ── Step 6: Environment + dataset selection ────────────────────────────────
  const envDatasetSpinner = spinner();
  envDatasetSpinner.start('Fetching environments and datasets...');
  const [environments, datasets]: [Environment[], Dataset[]] = await Promise.all([
    studioClient.getEnvironments(projectId),
    studioClient.getDatasets(projectId),
  ]);
  envDatasetSpinner.stop('Environments and datasets fetched.');

  const envResult = await select({
    message: 'Select environment:',
    options: environments.map((e) => ({ value: e.id, label: e.name })),
  });

  if (isCancel(envResult)) handleCancel();
  const envId = envResult as string;
  const selectedEnv = environments.find((e) => e.id === envId)!;

  const datasetResult = await select({
    message: 'Select dataset:',
    options: datasets.map((d) => ({ value: d.id, label: d.name })),
  });

  if (isCancel(datasetResult)) handleCancel();
  const datasetId = datasetResult as string;
  const selectedDataset = datasets.find((d) => d.id === datasetId)!;

  writeLocalEnv({ ITGPS_ENV_ID: envId, ITGPS_DATASET_ID: datasetId });

  // ── Step 7: Bootstrap + cache write ───────────────────────────────────────
  const bootstrapSpinner = spinner();
  bootstrapSpinner.start('Bootstrapping...');

  await bootstrap({ studioClient, projectId, envId, datasetId });

  await Promise.all([
    writeCache('project', projects),
    writeCache('environments', environments),
    writeCache('datasets', datasets),
  ]);

  bootstrapSpinner.stop('Bootstrap complete.');

  // ── Step 8: Confirmation summary ──────────────────────────────────────────
  outro('Configuration complete!');

  console.log('');
  console.log('  Studio URL:  ' + studioUrl);
  console.log('  User:        ' + userName + ' (' + userEmail + ')');
  console.log('  Project:     ' + selectedProject.name);
  console.log('  Environment: ' + selectedEnv.name);
  console.log('  Dataset:     ' + selectedDataset.name);
  console.log('');
}
