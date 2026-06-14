import { Command } from 'commander';
import chalk from 'chalk';
import { handleSyncStatus } from './sync.js';

const cmd = new Command('status')
  .description('(deprecated) Use "agent-config sync status" instead')
  .action(async () => {
    console.error(
      chalk.yellow('Warning:') +
      ' "agent-config status" is deprecated. Use ' +
      chalk.cyan('agent-config sync status') +
      ' instead.'
    );
    console.error('');
    await handleSyncStatus();
  });

(cmd as unknown as { _hidden: boolean })._hidden = true;
export const statusCommand = cmd;
