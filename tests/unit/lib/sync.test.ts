import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  compareFiles,
  createMetaJson,
  readMetaJson,
  writeMetaJson,
  updateLastSync,
  syncFromClaudeConfig,
  syncToClaudeConfig,
  syncAllFromConfigs,
  syncAllToConfigs,
  createSyncTargets,
} from '../../../src/lib/sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('sync.ts', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jean-claude-test-'));
  });

  afterEach(async () => {
    // Clean up
    await fs.remove(tempDir);
  });

  describe('compareFiles', () => {
    it('should return comparison results for all file mappings', () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');

      const results = compareFiles(sourceDir, targetDir);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result).toHaveProperty('mapping');
        expect(result).toHaveProperty('inSync');
        expect(result).toHaveProperty('sourceExists');
        expect(result).toHaveProperty('targetExists');
      });
    });

    it('should include a statusline.sh mapping in results', () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');

      const results = compareFiles(sourceDir, targetDir);

      const statuslineResult = results.find(r => r.mapping.source === 'statusline.sh');
      expect(statuslineResult).toBeDefined();
      expect(statuslineResult!.mapping.target).toBe('statusline.sh');
      expect(statuslineResult!.mapping.type).toBe('file');
    });

    it('should detect when files are missing in both locations', () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');

      const results = compareFiles(sourceDir, targetDir);

      // All files should be missing and considered in sync
      results.forEach(result => {
        expect(result.sourceExists).toBe(false);
        expect(result.targetExists).toBe(false);
        expect(result.inSync).toBe(true);
      });
    });
  });

  describe('metadata operations', () => {
    describe('createMetaJson', () => {
      it('should create valid metadata', () => {
        const claudeConfigPath = '/home/user/.claude';
        const codexConfigPath = '/home/user/.codex';
        const meta = createMetaJson(claudeConfigPath, codexConfigPath);

        expect(meta).toHaveProperty('version');
        expect(meta).toHaveProperty('lastSync');
        expect(meta).toHaveProperty('machineId');
        expect(meta).toHaveProperty('platform');
        expect(meta).toHaveProperty('claudeConfigPath');

        expect(meta.version).toBe('2.1.0');
        expect(meta.lastSync).toBeNull();
        expect(meta.claudeConfigPath).toBe(claudeConfigPath);
        expect(meta.codexConfigPath).toBe(codexConfigPath);
        expect(meta.machineId).toContain('-'); // Format: hostname-hash
        expect(['linux', 'darwin']).toContain(meta.platform);
      });

      it('should generate consistent machineId for same hostname', () => {
        const meta1 = createMetaJson('/test/path');
        const meta2 = createMetaJson('/test/path');

        // Should be the same since hostname and platform are the same
        expect(meta1.machineId).toBe(meta2.machineId);
      });

      it('should include managedBy field set to agent-config-backup', () => {
        const meta = createMetaJson('/test/path');

        expect(meta).toHaveProperty('managedBy');
        expect(meta.managedBy).toBe('agent-config-backup');
      });
    });

    describe('writeMetaJson and readMetaJson', () => {
      it('should write and read metadata correctly', async () => {
        const meta = createMetaJson('/test/path');
        const jeanClaudeDir = path.join(tempDir, '.agent-config-backup');
        await fs.ensureDir(jeanClaudeDir);

        await writeMetaJson(jeanClaudeDir, meta);

        const metaPath = path.join(jeanClaudeDir, 'meta.json');
        expect(await fs.pathExists(metaPath)).toBe(true);

        const readMeta = await readMetaJson(jeanClaudeDir);
        expect(readMeta).toEqual(meta);
      });

      it('should return null when meta.json does not exist', async () => {
        const jeanClaudeDir = path.join(tempDir, '.agent-config-backup');
        await fs.ensureDir(jeanClaudeDir);

        const meta = await readMetaJson(jeanClaudeDir);
        expect(meta).toBeNull();
      });
    });

    describe('updateLastSync', () => {
      it('should update the lastSync timestamp', async () => {
        const meta = createMetaJson('/test/path');
        const jeanClaudeDir = path.join(tempDir, '.agent-config-backup');
        await fs.ensureDir(jeanClaudeDir);
        await writeMetaJson(jeanClaudeDir, meta);

        expect(meta.lastSync).toBeNull();

        await updateLastSync(jeanClaudeDir);

        const updatedMeta = await readMetaJson(jeanClaudeDir);
        expect(updatedMeta?.lastSync).not.toBeNull();
        if (updatedMeta?.lastSync) {
          expect(new Date(updatedMeta.lastSync).getTime()).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('syncFromClaudeConfig', () => {
    it('should copy files from Claude config to jean-claude repo', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.agent-config-backup');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      // Create test files
      await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), '# Instructions');
      await fs.writeFile(path.join(claudeDir, 'settings.json'), '{"theme":"dark"}');

      const results = await syncFromClaudeConfig(claudeDir, jeanClaudeDir);

      // Should have synced files
      expect(results.length).toBeGreaterThan(0);
      expect(await fs.pathExists(path.join(jeanClaudeDir, 'CLAUDE.md'))).toBe(true);
      expect(await fs.pathExists(path.join(jeanClaudeDir, 'settings.json'))).toBe(true);

      const claudeMd = await fs.readFile(path.join(jeanClaudeDir, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toBe('# Instructions');
    });

    it('should copy statusline.sh from Claude config', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.agent-config-backup');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      await fs.writeFile(path.join(claudeDir, 'statusline.sh'), '#!/bin/bash\necho "status"');

      const results = await syncFromClaudeConfig(claudeDir, jeanClaudeDir);

      expect(await fs.pathExists(path.join(jeanClaudeDir, 'statusline.sh'))).toBe(true);
      const content = await fs.readFile(path.join(jeanClaudeDir, 'statusline.sh'), 'utf-8');
      expect(content).toBe('#!/bin/bash\necho "status"');

      const statuslineResult = results.find(r => r.file === 'statusline.sh');
      expect(statuslineResult).toBeDefined();
    });

    it('should sync hooks directory', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.agent-config-backup');

      await fs.ensureDir(path.join(claudeDir, 'hooks'));
      await fs.ensureDir(jeanClaudeDir);

      await fs.writeFile(path.join(claudeDir, 'hooks', 'test.sh'), '#!/bin/bash\necho "test"');

      const results = await syncFromClaudeConfig(claudeDir, jeanClaudeDir);

      expect(await fs.pathExists(path.join(jeanClaudeDir, 'hooks', 'test.sh'))).toBe(true);
    });
  });

  describe('syncToClaudeConfig', () => {
    it('should copy files from jean-claude repo to Claude config', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.agent-config-backup');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      await fs.writeFile(path.join(jeanClaudeDir, 'CLAUDE.md'), '# Remote Instructions');
      await fs.writeFile(path.join(jeanClaudeDir, 'settings.json'), '{"theme":"light"}');

      const results = await syncToClaudeConfig(jeanClaudeDir, claudeDir);

      expect(await fs.pathExists(path.join(claudeDir, 'CLAUDE.md'))).toBe(true);
      expect(await fs.pathExists(path.join(claudeDir, 'settings.json'))).toBe(true);

      const claudeMd = await fs.readFile(path.join(claudeDir, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toBe('# Remote Instructions');
    });

    it('should copy statusline.sh to Claude config', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.agent-config-backup');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      await fs.writeFile(path.join(jeanClaudeDir, 'statusline.sh'), '#!/bin/bash\necho "status"');

      const results = await syncToClaudeConfig(jeanClaudeDir, claudeDir);

      expect(await fs.pathExists(path.join(claudeDir, 'statusline.sh'))).toBe(true);
      const content = await fs.readFile(path.join(claudeDir, 'statusline.sh'), 'utf-8');
      expect(content).toBe('#!/bin/bash\necho "status"');

      const statuslineResult = results.find(r => r.file === 'statusline.sh');
      expect(statuslineResult).toBeDefined();
    });

    it('should overwrite existing files', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.agent-config-backup');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), '# Old');
      await fs.writeFile(path.join(jeanClaudeDir, 'CLAUDE.md'), '# New');

      await syncToClaudeConfig(jeanClaudeDir, claudeDir);

      const claudeMd = await fs.readFile(path.join(claudeDir, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toBe('# New');
    });
  });

  describe('Codex sync support', () => {
    it('should copy Codex config into codex/ in the sync repo', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const codexDir = path.join(tempDir, '.codex');
      const syncDir = path.join(tempDir, '.agent-config-backup');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(path.join(codexDir, 'skills', 'example'));
      await fs.ensureDir(path.join(codexDir, 'rules'));
      await fs.ensureDir(syncDir);

      await fs.writeFile(path.join(codexDir, 'AGENTS.md'), '# Codex instructions');
      await fs.writeFile(path.join(codexDir, 'config.toml'), 'model = "gpt-5"');
      await fs.writeFile(path.join(codexDir, 'skills', 'example', 'SKILL.md'), '# Skill');
      await fs.writeFile(path.join(codexDir, 'rules', 'default.rules'), 'rule');
      await fs.writeFile(path.join(codexDir, 'auth.json'), '{"token":"secret"}');

      const results = await syncAllFromConfigs(
        syncDir,
        createSyncTargets(claudeDir, codexDir)
      );

      expect(results.some(r => r.file === 'codex/AGENTS.md')).toBe(true);
      expect(await fs.pathExists(path.join(syncDir, 'codex', 'AGENTS.md'))).toBe(true);
      expect(await fs.pathExists(path.join(syncDir, 'codex', 'config.toml'))).toBe(true);
      expect(await fs.pathExists(path.join(syncDir, 'codex', 'skills', 'example', 'SKILL.md'))).toBe(true);
      expect(await fs.pathExists(path.join(syncDir, 'codex', 'rules', 'default.rules'))).toBe(true);
      expect(await fs.pathExists(path.join(syncDir, 'codex', 'auth.json'))).toBe(false);
    });

    it('should apply codex/ files back to ~/.codex', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const codexDir = path.join(tempDir, '.codex');
      const syncDir = path.join(tempDir, '.agent-config-backup');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(path.join(syncDir, 'codex', 'skills', 'example'));
      await fs.writeFile(path.join(syncDir, 'codex', 'AGENTS.md'), '# Remote Codex');
      await fs.writeFile(path.join(syncDir, 'codex', 'skills', 'example', 'SKILL.md'), '# Remote Skill');

      const results = await syncAllToConfigs(
        syncDir,
        createSyncTargets(claudeDir, codexDir)
      );

      expect(results.some(r => r.file === 'codex/AGENTS.md')).toBe(true);
      expect(await fs.readFile(path.join(codexDir, 'AGENTS.md'), 'utf-8')).toBe('# Remote Codex');
      expect(await fs.readFile(path.join(codexDir, 'skills', 'example', 'SKILL.md'), 'utf-8')).toBe('# Remote Skill');
    });

    it('should not delete backed-up Codex files when ~/.codex is absent on push', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const codexDir = path.join(tempDir, '.codex');
      const syncDir = path.join(tempDir, '.agent-config-backup');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(path.join(syncDir, 'codex'));
      await fs.writeFile(path.join(syncDir, 'codex', 'AGENTS.md'), '# Existing Codex backup');

      await syncAllFromConfigs(
        syncDir,
        createSyncTargets(claudeDir, codexDir)
      );

      expect(await fs.readFile(path.join(syncDir, 'codex', 'AGENTS.md'), 'utf-8')).toBe('# Existing Codex backup');
    });
  });
});
