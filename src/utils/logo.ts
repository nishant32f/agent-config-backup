import { logger } from './logger.js';

export function printLogo(): void {
  logger.banner('AGENT CONFIG', 'A companion for syncing Claude Code and Codex');
}
