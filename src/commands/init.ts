import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { logger, formatPath } from '../utils/logger.js';
import { confirm } from '../utils/prompts.js';
import { getConfigPaths, ensureDir } from '../lib/paths.js';
import {
  createMetaJson,
  writeMetaJson,
} from '../lib/sync.js';
import { setupGitSync } from '../lib/sync-setup.js';
import { printLogo } from '../utils/logo.js';

export const initCommand = new Command('init')
  .description('Initialize Agent Config Backup on this machine')
  .option('--sync', 'Set up Git-based syncing without prompting')
  .option('--no-sync', 'Skip Git sync setup without prompting')
  .option('--url <repo-url>', 'Repository URL for sync setup (implies --sync)')
  .action(async (options: { sync?: boolean; url?: string }) => {
    const { jeanClaudeDir, claudeConfigDir, codexConfigDir } = getConfigPaths();

    printLogo();
    logger.heading('Setup');

    // Check if already initialized
    const metaPath = path.join(jeanClaudeDir, 'meta.json');
    if (fs.existsSync(metaPath)) {
      logger.success(`Already initialized at ${formatPath(jeanClaudeDir)}`);
      logger.dim('Run "agent-config sync status" to see current state.');
      return;
    }

    // Create the sync directory and meta.json
    ensureDir(jeanClaudeDir);
    const meta = createMetaJson(claudeConfigDir, codexConfigDir);
    await writeMetaJson(jeanClaudeDir, meta);

    // Check for existing git repo (partial init recovery)
    const gitDir = path.join(jeanClaudeDir, '.git');
    if (fs.existsSync(gitDir)) {
      logger.info('Found existing Git repository — reusing it.');
    }

    let wantSync: boolean;
    if (options.url) {
      if (options.sync === false) {
        logger.warn('--url implies --sync; ignoring --no-sync.');
      }
      wantSync = true;
    } else if (options.sync !== undefined) {
      wantSync = options.sync;
    } else {
      console.log('');
      wantSync = await confirm('Would you like to set up syncing with a Git remote?');
    }

    if (wantSync) {
      await setupGitSync(jeanClaudeDir, options.url);
    }

    // Done
    console.log('');
    logger.success('Agent Config Backup is installed!');
    console.log('');
    logger.dim('Next steps:');

    if (wantSync) {
      logger.list([
        'Run "agent-config profile create <name>" to create a Claude profile',
        'Run "agent-config sync push" to push your Claude and Codex config to Git',
        'Run "agent-config sync pull" on other machines to sync',
      ]);
    } else {
      logger.list([
        'Run "agent-config profile create <name>" to create a Claude profile',
        'Run "agent-config sync setup" to configure syncing later',
      ]);
    }
  });
