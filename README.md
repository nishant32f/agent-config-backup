# Agent Config Backup

**A companion for managing Claude Code profiles and syncing Claude Code plus Codex configuration across machines.**

This fork started from Jean-Claude and keeps its Claude profile workflow, but the sync repository is now neutral: `~/.agent-config-backup`.

## Quick Start

```bash
# Install globally from this fork/package
npm install -g agent-config-backup

# Initialize local backup state
agent-config init

# Create a Claude Code profile for your work account
agent-config profile create work

# Push Claude and Codex config to Git
agent-config sync setup
agent-config sync push
```

The legacy `jean-claude` binary is still available as a compatibility alias.

## What Gets Synced?

Claude Code files are stored at the root of the sync repository:

- `CLAUDE.md`
- `settings.json`
- `hooks/`
- `skills/`
- `agents/`
- `keybindings.json`
- `statusline.sh`
- Profile definitions

Codex files are stored under `codex/` in the sync repository:

- `codex/AGENTS.md` from `~/.codex/AGENTS.md`
- `codex/config.toml` from `~/.codex/config.toml`
- `codex/hooks.json` from `~/.codex/hooks.json`
- `codex/agents/` from `~/.codex/agents/`
- `codex/skills/` from `~/.codex/skills/`
- `codex/rules/` from `~/.codex/rules/`

Codex auth, sessions, logs, caches, databases, attachments, browser state, worktrees, and history are intentionally not synced.

## Profiles

Profiles let you run multiple Claude Code configurations side by side.

```bash
# Create a profile interactively
agent-config profile create work

# Create non-interactively
agent-config profile create work --yes --shell .zshrc

# List profiles
agent-config profile list

# Launch Claude Code with a profile
claude-work

# Re-create symlinks if something breaks
agent-config profile refresh work

# Delete a profile
agent-config profile delete work
```

Your main `~/.claude/` stays the source of truth for Claude profile files. Profile directories such as `~/.claude-work/` symlink shared files back to the main Claude config.

| Always shared | Optionally shared | Profile-specific |
| --- | --- | --- |
| `settings.json` | `CLAUDE.md` | Authentication/session |
| `hooks/` | `statusline.sh` | |
| `agents/` | | |
| `skills/` | | |
| `plugins/` | | |
| `keybindings.json` | | |

## Syncing

Syncing is optional and uses Git.

```bash
# Set up syncing
agent-config sync setup

# Push your local Claude and Codex config to Git
agent-config sync push

# Pull config on another machine
agent-config sync pull

# Check sync status
agent-config sync status
```

Typical workflow:

```bash
# Machine 1
agent-config init
agent-config profile create work --yes --shell .zshrc
agent-config sync setup
agent-config sync push

# Machine 2
agent-config init --sync --url git@github.com:you/agent-config.git
agent-config sync pull
claude-work
```

## Command Reference

| Command | Description |
| --- | --- |
| `agent-config init` | Initialize Agent Config Backup on this machine |
| `agent-config init --sync --url <repo>` | Initialize with Git syncing |
| `agent-config init --no-sync` | Initialize without syncing |
| `agent-config profile create <name>` | Create a Claude Code profile |
| `agent-config profile list` | List profiles |
| `agent-config profile delete <name>` | Delete a profile |
| `agent-config profile refresh <name>` | Refresh profile symlinks |
| `agent-config sync setup` | Set up Git-based syncing |
| `agent-config sync push` | Push config to Git |
| `agent-config sync pull` | Pull config from Git |
| `agent-config sync status` | Check sync status |

## Development

```bash
npm install
npm run build
npm run test:unit
```

Integration tests are available with:

```bash
npm run test:integration
```

## Security Notes

Codex support is intentionally config-focused. It does not back up `~/.codex/auth.json`, session logs, SQLite state, browser sessions, attachments, plugin caches, temporary files, or worktrees.
